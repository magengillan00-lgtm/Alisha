#!/bin/bash
# build-apk.sh - Build Android APK for Alisha
# Temporarily switches next.config.ts to output: "export",
# moves API routes out of the way (they require server), builds static files,
# copies to Capacitor android directory, builds APK with gradle, then restores everything

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
NEXT_CONFIG="$PROJECT_DIR/next.config.ts"
JDK_PATH="/home/z/my-project/jdk"
API_DIR="$PROJECT_DIR/src/app/api"
API_BACKUP="$PROJECT_DIR/src/app/_api_backup"

echo "🔨 Alisha APK Build Script"
echo "========================="

# Step 1: Switch next.config.ts to output: "export"
echo "📝 Switching next.config.ts to output: export..."
sed -i 's/output: "standalone"/output: "export"/g' "$NEXT_CONFIG"

# Step 2: Move API routes out of the way (they don't work with static export)
echo "📦 Moving API routes out of the way for static export..."
if [ -d "$API_DIR" ]; then
  mkdir -p "$API_BACKUP"
  mv "$API_DIR" "$API_BACKUP/api"
fi

# Restore on exit
restore_config() {
  echo "📝 Restoring next.config.ts to output: standalone..."
  sed -i 's/output: "export"/output: "standalone"/g' "$NEXT_CONFIG"
  
  echo "📦 Restoring API routes..."
  if [ -d "$API_BACKUP/api" ]; then
    mkdir -p "$API_DIR"
    mv "$API_BACKUP/api/"* "$API_DIR/" 2>/dev/null || true
    rmdir "$API_BACKUP/api" 2>/dev/null || true
    rmdir "$API_BACKUP" 2>/dev/null || true
  fi
}
trap restore_config EXIT

# Step 3: Install dependencies
echo "📦 Installing dependencies..."
cd "$PROJECT_DIR"
bun install

# Step 4: Build static files (just next build, not the standalone copy)
echo "🏗️ Building static files..."
npx next build

# Step 5: Copy to Capacitor android directory
echo "📋 Copying static files to Capacitor..."
npx cap sync android

# Step 6: Build APK with gradle
echo "🤖 Building APK with Gradle..."
export JAVA_HOME="$JDK_PATH"
export PATH="$JAVA_HOME/bin:$PATH"

cd "$PROJECT_DIR/android"
chmod +x gradlew
./gradlew assembleDebug

# Step 7: Copy APK to download directory
APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
DOWNLOAD_DIR="/home/z/my-project/download"
if [ -f "$APK_PATH" ]; then
  echo "✅ APK built successfully!"
  echo "📱 APK location: $APK_PATH"
  ls -lh "$APK_PATH"
  
  # Copy to download with versioned name
  cp "$APK_PATH" "$DOWNLOAD_DIR/Alisha-v2.2.0-multi-provider.apk"
  echo "📋 Copied to $DOWNLOAD_DIR/Alisha-v2.2.0-multi-provider.apk"
else
  echo "❌ APK build failed - file not found"
  exit 1
fi

echo "========================="
echo "🎉 Build complete!"
