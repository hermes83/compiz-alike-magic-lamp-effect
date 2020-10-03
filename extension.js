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
	Main.wm.original_shouldAnimateActor = Main.wm._shouldAnimateActor;
	Main.wm._shouldAnimateActor = function(actor, types) {
		let stack = new Error().stack;
		if (stack && (stack.indexOf("_minimizeWindow") !== -1 || stack.indexOf("_unminimizeWindow") !== -1)) {
			return false;
		}
		
		return Main.wm.original_shouldAnimateActor(actor, types);
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
		let [success, icon] = actor.meta_window.get_icon_geometry();
		if (success) {
			Utils.destroy_actor_magic_lamp_minimize_effect(actor);
			Utils.destroy_actor_magic_lamp_unminimize_effect(actor);

			Utils.add_actor_magic_lamp_minimize_effect(actor, icon);
		}
	});

	unminimizeId = global.window_manager.connect("unminimize", (e, actor) => {
		actor.show();

		let [success, icon] = actor.meta_window.get_icon_geometry();
		if (success) {
			Utils.destroy_actor_magic_lamp_minimize_effect(actor);
			Utils.destroy_actor_magic_lamp_unminimize_effect(actor);

			Utils.add_actor_magic_lamp_unminimize_effect(actor, icon);
		}
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
	
	if (Main.wm.original_shouldAnimateActor) {
		Main.wm._shouldAnimateActor = Main.wm.original_shouldAnimateActor;
		Main.wm.original_shouldAnimateActor = null;
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