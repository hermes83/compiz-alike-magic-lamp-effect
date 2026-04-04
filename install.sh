#!/bin/bash

# Compiz-alike Magic Lamp Effect - Installation Script
# This script installs the extension to your local user directory.

UUID="compiz-alike-magic-lamp-effect@hermes83.github.com"
INSTALL_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing the extension: $UUID"

# Create destination directory
mkdir -p "$INSTALL_DIR"

# Copy files (excluding Git, documentation, and specific script files)
rsync -av --progress . "$INSTALL_DIR" \
    --exclude ".git" \
    --exclude ".github" \
    --exclude "README.md" \
    --exclude "CONTRIBUTING.md" \
    --exclude "zip.sh" \
    --exclude "install.sh" \
    --exclude "assets"

# Compile schemas
if [ -d "$INSTALL_DIR/schemas" ]; then
    echo "Compiling GSettings schemas..."
    glib-compile-schemas "$INSTALL_DIR/schemas"
fi

echo "Installation completed!"
echo "To activate the extension:"
echo "1. Restart GNOME Shell (X11: Alt+F2 and type 'r', Wayland: Log out and back in)."
echo "2. Enable the extension using 'Extensions' or 'Extension Manager'."

# Optional: Try to enable it automatically (may fail on some systems)
if command -v gnome-extensions &> /dev/null; then
    echo "Attempting to enable the extension automatically..."
    gnome-extensions enable "$UUID"
fi
