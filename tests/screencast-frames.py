#!/usr/bin/env python3
"""Record a sealed headless GNOME Shell through org.gnome.Mutter.ScreenCast and
count how many frames of each minimise / restore animation reach the stream.

Run only inside the session started by tests/headless-screencast.sh: it talks to
the D-Bus address in DBUS_SESSION_BUS_ADDRESS and the PipeWire in XDG_RUNTIME_DIR
of that session, never the real desktop.

    screencast-frames.py --buffers shm|dmabuf --effects default,sine

For every frame the stream delivers it measures, on a 160 x 100 grid, the share
of the screen that changed since the previous frame and the share covered by the
test window's colour. An animation passes when at least MIN_STEPS frames show a
partial change between "window there" and "window gone" (or back).
"""
import argparse
import os
import subprocess
import sys
import threading
import time

import gi
gi.require_version('Gst', '1.0')
from gi.repository import GLib, Gio, Gst

UUID = 'compiz-alike-magic-lamp-effect@hermes83.github.com'
WINDOW_TITLE = 'lamp-test'
WINDOW_RGB = (0xe0, 0x10, 0x9a)
GRID_W, GRID_H = 160, 100
MIN_STEPS = 4          # frames of partial change required per animation
RECORD_SECONDS = 2.0   # recording window per animation

HERE = os.path.dirname(os.path.abspath(__file__))


class Frames:
    """Thread-safe log of (time, changed %, window-colour %) per delivered frame."""

    def __init__(self):
        self.lock = threading.Lock()
        self.log = []
        self.prev = None

    def add(self, buf, width, height, stride, bgrx):
        grid = bytearray(GRID_W * GRID_H * 3)
        i = 0
        for gy in range(GRID_H):
            row = (gy * height // GRID_H) * stride
            for gx in range(GRID_W):
                o = row + (gx * width // GRID_W) * 4
                if bgrx:
                    grid[i], grid[i + 1], grid[i + 2] = buf[o + 2], buf[o + 1], buf[o]
                else:
                    grid[i], grid[i + 1], grid[i + 2] = buf[o], buf[o + 1], buf[o + 2]
                i += 3
        n = GRID_W * GRID_H
        win = 0
        for p in range(0, len(grid), 3):
            if (abs(grid[p] - WINDOW_RGB[0]) < 40 and abs(grid[p + 1] - WINDOW_RGB[1]) < 40
                    and abs(grid[p + 2] - WINDOW_RGB[2]) < 40):
                win += 1
        changed = 0
        if self.prev is not None:
            prev = self.prev
            for p in range(0, len(grid), 3):
                if (abs(grid[p] - prev[p]) > 8 or abs(grid[p + 1] - prev[p + 1]) > 8
                        or abs(grid[p + 2] - prev[p + 2]) > 8):
                    changed += 1
        self.prev = grid
        with self.lock:
            self.log.append((time.monotonic(), 100.0 * changed / n, 100.0 * win / n))

    def since(self, t0):
        with self.lock:
            return [f for f in self.log if f[0] >= t0]


def bus():
    return Gio.bus_get_sync(Gio.BusType.SESSION, None)


def call(conn, name, path, iface, method, args, reply):
    return conn.call_sync(name, path, iface, method, args,
                          GLib.VariantType.new(reply) if reply else None,
                          Gio.DBusCallFlags.NONE, 10000, None)


def shell_eval(conn, code):
    ok, out = call(conn, 'org.gnome.Shell', '/org/gnome/Shell', 'org.gnome.Shell', 'Eval',
                   GLib.Variant('(s)', (code,)), '(bs)').unpack()
    if not ok:
        raise RuntimeError(f'Eval failed: {out}\n  code: {code}')
    return out


def pump(seconds):
    ctx = GLib.MainContext.default()
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        ctx.iteration(False)
        time.sleep(0.005)


def start_screencast(conn):
    sc = 'org.gnome.Mutter.ScreenCast'
    session = call(conn, sc, '/org/gnome/Mutter/ScreenCast', sc, 'CreateSession',
                   GLib.Variant('(a{sv})', ({},)), '(o)').unpack()[0]
    props = {'cursor-mode': GLib.Variant('u', 0)}  # hidden: only the desktop
    stream = call(conn, sc, session, sc + '.Session', 'RecordMonitor',
                  GLib.Variant('(sa{sv})', ('', props)), '(o)').unpack()[0]
    node = []
    conn.signal_subscribe(sc, sc + '.Stream', 'PipeWireStreamAdded', stream, None,
                          Gio.DBusSignalFlags.NONE,
                          lambda *a: node.append(a[5].unpack()[0]))
    call(conn, sc, session, sc + '.Session', 'Start', None, None)
    end = time.monotonic() + 10
    while not node and time.monotonic() < end:
        pump(0.05)
    if not node:
        raise RuntimeError('no PipeWire stream from mutter')
    return session, node[0]


def build_pipeline(node, buffers, frames):
    src = f'pipewiresrc name=src target-object={node} keepalive-time=0'
    sink = 'appsink name=sink emit-signals=true sync=false'
    if buffers == 'shm':
        # Memory buffers only: mutter repaints the stage into each one.
        desc = (f'{src} always-copy=true ! video/x-raw,format={{BGRx,BGRA,RGBx,RGBA}} '
                f'! videoconvert ! video/x-raw,format=BGRx ! {sink}')
    else:
        # DMA-BUF only: mutter copies the screen into it right after painting
        # (or repaints the stage when it records later); GL reads it back.
        desc = (f'{src} ! video/x-raw(memory:DMABuf),format=DMA_DRM ! glupload ! glcolorconvert '
                f'! gldownload ! video/x-raw,format=BGRx ! {sink}')
    pipeline = Gst.parse_launch(desc)
    sink = pipeline.get_by_name('sink')
    seen_caps = []

    def on_sample(s):
        sample = s.emit('pull-sample')
        caps = sample.get_caps()
        st = caps.get_structure(0)
        w, h = st.get_value('width'), st.get_value('height')
        buf = sample.get_buffer()
        ok, info = buf.map(Gst.MapFlags.READ)
        if ok:
            try:
                stride = len(info.data) // h
                frames.add(info.data, w, h, stride, True)
            finally:
                buf.unmap(info)
        if not seen_caps:
            src_caps = pipeline.get_by_name('src').get_static_pad('src').get_current_caps()
            seen_caps.append((src_caps or caps).to_string())
        return Gst.FlowReturn.OK

    sink.connect('new-sample', on_sample)
    pipeline.set_state(Gst.State.PLAYING)
    return pipeline, seen_caps


def window_expr():
    return (f"global.get_window_actors().map(a => a.meta_window)"
            f".find(w => w.get_title() === '{WINDOW_TITLE}')")


def judge(label, frames, t0):
    seen = frames.since(t0)
    changes = [f for f in seen if f[1] > 0.2]
    steps = len(changes)
    print(f'  {label}: {len(seen)} frames delivered, {steps} with change')
    for (t, ch, win) in changes:
        print(f'      +{(t - t0) * 1000:6.0f} ms  changed {ch:5.1f}%  window colour {win:5.1f}%')
    return steps


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--buffers', choices=['shm', 'dmabuf'], default='shm')
    ap.add_argument('--effects', default='default,sine')
    ap.add_argument('--settle', type=float, default=1.0)
    args = ap.parse_args()

    Gst.init(None)
    conn = bus()

    shell_eval(conn, 'Main.overview.hide(); true')
    state = shell_eval(conn, f"Main.extensionManager.lookup('{UUID}')?.state ?? 'missing'")
    print(f'extension state: {state} (1 = enabled)')

    env = dict(os.environ, GDK_BACKEND='wayland', WAYLAND_DISPLAY='wayland-0')
    win_proc = subprocess.Popen(['gjs', '-m', os.path.join(HERE, 'test-window.js')], env=env)
    for _ in range(100):
        pump(0.1)
        if shell_eval(conn, f'!!({window_expr()})') == 'true':
            break
    else:
        raise RuntimeError('test window did not appear')
    shell_eval(conn, f'{window_expr()}.move_frame(true, 120, 80); true')

    session, node = start_screencast(conn)
    frames = Frames()
    pipeline, caps = build_pipeline(node, args.buffers, frames)
    pump(2.0)
    if not frames.log:
        raise RuntimeError(f'no frames from the {args.buffers} pipeline')
    print(f'stream node {node}, negotiated: {caps[0] if caps else "?"}')

    failures = []
    for effect in args.effects.split(','):
        shell_eval(conn, f"Main.extensionManager.lookup('{UUID}').stateObj.getSettings()"
                         f".set_string('effect', '{effect}'); true")
        print(f'effect {effect}:')
        pump(args.settle)
        t0 = time.monotonic()
        shell_eval(conn, f'{window_expr()}.minimize(); true')
        pump(RECORD_SECONDS)
        if judge('minimise', frames, t0) < MIN_STEPS:
            failures.append(f'{effect} minimise')
        pump(args.settle)
        t0 = time.monotonic()
        shell_eval(conn, f'{window_expr()}.unminimize(); {window_expr()}.activate(global.get_current_time()); true')
        pump(RECORD_SECONDS)
        if judge('restore', frames, t0) < MIN_STEPS:
            failures.append(f'{effect} restore')

    pipeline.set_state(Gst.State.NULL)
    call(conn, 'org.gnome.Mutter.ScreenCast', session, 'org.gnome.Mutter.ScreenCast.Session',
         'Stop', None, None)
    win_proc.terminate()

    if failures:
        print(f'FAIL ({args.buffers}): no in-between frames for: {", ".join(failures)}')
        return 1
    print(f'PASS ({args.buffers}): every animation reached the stream frame by frame')
    return 0


if __name__ == '__main__':
    sys.exit(main())
