'use strict';

const Meta = imports.gi.Meta;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Effects = Me.imports.effects;
const Config = imports.misc.config;

const IS_OLD_SHELL_VERSIONS = Config.PACKAGE_VERSION.startsWith("3.36") ||
        Config.PACKAGE_VERSION.startsWith("3.34") ||
        Config.PACKAGE_VERSION.startsWith("3.32") ||
        Config.PACKAGE_VERSION.startsWith("3.30") ||
        Config.PACKAGE_VERSION.startsWith("3.28");

const HAS_GLOBAL_DISPLAY = !Config.PACKAGE_VERSION.startsWith("3.28");

const MINIMIZE_EFFECT_NAME = 'minimize-magic-lamp-effect';
const UNMINIMIZE_EFFECT_NAME = 'unminimize-magic-lamp-effect';

var is_old_shell_versions = function () {
    return IS_OLD_SHELL_VERSIONS;
}

var has_global_display = function () {
    return HAS_GLOBAL_DISPLAY;
}

var add_actor_magic_lamp_minimize_effect = function (actor, icon) { 
    if (actor) {
        actor.add_effect_with_name(MINIMIZE_EFFECT_NAME, new Effects.MagicLampMinimizeEffect({icon: icon}));
    }
}

var add_actor_magic_lamp_unminimize_effect = function (actor, icon) { 
    if (actor) {
        actor.add_effect_with_name(UNMINIMIZE_EFFECT_NAME, new Effects.MagicLampUnminimizeEffect({icon: icon}));
    }
}

var destroy_actor_magic_lamp_minimize_effect = function (actor) {
    if (actor) {
        let minimizeEffect = actor.get_effect(MINIMIZE_EFFECT_NAME);
        if (minimizeEffect) {
            minimizeEffect.destroy();
        }
    }
}

var destroy_actor_magic_lamp_unminimize_effect = function (actor) {
    if (actor) {
        let unminimizeEffect = actor.get_effect(UNMINIMIZE_EFFECT_NAME);
        if (unminimizeEffect) {
            unminimizeEffect.destroy();
        }
    }
}