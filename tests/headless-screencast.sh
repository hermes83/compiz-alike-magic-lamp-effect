#!/bin/bash
# Checks that the lamp animation reaches GNOME's screen sharing frame by frame.
#
# Starts a throwaway headless GNOME Shell with its own D-Bus, PipeWire and
# WirePlumber; runtime, config, data, cache and dconf all live in a fresh folder
# under /tmp, exported before dbus-run-session so every service inherits them.
# The extension from this working tree is installed and enabled there, a test
# window is minimised and restored, and tests/screencast-frames.py records the
# virtual monitor through org.gnome.Mutter.ScreenCast. The real session's
# screen is never captured.
#
#   tests/headless-screencast.sh [--buffers shm|dmabuf] [--effects default,sine]
#
# Needs gnome-shell, pipewire, wireplumber, gjs (GTK 4), python3-gi and the
# GStreamer pipewire (and, for --buffers dmabuf, opengl) plugins.
# KEEP=1 keeps the session folder (logs) afterwards.
set -u
UUID="compiz-alike-magic-lamp-effect@hermes83.github.com"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
R=$(mktemp -d /tmp/lamp-screencast-XXXXXX)
export LAMP_TEST_SESSION=$R

stop_session() {
    local p pids=""
    for p in $(pgrep -u "$(id -u)"); do
        [ "$p" = $$ ] && continue
        { tr '\0' '\n' < /proc/$p/environ; } 2>/dev/null | grep -qx "LAMP_TEST_SESSION=$R" && pids="$pids $p"
    done
    [ -n "$pids" ] || return 0
    kill $pids 2>/dev/null; timeout 2 tail -f /dev/null; kill -9 $pids 2>/dev/null
    return 0
}
cleanup() {
    stop_session
    for m in $R/run/doc $R/run/gvfs; do grep -qs " $m " /proc/mounts && fusermount3 -u -z $m; done
    [ -n "${KEEP:-}" ] && { echo "kept $R"; return; }
    rm -rf "$R"
}
trap cleanup EXIT

export XDG_RUNTIME_DIR=$R/run XDG_CONFIG_HOME=$R/config XDG_DATA_HOME=$R/data XDG_CACHE_HOME=$R/cache
export XDG_STATE_HOME=$R/state GVFS_DISABLE_FUSE=1 GIO_USE_VFS=local
mkdir -p $XDG_RUNTIME_DIR $XDG_CONFIG_HOME $XDG_DATA_HOME $XDG_STATE_HOME
chmod 700 $XDG_RUNTIME_DIR
echo "user-db:lamptest" > $R/dconf-profile; export DCONF_PROFILE=$R/dconf-profile
unset WAYLAND_DISPLAY DISPLAY PIPEWIRE_REMOTE

# Install the extension from this working tree into the sealed data folder.
EXT=$XDG_DATA_HOME/gnome-shell/extensions/$UUID
mkdir -p $EXT/schemas
cp "$SRC"/metadata.json "$SRC"/extension.js "$SRC"/prefs.js "$SRC"/settings_data.js $EXT/
cp "$SRC"/schemas/*.gschema.xml $EXT/schemas/
glib-compile-schemas $EXT/schemas

dbus-run-session -- bash -c "
    echo \$DBUS_SESSION_BUS_ADDRESS > $R/bus
    gsettings set org.gnome.shell disable-user-extensions false
    gsettings set org.gnome.shell enabled-extensions \"['$UUID']\"
    gsettings set org.gnome.desktop.interface enable-animations true
    pipewire > $R/pipewire.log 2>&1 &
    sleep 0.5
    wireplumber > $R/wireplumber.log 2>&1 &
    exec gnome-shell --headless --wayland --no-x11 --virtual-monitor 1280x800 --unsafe-mode" \
    > $R/shell.log 2>&1 &

for i in $(seq 1 40); do
    [ -s $R/bus ] && gdbus introspect --address "$(cat $R/bus)" -d org.gnome.Mutter.ScreenCast \
        -o /org/gnome/Mutter/ScreenCast > /dev/null 2>&1 && break
    timeout 1 tail -f /dev/null
done
timeout 3 tail -f /dev/null

DBUS_SESSION_BUS_ADDRESS="$(cat $R/bus)" python3 "$SRC/tests/screencast-frames.py" "$@"
status=$?
if [ $status -ne 0 ]; then
    echo "--- shell.log"; grep -v '^$' $R/shell.log | tail -25
    echo "--- pipewire.log"; tail -5 $R/pipewire.log
fi
exit $status
