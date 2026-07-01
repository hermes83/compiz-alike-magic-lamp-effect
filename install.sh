#!/bin/bash
set -e

UUID="compiz-alike-magic-lamp-effect@hermes83.github.com"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing: $UUID"
mkdir -p "$INSTALL_DIR"

cp extension.js      "$INSTALL_DIR/"
cp metadata.json     "$INSTALL_DIR/"
cp prefs.js          "$INSTALL_DIR/"
cp settings_data.js  "$INSTALL_DIR/"
cp -r schemas/       "$INSTALL_DIR/"

glib-compile-schemas "$INSTALL_DIR/schemas" &>/dev/null

echo "Done. Files installed to: $INSTALL_DIR"
echo ""
echo "To activate:"
echo "  X11:     Alt+F2, type 'r', Enter"
echo "  Wayland: Log out and log back in"
echo ""
gnome-extensions enable "$UUID" 2>/dev/null && echo "Extension enabled" || echo "Enable manually with: gnome-extensions enable $UUID"
