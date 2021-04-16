
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

// https://github.com/GNOME/gnome-shell/blob/master/js/ui/windowManager.js

const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.commonUtils;

let minimizeId = null;
let unminimizeId = null;

function init() {}

function enable() {
    Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor = Main.wm._shouldAnimateActor;
    Main.wm._shouldAnimateActor = function(actor, types) {
        let stack = new Error().stack;
        if (stack && (stack.indexOf("_minimizeWindow") !== -1 || stack.indexOf("_unminimizeWindow") !== -1)) {
            return false;
        }
        
        return Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor(actor, types);
    }

    Main.wm._shellwm.original_completed_minimize = Main.wm._shellwm.completed_minimize;
    Main.wm._shellwm.completed_minimize = function(actor) {
        return;
    }

    Main.wm._shellwm.original_completed_unminimize = Main.wm._shellwm.completed_unminimize;
    Main.wm._shellwm.completed_unminimize = function(actor) {
        return;
    }

    minimizeId = global.window_manager.connect("minimize", (e, actor) => {
        if (Main.overview.visible) {
            Main.wm._shellwm.original_completed_minimize(actor);
            return;
        }

        let icon = getIcon(actor);

        Utils.destroy_actor_magic_lamp_minimize_effect(actor);
        Utils.destroy_actor_magic_lamp_unminimize_effect(actor);

        Utils.add_actor_magic_lamp_minimize_effect(actor, icon);
    });

    unminimizeId = global.window_manager.connect("unminimize", (e, actor) => {
        actor.show();

        if (Main.overview.visible) {
            Main.wm._shellwm.original_completed_unminimize(actor);
            return;
        }

        let icon = getIcon(actor);

        Utils.destroy_actor_magic_lamp_minimize_effect(actor);
        Utils.destroy_actor_magic_lamp_unminimize_effect(actor);

        Utils.add_actor_magic_lamp_unminimize_effect(actor, icon);
    });
}

function disable() {
    if (minimizeId) {
        global.window_manager.disconnect(minimizeId);
    }
    if (minimizeId) {
        global.window_manager.disconnect(unminimizeId);
    }

    global.get_window_actors().forEach((actor) => {
        Utils.destroy_actor_magic_lamp_minimize_effect(actor);
        Utils.destroy_actor_magic_lamp_unminimize_effect(actor);
    });
    
    if (Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor) {
        Main.wm._shouldAnimateActor = Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor;
        Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor = null;
    }
    if (Main.wm._shellwm.original_completed_minimize) {
        Main.wm._shellwm.completed_minimize = Main.wm._shellwm.original_completed_minimize;
        Main.wm._shellwm.original_completed_minimize = null;
    }
    if (Main.wm._shellwm.original_completed_unminimize) {
        Main.wm._shellwm.completed_unminimize = Main.wm._shellwm.original_completed_unminimize;    
        Main.wm._shellwm.original_completed_unminimize = null;
    }
}

function getIcon(actor) {
    let [success, icon] = actor.meta_window.get_icon_geometry();
    if (success) { 
        return icon;
    } else {
        let monitor = Main.layoutManager.monitors[actor.meta_window.get_monitor()];
        if (!monitor) {
            return {x: 0, y: 0, width: 0, height: 0};    
        } else {
            if (Main.overview.dash) {
                let dash = Main.overview.dash;
                dash._redisplay();  

                let dashIcon = null;
                let transformed_position = null;
                let pids = null;
                let pid = actor.get_meta_window() ? actor.get_meta_window().get_pid() : null;
                if (pid) {
                    dash._box.get_children()
                        .filter(dashElement => dashElement.child && dashElement.child._delegate && dashElement.child._delegate.app)
                        .forEach(dashElement => {
                            pids = dashElement.child._delegate.app.get_pids();
                            if (pids && pids.indexOf(pid) >= 0) {
                                transformed_position = dashElement.get_transformed_position();
                                if (transformed_position && transformed_position[0]) {
                                    dashIcon = {x: transformed_position[0], y: monitor.y + monitor.height, width: 0, height: 0};
                                    return;
                                }
                            }
                        });
                }
                if (dashIcon) {
                    return dashIcon;
                }
            }

            return {x: monitor.x + monitor.width / 2, y: monitor.y + monitor.height, width: 0, height: 0};
        } 
    }
}