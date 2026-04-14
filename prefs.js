
/*
 * Compiz-alike-magic-lamp-effect for GNOME Shell
 *
 * Copyright (C) 2020
 *     Mauro Pepe <https://github.com/hermes83/compiz-alike-magic-lamp-effect>
 *
 * This file is part of the gnome-shell extension Compiz-alike-magic-lamp-effect.
 *
 * gnome-shell extension Compiz-alike-magic-lamp-effect is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * gnome-shell extension Compiz-alike-magic-lamp-effect is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE.  See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell extension Compiz-alike-magic-lamp-effect.  If not, see
 * <http://www.gnu.org/licenses/>.
 */
'use strict';

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { SettingsData } from './settings_data.js';

export default class Prefs extends ExtensionPreferences {

    fillPreferencesWindow(window) {
        const settingsData = new SettingsData(this.getSettings());

        const fields = {
            effectComboBox: this.addComboBox(settingsData.EFFECT),
            durationSlider: this.addSlider(settingsData.DURATION, 100.0, 1000.0, 0),
            xTilesSlider: this.addSlider(settingsData.X_TILES, 3.0, 50.0, 0),
            yTilesSlider: this.addSlider(settingsData.Y_TILES, 3.0, 50.0, 0)
        };

        const group1 = Adw.PreferencesGroup.new();
        group1.add(this.newRow("Effect", fields.effectComboBox));
        group1.add(this.newRow("Duration (ms)", fields.durationSlider));

        const group2 = Adw.PreferencesGroup.new();
        group2.add(this.newRow("X Tiles", fields.xTilesSlider));
        group2.add(this.newRow("Y Tiles", fields.yTilesSlider));

        const page = Adw.PreferencesPage.new();
        page.add(group1);
        page.add(group2);

        const header = this.findWidgetByType(window.get_content(), Adw.HeaderBar);
        if (header) {
            const resetButton = this.newResetButton();
            resetButton.connect('clicked', () => {
                settingsData.EFFECT.set("default");
                settingsData.DURATION.set(500.0);
                settingsData.X_TILES.set(15.0);
                settingsData.Y_TILES.set(20.0);

                fields.effectComboBox.set_active(0);
                fields.durationSlider.set_value(settingsData.DURATION.get());
                fields.xTilesSlider.set_value(settingsData.X_TILES.get());
                fields.yTilesSlider.set_value(settingsData.Y_TILES.get());
            });

            header.pack_start(resetButton);
        }

        window.set_default_size(750, 380);
        window.add(page);
    }

    newResetButton() {
        const button = new Gtk.Button({vexpand: true, valign: Gtk.Align.END});
        button.set_icon_name('edit-clear');
        return button;
    }
    
    newRow(labelText, field) {
        const row = Adw.ActionRow.new();
        row.set_title(labelText);
        row.add_suffix(field);
        return row;
    }

    addSlider(settingsData, lower, upper, decimalDigits) {
        const scale = new Gtk.Scale({
            digits: decimalDigits,
            adjustment: new Gtk.Adjustment({lower: lower, upper: upper}),
            value_pos: Gtk.PositionType.RIGHT,
            hexpand: true, 
            halign: Gtk.Align.END
        });
        scale.set_draw_value(true);    
        scale.set_value(settingsData.get());
        scale.connect('value-changed', (sw) => {
            var newval = sw.get_value();
            if (newval != settingsData.get()) {
                settingsData.set(newval);
            }
        });
        scale.set_size_request(400, 15);

        return scale;
    }

    addComboBox(settingsData) {
        let gtkComboBoxText = new Gtk.ComboBoxText({hexpand: true, halign: Gtk.Align.END});
        gtkComboBoxText.set_valign(Gtk.Align.CENTER);

        let activeIndex = 0;
        let activeValue = settingsData.get();
        let values = ["default", "sine"];

        for (let i = 0; i < values.length; i++) {
            gtkComboBoxText.append_text(values[i]);
            if (activeValue && activeValue == values[i]) {
                activeIndex = i;
            }
        }

        gtkComboBoxText.set_active(activeIndex);
        gtkComboBoxText.connect('changed', (sw) => {
            var newval = values[sw.get_active()];
            if (newval != settingsData.get()) {
                settingsData.set(newval);
            }
        });
        
        return gtkComboBoxText;
    }
    
    addBooleanSwitch(settingsData) {
        const gtkSwitch = new Gtk.Switch({hexpand: true, halign: Gtk.Align.END});
        gtkSwitch.set_active(settingsData.get());
        gtkSwitch.set_valign(Gtk.Align.CENTER);
        gtkSwitch.connect('state-set', (sw) => {
            var newval = sw.get_active();
            if (newval != settingsData.get()) {
                settingsData.set(newval);
            }
        });
        
        return gtkSwitch;
    }

    findWidgetByType(parent, type) {
        for (const child of [...parent]) {
            if (child instanceof type) return child;

            const match = this.findWidgetByType(child, type);
            if (match) return match;
        }
        return null;
    }
}