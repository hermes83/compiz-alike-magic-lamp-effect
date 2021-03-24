'use strict';

const Main = imports.ui.main;
const { Gdk, GObject, Clutter, Meta, St } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const Settings = Extension.imports.settings;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.commonUtils;
const MonitorUtils = Me.imports.monitorUtils;

const EPSILON = 50;

var AbstractCommonEffect = GObject.registerClass({},
    class AbstractCommonEffect extends Clutter.DeformEffect {

        _init(params = {}) {
            super._init();

            this.paintEvent = null;
            this.newFrameEvent = null;
            this.completedEvent = null;
            
            this.timerId = null;
            this.msecs = 0;

            this.monitor = {x: 0, y: 0, width: 0, height: 0};
            this.window = {x: 0, y: 0, width: 0, height: 0};
            this.icon = params.icon;
            
            this.monitorConfiguration = new MonitorUtils.MonitorConfiguration();
            this.scale = 1;
            
            this.j = 0;
            this.width = 0;
            this.height = 0;
            this.x = 0;
            this.y = 0;
            this.offsetX = 0;
            this.offsetY = 0;
            this.effectX = 0;
            this.effectY = 0;
            
            this.iconPosition = null;

            let prefs = (new Settings.Prefs());
            this.DURATION = prefs.DURATION.get();
            this.X_TILES = prefs.X_TILES.get();
            this.Y_TILES = prefs.Y_TILES.get();
        }

        destroyActor(actor) {}

        on_tick_elapsed(timer, msecs) {}

        destroy() {
            let actor = this.get_actor();
            if (actor) {
                if (this.paintEvent) {
                    actor.disconnect(this.paintEvent);
                    this.paintEvent = null;
                }
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

            if (actor) {
                let currentMonitor = this.monitorConfiguration.getCurrentMonitorGeometry();
                this.scale = this.monitorConfiguration.getScale(actor);

                [this.monitor.x, this.monitor.y, this.monitor.width, this.monitor.height] = [currentMonitor.x, currentMonitor.y, currentMonitor.width, currentMonitor.height];
                [this.window.x, this.window.y, this.window.width, this.window.height] = [actor.get_x() - currentMonitor.x, actor.get_y() - currentMonitor.y, actor.get_width(), actor.get_height()];
                [this.icon.x, this.icon.y, this.icon.width, this.icon.height] = [this.icon.x - currentMonitor.x, this.icon.y - currentMonitor.y, this.icon.width, this.icon.height];

                if (this.icon.x <= EPSILON) {
                    this.iconPosition = St.Side.LEFT;
                } else if (this.icon.y <= EPSILON) {
                    this.iconPosition = St.Side.TOP;
                } else if (this.icon.x >= this.monitor.width - EPSILON) {
                    this.iconPosition = St.Side.RIGHT;
                } else {
                    this.iconPosition = St.Side.BOTTOM;
                }

                this.set_n_tiles(this.X_TILES, this.Y_TILES);
            
                this.paintEvent = actor.connect('paint', () => {});
                
                if (Utils.is_old_shell_versions()) {
                    this.timerId = new Clutter.Timeline();
                } else {
                    this.timerId = new Clutter.Timeline({ actor: actor });
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
        }

        vfunc_deform_vertex(w, h, v) {
            if (this.iconPosition == St.Side.LEFT) {
                this.width = this.window.x + this.window.width - this.icon.width;
                this.x = (this.width - this.j * this.width) * v.tx;
                this.y = v.ty * this.window.height * this.x / this.width + v.ty * this.icon.height * (this.width - this.x) / this.width;
                this.offsetX = this.icon.width - this.window.x;
                this.offsetY = (this.icon.y - this.window.y) * ((this.width - this.x) / this.width);
                this.effectY = Math.sin(this.x / this.width * Math.PI * 4) * this.window.height / 14;

            } else if (this.iconPosition == St.Side.TOP) {
                this.height = this.window.y + this.window.height - this.icon.height;
                this.y = (this.height - this.j * this.height) * v.ty;
                this.x = v.tx * this.window.width * this.y / this.height + v.tx * this.icon.width * (this.height - this.y) / this.height;
                this.offsetX = (this.icon.x - this.window.x) * ((this.height - this.y) / this.height);
                this.offsetY = this.icon.height - this.window.y;
                this.effectX = Math.sin(this.y / this.height * Math.PI * 4) * this.window.width / 14;

            } else if (this.iconPosition == St.Side.RIGHT) {
                this.width = this.monitor.width - this.window.x - this.icon.width;
                this.x = this.monitor.width - this.icon.width - (this.width - this.j * this.width) * (1 - v.tx) - this.window.x;
                this.y = v.ty * this.window.height * (this.width - this.x) / this.width + v.ty * this.icon.height * this.x / this.width;
                this.offsetY = (this.icon.y - this.window.y) * (this.x / this.width);
                this.effectY = Math.sin(this.x / this.width * Math.PI * 4) * this.window.height / 14;

            } else if (this.iconPosition == St.Side.BOTTOM) {
                this.height = this.monitor.height - this.window.y - this.icon.height;
                this.y = this.monitor.height - this.icon.height - (this.height - this.j * this.height) * (1 - v.ty) - this.window.y;
                this.x = v.tx * this.window.width * (this.height - this.y) / this.height + v.tx * this.icon.width * this.y / this.height;
                this.offsetX = (this.icon.x - this.window.x) * (this.y / this.height);                
                this.effectX = Math.sin(this.y / this.height * Math.PI * 4) * this.window.width / 14;
            }
            
            v.x = (this.x + this.offsetX + this.effectX) * this.scale;
            v.y = (this.y + this.offsetY + this.effectY) * this.scale;
        }
    }
);

var MagicLampMinimizeEffect = GObject.registerClass({},
    class MagicLampMinimizeEffect extends AbstractCommonEffect {
        destroyActor(actor) {
            Main.wm._shellwm.original_completed_minimize(actor);
        }

        on_tick_elapsed(timer, msecs) {
            this.j = timer.get_progress();
            this.invalidate();
        }
    }
);

var MagicLampUnminimizeEffect = GObject.registerClass({},
    class MagicLampUnminimizeEffect extends AbstractCommonEffect {
        destroyActor(actor) {
            Main.wm._shellwm.original_completed_unminimize(actor);
        }

        on_tick_elapsed(timer, msecs) {
            this.j = 1 - timer.get_progress();
            this.invalidate();
        }
    }
);