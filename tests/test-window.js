#!/usr/bin/env -S gjs -m
// A plain, brightly coloured window for the sealed screencast test: easy to
// tell apart from the desktop background in the recorded frames.
import Gdk from 'gi://Gdk?version=4.0';
import Gtk from 'gi://Gtk?version=4.0';

const app = new Gtk.Application({application_id: 'org.example.LampTestWindow'});
app.connect('activate', () => {
    const css = new Gtk.CssProvider();
    css.load_from_string('window, window * { background: #e0109a; }');
    Gtk.StyleContext.add_provider_for_display(
        Gdk.Display.get_default(), css, Gtk.STYLE_PROVIDER_PRIORITY_USER);

    const win = new Gtk.ApplicationWindow({
        application: app,
        title: 'lamp-test',
        default_width: 760,
        default_height: 480,
    });
    win.set_child(new Gtk.Label({label: 'lamp test'}));
    win.present();
});
app.run([]);
