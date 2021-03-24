
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

const Meta = imports.gi.Meta;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Config = imports.misc.config;

const IS_3_XX_SHELL_VERSION = Config.PACKAGE_VERSION.startsWith("3");
const IS_3_38_SHELL_VERSION = Config.PACKAGE_VERSION.startsWith("3.38");
const HAS_GLOBAL_DISPLAY = !Config.PACKAGE_VERSION.startsWith("3.28");

const MINIMIZE_EFFECT_NAME = 'minimize-magic-lamp-effect';
const UNMINIMIZE_EFFECT_NAME = 'unminimize-magic-lamp-effect';

const Effects = IS_3_XX_SHELL_VERSION ? Me.imports.effects3 : Me.imports.effects;

var is_3_xx_shell_version = function () {
    return IS_3_XX_SHELL_VERSION;
}

var is_3_38_shell_version = function () {
    return IS_3_38_SHELL_VERSION;
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