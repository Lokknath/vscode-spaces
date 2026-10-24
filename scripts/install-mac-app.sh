#!/usr/bin/env bash
#
# Build, Assemble, Sign, and Install "VS Code Spaces.app" to /Applications
#

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="/Applications/VS Code Spaces.app"
USER_APP_DIR="$HOME/Applications/VS Code Spaces.app"

echo "==> 1. Ensuring Spaces icon is generated..."
if [ ! -f "$ROOT/resources/darwin/CodeSpaces.icns" ]; then
    python3 "$ROOT/resources/darwin/generate-spaces-icon.py"
fi

echo "==> 2. Preparing /Applications/VS Code Spaces.app..."
TARGET_DIR="$APP_DIR"
if [ ! -w "/Applications" ]; then
    echo "Notice: /Applications is not directly writable, falling back to $USER_APP_DIR"
    mkdir -p "$HOME/Applications"
    TARGET_DIR="$USER_APP_DIR"
fi

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR/Contents/MacOS"
mkdir -p "$TARGET_DIR/Contents/Resources"

# Locate source Electron app bundle
ELECTRON_APP="$ROOT/.build/electron/VS Code Spaces.app"
if [ ! -d "$ELECTRON_APP" ]; then
    ELECTRON_APP="$ROOT/.build/electron/Code - OSS.app"
fi

if [ ! -d "$ELECTRON_APP" ]; then
    echo "Error: Electron build app not found at $ELECTRON_APP. Run npm run electron first." >&2
    exit 1
fi

echo "==> 2. Installing native VS Code Spaces.app from $ELECTRON_APP..."
rm -rf "$TARGET_DIR"
cp -R "$ELECTRON_APP" "$TARGET_DIR"

# Copy custom Spaces icon
cp "$ROOT/resources/darwin/CodeSpaces.icns" "$TARGET_DIR/Contents/Resources/CodeSpaces.icns"

# Configure Info.plist with Spaces identity
PLIST="$TARGET_DIR/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleName VS Code Spaces" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleName string \"VS Code Spaces\"" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName VS Code Spaces" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string \"VS Code Spaces\"" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.visualstudio.code.spaces" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.visualstudio.code.spaces" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile CodeSpaces.icns" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string CodeSpaces.icns" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString 1.145.0" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string 1.145.0" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion 1.145.0" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleVersion string 1.145.0" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :NSSupportsAutomaticGraphicsSwitching true" "$PLIST" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :NSSupportsAutomaticGraphicsSwitching bool true" "$PLIST"

# Configure application root with clean bootstrap loader (avoiding external symlinks that break macOS codesign)
rm -f "$TARGET_DIR/Contents/Resources/default_app.asar"
rm -rf "$TARGET_DIR/Contents/Resources/app"
mkdir -p "$TARGET_DIR/Contents/Resources/app"

cat << EOF > "$TARGET_DIR/Contents/Resources/app/package.json"
{
  "name": "code-spaces",
  "version": "1.145.0",
  "main": "./bootstrap.js"
}
EOF

cat << EOF > "$TARGET_DIR/Contents/Resources/app/bootstrap.js"
const path = require('path');
const appRoot = '$ROOT';
process.env.VSCODE_DEV = '1';
import(path.join(appRoot, 'out/main.js'));
EOF

echo "==> 3. Applying ad-hoc codesign signature..."
codesign --force --deep -s - "$TARGET_DIR"

echo "==> 4. Registering with macOS LaunchServices & Spotlight..."
mdimport "$TARGET_DIR" 2>/dev/null || true
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
if [ -f "$LSREGISTER" ]; then
    "$LSREGISTER" -f "$TARGET_DIR" || true
fi

echo "==> 5. Installing CLI launcher 'code-spaces'..."
for BIN_DIR in "$HOME/.local/bin" "/usr/local/bin"; do
    if [ -d "$BIN_DIR" ] && [ -w "$BIN_DIR" ]; then
        ln -sf "$ROOT/code-spaces" "$BIN_DIR/code-spaces" 2>/dev/null || cp -f "$ROOT/code-spaces" "$BIN_DIR/code-spaces"
        chmod +x "$BIN_DIR/code-spaces"
        echo "Installed CLI tool to: $BIN_DIR/code-spaces"
        break
    fi
done

echo ""
echo "============================================================"
echo "  SUCCESS! VS Code Spaces.app installed at:"
echo "  $TARGET_DIR"
echo "============================================================"
echo "You can now:"
echo "  1. Launch 'VS Code Spaces' from Spotlight (Cmd + Space)"
echo "  2. Drag and drop project folders onto the Dock icon"
echo "  3. Run 'code-spaces <folder>' from any terminal"
echo "============================================================"
