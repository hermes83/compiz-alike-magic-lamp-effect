
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

const Main = imports.ui.main;
const { Gdk, GObject, Clutter, Meta, St } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const Settings = Extension.imports.settings;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.commonUtils;
const MonitorUtils = Me.imports.monitorUtils;

const EPSILON = 40;

var AbstractCommonMagicLampEffect = GObject.registerClass({},
    class AbstractCommonMagicLampEffect extends Clutter.DeformEffect {

        _init(params = {}) {
            super._init();

            this.isMinimizeEffect = false;
            this.newFrameEvent = null;
            this.completedEvent = null;
            
            this.timerId = null;
            this.msecs = 0;

            this.monitor = {x: 0, y: 0, width: 0, height: 0};
            this.window = {x: 0, y: 0, width: 0, height: 0};
            this.icon = params.icon;
            
            this.monitorConfiguration = new MonitorUtils.MonitorConfiguration();
            this.scale = 1;
            
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

            this.toTheBorder = false;   // true
            this.maxIconSize = null;    // 48
            this.alignIcon = 'center';  // 'left-top'

            let prefs = (new Settings.Prefs());
            this.EFFECT = prefs.EFFECT.get(); //'default' - 'sine'
            this.DURATION = prefs.DURATION.get();
            this.X_TILES = prefs.X_TILES.get();
            this.Y_TILES = prefs.Y_TILES.get();

            this.initialized = false;
        }

        destroyActor(actor) {}

        on_tick_elapsed(timer, msecs) {}

        destroy() {
            let actor = this.get_actor();
            if (actor) {
                if (this.newFrameEvent) {
                    this.newFrameEvent = null;
                }
                if (this.completedEvent) {
                    this.completedEvent = null;
                }
                actor.remove_effect(this);

                this.destroyActor(actor);
            }
        }

        vfunc_set_actor(actor) {
            super.vfunc_set_actor(actor);
        }

        vfunc_post_paint(paintNode, paintContext) {
            super.vfunc_post_paint(paintNode, paintContext);

            if (!this.initialized && this.actor) {
                let [success, pv_width, pv_height] = this.get_target_size();
                if (success) {
                    this.initialized = true;
    
                    this.initialize_effect(pv_width, pv_height);
                }
            }
        }

        vfunc_modify_paint_volume(pv) {
            return false;
        }

        initialize_effect(width, height) {
            let currentMonitor = this.monitorConfiguration.getCurrentMonitorGeometry();
            this.scale = this.monitorConfiguration.getScale(this.actor);

            [this.monitor.x, this.monitor.y, this.monitor.width, this.monitor.height] = [currentMonitor.x, currentMonitor.y, currentMonitor.width, currentMonitor.height];
            [this.window.x, this.window.y, this.window.width, this.window.height] = [this.actor.get_x() - currentMonitor.x, this.actor.get_y() - currentMonitor.y, width, height];
            [this.icon.x, this.icon.y, this.icon.width, this.icon.height] = [this.icon.x - currentMonitor.x, this.icon.y - currentMonitor.y, this.icon.width, this.icon.height];

            if (this.icon.y + this.icon.height >= this.monitor.height - EPSILON) {
                this.iconPosition = St.Side.BOTTOM;
                if (this.maxIconSize) {
                    if (this.alignIcon && this.alignIcon == 'left-top') {
                        this.icon.x = this.icon.x;
                    } else if (this.alignIcon && this.alignIcon == 'right-bottom') {
                        this.icon.x = this.icon.x + this.icon.width - this.maxIconSize;
                    } else {
                        this.icon.x = this.icon.x + this.icon.width / 2 - this.maxIconSize / 2;
                    }
                    this.icon.width = this.maxIconSize;
                }
                if (this.toTheBorder) {
                    this.icon.height = 0;
                }
            } else if (this.icon.x <= EPSILON) {
                this.iconPosition = St.Side.LEFT;
                if (this.maxIconSize) {
                    if (this.alignIcon && this.alignIcon == 'left-top') {
                        this.icon.y = this.icon.y;
                    } else if (this.alignIcon && this.alignIcon == 'right-bottom') {
                        this.icon.x = this.icon.y + this.icon.height - this.maxIconSize;
                    } else {
                        this.icon.y = this.icon.y + this.icon.height / 2 - this.maxIconSize / 2;
                    }
                    this.icon.height = this.maxIconSize;
                }
                if (this.toTheBorder) {
                    this.icon.width = 0;
                }
            } else if (this.icon.x + this.icon.width >= this.monitor.width - EPSILON) {
                this.iconPosition = St.Side.RIGHT;
                if (this.maxIconSize) {
                    if (this.alignIcon && this.alignIcon == 'left-top') {
                        this.icon.y = this.icon.y;
                    } else if (this.alignIcon && this.alignIcon == 'right-bottom') {
                        this.icon.x = this.icon.y + this.icon.height - this.maxIconSize;
                    } else {
                        this.icon.y = this.icon.y + this.icon.height / 2 - this.maxIconSize / 2;
                    }
                    this.icon.height = this.maxIconSize;
                }
                if (this.toTheBorder) {
                    this.icon.width = 0;
                }
            } else {
                this.iconPosition = St.Side.TOP;
                if (this.maxIconSize) {
                    if (this.alignIcon && this.alignIcon == 'left-top') {
                        this.icon.x = this.icon.x;
                    } else if (this.alignIcon && this.alignIcon == 'right-bottom') {
                        this.icon.x = this.icon.x + this.icon.width - this.maxIconSize;
                    } else {
                        this.icon.x = this.icon.x + this.icon.width / 2 - this.maxIconSize / 2;
                    }
                    this.icon.width = this.maxIconSize;
                }
                if (this.toTheBorder) {
                    this.icon.height = 0;
                }
            } 

            this.set_n_tiles(this.X_TILES, this.Y_TILES);
            
            if (Utils.is_3_xx_shell_version() && !Utils.is_3_38_shell_version()) {
                this.timerId = new Clutter.Timeline();
            } else {
                this.timerId = new Clutter.Timeline({ actor: this.actor });
            }

            this.timerId.set_duration(
                this.DURATION +
                (this.monitor.width * this.monitor.height) /
                (this.window.width * this.window.height)
            );

            this.newFrameEvent = this.timerId.connect('new-frame', this.on_tick_elapsed.bind(this));
            this.completedEvent = this.timerId.connect('completed', this.destroy.bind(this));
            this.timerId.start();
        }

        vfunc_deform_vertex(w, h, v) {
            if (!this.initialized) {
                if (!this.isMinimizeEffect) {
                    v.x = 0;
                    v.y = 0;
                }
            } else {
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
                    this.expandWidth = (this.monitor.width - this.icon.width - this.window.x - this.window.width);
                    this.fullWidth = (this.monitor.width - this.icon.width - this.window.x) - this.expandWidth * (1 - this.k);
                    this.width = this.fullWidth - this.j * this.fullWidth;

                    this.x = v.tx * this.width;
                    this.y = v.ty * (this.icon.height) +
                            v.ty * (this.window.height - this.icon.height) * (1 - this.j) * (1 - v.tx) +
                            v.ty * (this.window.height - this.icon.height) * (1 - this.k) * (v.tx);
                    
                    this.offsetY = (this.icon.y - this.window.y) * (this.x / this.fullWidth) * this.k +
                                (this.icon.y - this.window.y) * this.j;
                    this.offsetX = this.monitor.width - this.icon.width - this.window.x - this.width -
                                this.expandWidth * (1 - this.k);
                    
                    if (this.EFFECT === 'sine') {
                        this.effectY = Math.sin((this.width - this.x) / this.fullWidth * Math.PI * 4) * this.window.height / 14 * this.k;
                    } else {
                        this.effectY = Math.sin(((this.width - this.x) / this.fullWidth) * 2 * Math.PI + Math.PI) * (this.window.y + this.window.height * v.ty - (this.icon.y + this.icon.height * v.ty)) / 7 * this.k;
                    }
                } else if (this.iconPosition == St.Side.BOTTOM) {
                    this.expandHeight = (this.monitor.height - this.icon.height - this.window.y - this.window.height);
                    this.fullHeight = (this.monitor.height - this.icon.height - this.window.y) - this.expandHeight * (1 - this.k);
                    this.height = this.fullHeight - this.j * this.fullHeight;
                    
                    this.y = v.ty * this.height;
                    this.x = v.tx * (this.icon.width) +
                            v.tx * (this.window.width - this.icon.width) * (1 - this.j) * (1 - v.ty) +
                            v.tx * (this.window.width - this.icon.width) * (1 - this.k) * (v.ty);

                    this.offsetX = (this.icon.x - this.window.x) * (this.y / this.fullHeight) * this.k +
                                (this.icon.x - this.window.x) * this.j;
                    this.offsetY = this.monitor.height - this.icon.height - this.window.y - this.height -
                                this.expandHeight * (1 - this.k);

                    if (this.EFFECT === 'sine') {
                        this.effectX = Math.sin((this.height - this.y) / this.fullHeight * Math.PI * 4) * this.window.width / 14 * this.k;
                    } else {
                        this.effectX = Math.sin(((this.height - this.y) / this.fullHeight) * 2 * Math.PI + Math.PI) * (this.window.x + this.window.width * v.tx - (this.icon.x + this.icon.width * v.tx)) / 7 * this.k;
                    }
                }
                
                v.x = (this.x + this.offsetX + this.effectX) * this.scale;
                v.y = (this.y + this.offsetY + this.effectY) * this.scale;
            }    
        }
    }
);

var MagicLampMinimizeEffect = GObject.registerClass({},
    class MagicLampMinimizeEffect extends AbstractCommonMagicLampEffect {
        _init(params = {}) {
            super._init(params);

            this.k = 0;
            this.j = 0;
            this.isMinimizeEffect = true;
        }

        destroyActor(actor) {
            Main.wm._shellwm.original_completed_minimize(actor);
        }

        on_tick_elapsed(timer, msecs) {
            if (Main.overview.visible) {
                this.destroy();
            }

            this.progress = timer.get_progress();
            this.k = this.progress <= this.split ? this.progress * (1 / 1 / this.split) : 1;
            this.j = this.progress > this.split ? (this.progress - this.split) * (1 / 1 / (1 - this.split)) : 0;
            this.invalidate();
        }
    }
);

var MagicLampUnminimizeEffect = GObject.registerClass({},
    class MagicLampUnminimizeEffect extends AbstractCommonMagicLampEffect {
        _init(params = {}) {
            super._init(params);

            this.k = 1;
            this.j = 1;
            this.isMinimizeEffect = false;
        }
        
        destroyActor(actor) {
            Main.wm._shellwm.original_completed_unminimize(actor);
        }

        on_tick_elapsed(timer, msecs) {
            if (Main.overview.visible) {
                this.destroy();
            }

            this.progress = timer.get_progress();
            this.k = 1 - (this.progress > (1 - this.split) ? (this.progress - (1 - this.split)) * (1 / 1 / (1 - (1 - this.split))) : 0);
            this.j = 1 - (this.progress <= (1 - this.split) ? this.progress * (1 / 1 / (1 - this.split)) : 1);
            this.invalidate();
        }
    }
);