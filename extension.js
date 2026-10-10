
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

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { SettingsData } from './settings_data.js';

const MINIMIZE_EFFECT_NAME = 'minimize-magic-lamp-effect';
const UNMINIMIZE_EFFECT_NAME = 'unminimize-magic-lamp-effect';

// 'macos' effect: the window first bends into a funnel whose sides follow an
// S-curve into the icon, then the whole window slides down that funnel. The two
// phases overlap so the motion reads as one continuous "genie" movement.
const MACOS_BEND_END = 0.4;        // bend phase runs over progress 0 .. 0.4
const MACOS_SLIDE_START = 0.2;     // slide phase runs over progress 0.2 .. 1
const MACOS_NECK_START = 0.2;      // the sides stay straight for the first 20% of the way to the icon...
const MACOS_NECK_END = 0.85;       // ...and have fully narrowed into the neck 85% of the way down
const MACOS_MIN_ALONG_TILES = 30;  // mesh rows along the funnel so the curve stays smooth

export default class CompizMagicLampEffectExtension extends Extension {

    enable() {
        this.settingsData = new SettingsData(this.getSettings());

        // https://github.com/GNOME/gnome-shell/blob/master/js/ui/windowManager.js

        if (Main.wm._shouldAnimateActor) {
            Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor = Main.wm._shouldAnimateActor;
            Main.wm._shouldAnimateActor = function(actor, types) {
                let stack = new Error().stack;
                if (stack && (stack.indexOf("_minimizeWindow") !== -1 || stack.indexOf("_unminimizeWindow") !== -1)) {
                    return false;
                }
                
                return Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor(actor, types);
            };
        }

        Main.wm._shellwm.original_completed_minimize = Main.wm._shellwm.completed_minimize;
        Main.wm._shellwm.completed_minimize = function(actor) {
            return;
        };

        Main.wm._shellwm.original_completed_unminimize = Main.wm._shellwm.completed_unminimize;
        Main.wm._shellwm.completed_unminimize = function(actor) {
            return;
        };

        this.minimizeId = global.window_manager.connect("minimize", (e, actor) => {
            if (Main.overview.visible) {
                Main.wm._shellwm.original_completed_minimize(actor);
                return;
            }

            let icon = this.getIcon(actor);

            this.destroyActorEffect(actor);

            actor.add_effect_with_name(MINIMIZE_EFFECT_NAME, new MagicLampMinimizeEffect({settingsData: this.settingsData, icon: icon}));
        });

        this.unminimizeId = global.window_manager.connect("unminimize", (e, actor) => {
            actor.show();

            if (Main.overview.visible) {
                Main.wm._shellwm.original_completed_unminimize(actor);
                return;
            }

            let icon = this.getIcon(actor);

            this.destroyActorEffect(actor);

            actor.add_effect_with_name(UNMINIMIZE_EFFECT_NAME, new MagicLampUnminimizeEffect({settingsData: this.settingsData, icon: icon}));
        });
    }

    disable() {
        if (this.settingsData) {
            this.settingsData = null;
        }
        if (this.minimizeId) {
            global.window_manager.disconnect(this.minimizeId);
            this.minimizeId = null;
        }
        if (this.unminimizeId) {
            global.window_manager.disconnect(this.unminimizeId);
            this.unminimizeId = null;
        }
    
        global.get_window_actors().forEach((actor) => {
            this.destroyActorEffect(actor);
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

    getIcon(actor) {
        let [success, icon] = actor.meta_window.get_icon_geometry();
        if (success) {
            return icon;
        } 
    
        let monitor = Main.layoutManager.monitors[actor.meta_window.get_monitor()];
        if (monitor && Main.overview.dash) {
            Main.overview.dash._redisplay();  

            let dashIcon = null;
            let transformed_position = null;
            let pids = null;
            let pid = actor.get_meta_window() ? actor.get_meta_window().get_pid() : null;
            if (pid) {
                Main.overview.dash._box.get_children()
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

            return {x: monitor.x + monitor.width / 2, y: monitor.y + monitor.height, width: 0, height: 0};
        }

        return {x: 0, y: 0, width: 0, height: 0};    
    }

    destroyActorEffect(actor) {
        if (!actor) {
            return;
        }

        let minimizeEffect = actor.get_effect(MINIMIZE_EFFECT_NAME);
        if (minimizeEffect) {
            minimizeEffect.destroy();
        }

        let unminimizeEffect = actor.get_effect(UNMINIMIZE_EFFECT_NAME);
        if (unminimizeEffect) {
            unminimizeEffect.destroy();
        }
    }
}

class AbstractCommonMagicLampEffect extends Clutter.DeformEffect {
    static {
        GObject.registerClass(this);
    }    

    _init(params = {}) {
        super._init();

        this.settingsData = params.settingsData;

        this.EPSILON = 40;

        this.isMinimizeEffect = false;
        this.newFrameEvent = null;
        this.completedEvent = null;
        
        this.timerId = null;
        this.msecs = 0;

        this.monitor = {x: 0, y: 0, width: 0, height: 0};
        this.iconMonitor = {x: 0, y: 0, width: 0, height: 0};
        this.window = {x: 0, y: 0, width: 0, height: 0, scale: 1};
        this.icon = params.icon;
        
        this.progress = 0;
        this.split = 0.3;
        this.k = 0;
        this.j = 0;
        this.expandWidth = 0;
        this.fullWidth = 0;
        this.expandHeight = 0;
        this.fullHeight = 0;
        this.width = 0;
        this.height = 0;
        this.x = 0;
        this.y = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.effectX = 0;
        this.effectY = 0;
        this.iconPosition = null;

        this.toTheBorder = true;   // true
        this.maxIconSize = null;    // 48
        this.alignIcon = 'center';  // 'left-top'

        this.EFFECT = this.settingsData.EFFECT.get(); //'default' - 'sine' - 'macos'
        this.EASING = this.settingsData.EASING.get(); //'auto' - 'linear' - 'ease-in' - 'ease-out' - 'ease-in-out'
        this.DURATION = this.settingsData.DURATION.get();
        this.X_TILES = this.settingsData.X_TILES.get();
        this.Y_TILES = this.settingsData.Y_TILES.get();

        this.hasIconTarget = false;
        this.genie = null;
        this.macosProgress = 0;
        this.fadeApplied = false;

        this.initialized = false;
    }

    destroy_actor(actor) {}

    on_tick_elapsed(timer, msecs) {}

    vfunc_set_actor(actor) {
        super.vfunc_set_actor(actor);

        if (!this.actor || this.initialized) {
            return;
        }

        this.initialized = true;
        
        this.monitor = Main.layoutManager.monitors[actor.meta_window.get_monitor()];

        [this.window.x, this.window.y] = [this.actor.get_x() - this.monitor.x, this.actor.get_y() - this.monitor.y];
        [this.window.width, this.window.height] = actor.get_size();

        this.hasIconTarget = !!this.icon && (this.icon.width > 0 || this.icon.height > 0);
        
        if (!this.icon || (this.icon.x == 0 && this.icon.y == 0 && this.icon.width == 0 && this.icon.height == 0)) {
            this.icon.x = this.monitor.x + this.monitor.width / 2;
            this.icon.y = this.monitor.height + this.monitor.y;
        }

        Main.layoutManager.monitors.forEach((monitor, monitorIndex)  => {
            let scale = 1;
            if (global.display && global.display.get_monitor_scale) {
                scale = global.display.get_monitor_scale(monitorIndex);
            }

            if (this.icon.x >= monitor.x && this.icon.x <= monitor.x + monitor.width * scale && this.icon.y >= monitor.y && this.icon.y <= monitor.y + monitor.height * scale)  {
                this.iconMonitor = monitor;
            }
        });
        if (this.iconMonitor.x == 0 && this.iconMonitor.y == 0 && this.iconMonitor.width == 0 && this.iconMonitor.height == 0) {
            this.iconMonitor = this.monitor;
            // this.icon.x = this.monitor.x + this.monitor.width / 2;
            // this.icon.y = this.monitor.height + this.monitor.y;
        }

        [this.icon.x, this.icon.y, this.icon.width, this.icon.height] = [this.icon.x - this.monitor.x, this.icon.y - this.monitor.y, this.icon.width, this.icon.height];

        if (this.icon.y + this.icon.height >= this.monitor.height - this.EPSILON) {
            this.iconPosition = St.Side.BOTTOM;
            if (this.toTheBorder) {
                this.icon.y = this.iconMonitor.y + this.iconMonitor.height - this.monitor.y
                this.icon.height = 0;
            }
        } else if (this.icon.x <= this.EPSILON) {
            this.iconPosition = St.Side.LEFT;
            if (this.toTheBorder) {
                this.icon.x = this.iconMonitor.x - this.monitor.x;
                this.icon.width = 0;
            }
        } else if (this.icon.x + this.icon.width >= this.monitor.width - this.EPSILON) {
            this.iconPosition = St.Side.RIGHT;
            if (this.toTheBorder) {
                this.icon.x = this.iconMonitor.x + this.iconMonitor.width - this.monitor.x;
                this.icon.width = 0;
            }
        } else {
            this.iconPosition = St.Side.TOP;
            if (this.toTheBorder) {
                this.icon.y = this.iconMonitor.y - this.monitor.y;
                this.icon.height = 0;
            }
        }

        if (this.EFFECT === 'macos') {
            this.setupGenie();
        }

        this.set_n_tiles(this.X_TILES, this.Y_TILES);
        
        this.timerId = new Clutter.Timeline({ actor: this.actor, duration: this.DURATION + (this.monitor.width * this.monitor.height) / (this.window.width * this.window.height) });
        this.newFrameEvent = this.timerId.connect('new-frame', this.on_tick_elapsed.bind(this));
        this.completedEvent = this.timerId.connect('completed', this.destroy.bind(this));
        this.timerId.start();
    }

    destroy() {
        if (this.timerId) {
            if (this.newFrameEvent) {
                this.timerId.disconnect(this.newFrameEvent);
                this.newFrameEvent = null;
            }
            if (this.completedEvent) {
                this.timerId.disconnect(this.completedEvent);
                this.completedEvent = null;
            }
            this.timerId = null;
        }

        let actor = this.get_actor();
        if (actor) {
            if (this.paintEvent) {
                actor.disconnect(this.paintEvent);
                this.paintEvent = null;
            }
            actor.remove_effect(this);

            if (this.fadeApplied) {
                actor.opacity = 255;
                this.fadeApplied = false;
            }

            this.destroy_actor(actor);
        }
    }

    easeProgress(progress) {
        let easing = this.EASING;
        if (easing === 'auto') {
            easing = this.EFFECT === 'macos' ? 'ease-in-out' : 'linear';
        }

        switch (easing) {
            case 'ease-in':
                return progress * progress * progress;
            case 'ease-out':
                return 1 - Math.pow(1 - progress, 3);
            case 'ease-in-out':
                return progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            default:
                return progress;
        }
    }

    // progress runs 0 -> 1 from the full window to the icon, for both minimize and unminimize
    updatePhases(progress) {
        if (this.EFFECT === 'macos') {
            this.macosProgress = progress;
            this.k = Math.min(1, Math.max(0, progress / MACOS_BEND_END));
            this.j = Math.min(1, Math.max(0, (progress - MACOS_SLIDE_START) / (1 - MACOS_SLIDE_START)));

            if (!this.genie && this.actor) {
                this.actor.opacity = Math.round(255 * (1 - progress));
                this.fadeApplied = true;
            }
        } else {
            this.k = progress <= this.split ? progress * (1 / 1 / this.split) : 1;
            this.j = progress > this.split ? (progress - this.split) * (1 / 1 / (1 - this.split)) : 0;
        }
    }

    // Funnel geometry for the 'macos' effect, in monitor coordinates.
    // "along" runs from the window edge farthest from the icon to the icon,
    // "across" is the other axis: c0..c1 is the window span, ic0..ic1 the icon span.
    setupGenie() {
        if (!this.hasIconTarget) {
            // no real icon to funnel into (dock hidden or no dock): scale and fade instead
            this.genie = null;
            return;
        }

        let win = this.window;
        let icon = this.icon;
        let g;
        if (this.iconPosition == St.Side.BOTTOM) {
            g = {len: icon.y - win.y, span: win.height, c0: win.x, c1: win.x + win.width, ic0: icon.x, ic1: icon.x + icon.width};
        } else if (this.iconPosition == St.Side.TOP) {
            g = {len: win.y + win.height - (icon.y + icon.height), span: win.height, c0: win.x, c1: win.x + win.width, ic0: icon.x, ic1: icon.x + icon.width};
        } else if (this.iconPosition == St.Side.LEFT) {
            g = {len: win.x + win.width - (icon.x + icon.width), span: win.width, c0: win.y, c1: win.y + win.height, ic0: icon.y, ic1: icon.y + icon.height};
        } else {
            g = {len: icon.x - win.x, span: win.width, c0: win.y, c1: win.y + win.height, ic0: icon.y, ic1: icon.y + icon.height};
        }
        g.len = Math.max(g.len, g.span);
        this.genie = g;

        if (this.iconPosition == St.Side.BOTTOM || this.iconPosition == St.Side.TOP) {
            this.Y_TILES = Math.max(this.Y_TILES, MACOS_MIN_ALONG_TILES);
        } else {
            this.X_TILES = Math.max(this.X_TILES, MACOS_MIN_ALONG_TILES);
        }
    }

    // how far the window sides have moved toward the icon at position s (0 = far edge, 1 = icon)
    genieCurve(s) {
        let t = Math.min(1, Math.max(0, (s - MACOS_NECK_START) / (MACOS_NECK_END - MACOS_NECK_START)));
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    deformVertexMacos(w, h, v) {
        let propX = w / this.window.width;
        let propY = h / this.window.height;

        if (!this.genie) {
            let p = this.macosProgress;
            let targetX = this.icon.x - this.window.x;
            let targetY = this.icon.y - this.window.y;
            v.x = (v.tx * this.window.width * (1 - p) + targetX * p) * propX;
            v.y = (v.ty * this.window.height * (1 - p) + targetY * p) * propY;
            return;
        }

        let g = this.genie;
        let u, s;
        if (this.iconPosition == St.Side.BOTTOM) {
            u = v.tx; s = v.ty;
        } else if (this.iconPosition == St.Side.TOP) {
            u = v.tx; s = 1 - v.ty;
        } else if (this.iconPosition == St.Side.LEFT) {
            u = v.ty; s = 1 - v.tx;
        } else {
            u = v.ty; s = v.tx;
        }

        // the window occupies aTop..aBottom of the funnel: the bend pulls the near edge
        // to the icon, the slide then moves the far edge down the funnel after it
        let aTop = this.j * g.len;
        let aBottom = g.span + this.k * (g.len - g.span);
        let a = aTop + s * (aBottom - aTop);

        let bend = this.k * this.genieCurve(a / g.len);
        let left = g.c0 + (g.ic0 - g.c0) * bend;
        let right = g.c1 + (g.ic1 - g.c1) * bend;
        let c = left + u * (right - left);

        let x, y;
        if (this.iconPosition == St.Side.BOTTOM) {
            x = c - this.window.x; y = a;
        } else if (this.iconPosition == St.Side.TOP) {
            x = c - this.window.x; y = this.window.height - a;
        } else if (this.iconPosition == St.Side.LEFT) {
            x = this.window.width - a; y = c - this.window.y;
        } else {
            x = a; y = c - this.window.y;
        }

        v.x = x * propX;
        v.y = y * propY;
    }

    vfunc_deform_vertex(w, h, v) {
        if (this.initialized && this.EFFECT === 'macos') {
            this.deformVertexMacos(w, h, v);
            return;
        }

        if (this.initialized) {
            let propX = w / this.window.width;
            let propY = h / this.window.height;

            if (this.iconPosition == St.Side.LEFT) {
                this.width = this.window.width - this.icon.width + this.window.x * this.k;

                this.x = (this.width - this.j * this.width) * v.tx;  
                this.y = v.ty * this.window.height * (this.x + (this.width - this.x) * (1 - this.k)) / this.width + 
                        v.ty * this.icon.height * (this.width - this.x) / this.width;

                this.offsetX = this.icon.width - this.window.x * this.k;
                this.offsetY = (this.icon.y - this.window.y) * ((this.width - this.x) / this.width) * this.k;

                if (this.EFFECT === 'sine') {
                    this.effectY = Math.sin(this.x / this.width * Math.PI * 4) * this.window.height / 14 * this.k;
                } else {
                    this.effectY = Math.sin((0.5 - (this.width - this.x) / this.width) * 2 * Math.PI) * (this.window.y + this.window.height * v.ty - (this.icon.y + this.icon.height * v.ty)) / 7 * this.k;
                }
            } else if (this.iconPosition == St.Side.TOP) {
                this.height = this.window.height - this.icon.height + this.window.y * this.k;

                this.y = (this.height - this.j * this.height) * v.ty;
                this.x = v.tx * this.window.width * (this.y + (this.height - this.y) * (1 - this.k)) / this.height + 
                        v.tx * this.icon.width * (this.height - this.y) / this.height;

                this.offsetX = (this.icon.x - this.window.x) * ((this.height - this.y) / this.height) * this.k;
                this.offsetY = this.icon.height - this.window.y * this.k;

                if (this.EFFECT === 'sine') {
                    this.effectX = Math.sin(this.y / this.height * Math.PI * 4) * this.window.width / 14 * this.k;
                } else {
                    this.effectX = Math.sin((0.5 - (this.height - this.y) / this.height) * 2 * Math.PI) * (this.window.x + this.window.width * v.tx - (this.icon.x + this.icon.width * v.tx)) / 7 * this.k;
                }
            } else if (this.iconPosition == St.Side.RIGHT) {
                this.expandWidth = (this.iconMonitor.width - this.icon.width - this.window.x - this.window.width);
                this.fullWidth = (this.iconMonitor.width - this.icon.width - this.window.x) - this.expandWidth * (1 - this.k);
                this.width = this.fullWidth - this.j * this.fullWidth;

                this.x = v.tx * this.width;
                this.y = v.ty * (this.icon.height) +
                        v.ty * (this.window.height - this.icon.height) * (1 - this.j) * (1 - v.tx) +
                        v.ty * (this.window.height - this.icon.height) * (1 - this.k) * (v.tx);
                
                this.offsetY = (this.icon.y - this.window.y) * (this.x / this.fullWidth) * this.k + (this.icon.y - this.window.y) * this.j;
                this.offsetX = this.iconMonitor.width - this.icon.width - this.window.x - this.width - this.expandWidth * (1 - this.k);
                
                if (this.EFFECT === 'sine') {
                    this.effectY = Math.sin((this.width - this.x) / this.fullWidth * Math.PI * 4) * this.window.height / 14 * this.k;
                } else {
                    this.effectY = Math.sin(((this.width - this.x) / this.fullWidth) * 2 * Math.PI + Math.PI) * (this.window.y + this.window.height * v.ty - (this.icon.y + this.icon.height * v.ty)) / 7 * this.k;
                }
            } else if (this.iconPosition == St.Side.BOTTOM) {
                this.expandHeight = (this.iconMonitor.height - this.icon.height - this.window.y - this.window.height);
                this.fullHeight = (this.iconMonitor.height - this.icon.height - this.window.y) - this.expandHeight * (1 - this.k);
                this.height = this.fullHeight - this.j * this.fullHeight;
                
                this.y = v.ty * this.height;
                this.x = v.tx * (this.icon.width) +
                        v.tx * (this.window.width - this.icon.width) * (1 - this.j) * (1 - v.ty) +
                        v.tx * (this.window.width - this.icon.width) * (1 - this.k) * (v.ty);

                this.offsetX = (this.icon.x - this.window.x) * (this.y / this.fullHeight) * this.k + (this.icon.x - this.window.x) * this.j;
                this.offsetY = this.iconMonitor.height - this.icon.height - this.window.y - this.height - this.expandHeight * (1 - this.k);

                if (this.EFFECT === 'sine') {
                    this.effectX = Math.sin((this.height - this.y) / this.fullHeight * Math.PI * 4) * this.window.width / 14 * this.k;
                } else {
                    this.effectX = Math.sin(((this.height - this.y) / this.fullHeight) * 2 * Math.PI + Math.PI) * (this.window.x + this.window.width * v.tx - (this.icon.x + this.icon.width * v.tx)) / 7 * this.k;
                }
            }
            
            v.x = (this.x + this.offsetX + this.effectX) * propX;
            v.y = (this.y + this.offsetY + this.effectY) * propY;
        }    
    }
}

class MagicLampMinimizeEffect extends AbstractCommonMagicLampEffect {
    static {
        GObject.registerClass(this);
    }
       
    _init(params = {}) {
        super._init(params);

        this.k = 0;
        this.j = 0;
        this.isMinimizeEffect = true;
    
    }

    destroy_actor(actor) {
        Main.wm._shellwm.original_completed_minimize(actor);
    }

    on_tick_elapsed(timer, msecs) {
        if (Main.overview.visible) {
            this.destroy();
        }

        this.progress = this.easeProgress(timer.get_progress());
        this.updatePhases(this.progress);

        this.actor.get_parent().queue_redraw();
        this.invalidate();
    }

    vfunc_modify_paint_volume(pv) {
        return false;
    }
}
    
class MagicLampUnminimizeEffect extends AbstractCommonMagicLampEffect {
    static {
        GObject.registerClass(this);
    }

    _init(params = {}) {
        super._init(params);

        this.k = 1;
        this.j = 1;
        this.isMinimizeEffect = false;
    }
    
    destroy_actor(actor) {
        Main.wm._shellwm.original_completed_unminimize(actor);
    }

    on_tick_elapsed(timer, msecs) {
        if (Main.overview.visible) {
            this.destroy();
        }   

        this.progress = this.easeProgress(timer.get_progress());
        this.updatePhases(1 - this.progress);

        this.actor.get_parent().queue_redraw();
        this.invalidate();
    }

    vfunc_modify_paint_volume(pv) {
        return false;
    }
}