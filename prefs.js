const Gtk = imports.gi.Gtk;

let Extension = imports.misc.extensionUtils.getCurrentExtension();
let Settings = Extension.imports.settings;

let effectComboBox = null;
let durationSlider = null;
let xTilesSlider = null;
let yTilesSlider = null;

function init() { }

function buildPrefsWidget() {
    let config = new Settings.Prefs();

    let frame = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        border_width: 20, 
        spacing: 20
    });

    effectComboBox = addComboBox(frame, "Effect", config.EFFECT);
    durationSlider = addSlider(frame, "Duration (ms)", config.DURATION, 100.0, 1000.0, 0);
    xTilesSlider = addSlider(frame, "X Tiles", config.X_TILES, 3.0, 50.0, 0);
    yTilesSlider = addSlider(frame, "Y Tiles", config.Y_TILES, 3.0, 50.0, 0);

    addDefaultButton(frame, config);

    frame.show_all();
    
    return frame;
}

function addDefaultButton(frame, config) {
    let button = new Gtk.Button({label: "Reset to default"});
    button.connect('clicked', function () {
        config.EFFECT.set("default");
        config.DURATION.set(500.0);
        config.X_TILES.set(15.0);
        config.Y_TILES.set(20.0);

        effectComboBox.set_active(0);
        durationSlider.set_value(config.DURATION.get());
        xTilesSlider.set_value(config.X_TILES.get());
        yTilesSlider.set_value(config.Y_TILES.get());
    });

    frame.pack_end(button, false, false, 0);
    
    return button;
}

function addSlider(frame, labelText, prefConfig, lower, upper, decimalDigits) {
    let scale = new Gtk.HScale({
        digits: decimalDigits,
        adjustment: new Gtk.Adjustment({lower: lower, upper: upper}),
        value_pos: Gtk.PositionType.RIGHT,
        hexpand: true, 
        halign: Gtk.Align.END
    });
    scale.set_value(prefConfig.get());
    scale.connect('value-changed', function (sw) {
        var newval = sw.get_value();
        if (newval != prefConfig.get()) {
            prefConfig.set(newval);
        }
    });
    scale.set_size_request(400, 15);

    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 20});
    hbox.add(new Gtk.Label({label: labelText, use_markup: true}));
    hbox.add(scale);
    
    frame.add(hbox);
    
    return scale;
}

function addComboBox(frame, labelText, prefConfig) {
    let gtkComboBoxText = new Gtk.ComboBoxText({hexpand: true, halign: Gtk.Align.END});

    let activeIndex = 0;
    let activeValue = prefConfig.get();
    let values = ["default", "sine"];

    for (let i = 0; i < values.length; i++) {
        gtkComboBoxText.append_text(values[i]);
        if (activeValue && activeValue == values[i]) {
            activeIndex = i;
        }
    }

    gtkComboBoxText.set_active(activeIndex);
    gtkComboBoxText.connect('changed', function (sw) {
        var newval = values[sw.get_active()];
        if (newval != prefConfig.get()) {
            prefConfig.set(newval);
        }
    });

    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 20});
    hbox.add(new Gtk.Label({label: labelText, use_markup: true}));
    hbox.add(gtkComboBoxText);
    
    frame.add(hbox);
    
    return gtkComboBoxText;
}

function addBooleanSwitch(frame, labelText, prefConfig) {
    let gtkSwitch = new Gtk.Switch({hexpand: true, halign: Gtk.Align.END});
    gtkSwitch.set_active(prefConfig.get());
    gtkSwitch.connect('state-set', function (sw) {
        var newval = sw.get_active();
        if (newval != prefConfig.get()) {
            prefConfig.set(newval);
        }
    });

    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 20});
    hbox.add(new Gtk.Label({label: labelText, use_markup: true}));
    hbox.add(gtkSwitch);
    
    frame.add(hbox);
    
    return gtkSwitch;
}