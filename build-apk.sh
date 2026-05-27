#!/bin/bash
# build-apk.sh - Build Android APK for Alisha
# Temporarily switches next.config.ts to output: "export", builds static files,
# copies to Capacitor android directory, builds APK with gradle, then restores output: "standalone"

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
NEXT_CONFIG="$PROJECT_DIR/next.config.ts"
JDK_PATH="/tmp/jdk-21.0.3"

echo "🔨 Alisha APK Build Script"
echo "========================="

# Step 1: Switch next.config.ts to output: "export"
echo "📝 Switching next.config.ts to output: export..."
sed -i 's/output: "standalone"/output: "export"/g' "$NEXT_CONFIG"

# Restore on exit
restore_config() {
  echo "📝 Restoring next.config.ts to output: standalone..."
  sed -i 's/output: "export"/output: "standalone"/g' "$NEXT_CONFIG"
}
trap restore_config EXIT

# Step 2: Install dependencies
echo "📦 Installing dependencies..."
cd "$PROJECT_DIR"
bun install

# Step 3: Build static files
echo "🏗️ Building static files..."
bun run build

# Step 4: Copy to Capacitor android directory
echo "📋 Copying static files to Capacitor..."
npx cap sync android

# Step 5: Build APK with gradle
echo "🤖 Building APK with Gradle..."
export JAVA_HOME="$JDK_PATH"
export PATH="$JAVA_HOME/bin:$PATH"

cd "$PROJECT_DIR/android"
chmod +x gradlew
./gradlew assembleDebug

# Step 6: Show result
APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
  echo "✅ APK built successfully!"
  echo "📱 APK location: $APK_PATH"
  ls -lh "$APK_PATH"
else
  echo "❌ APK build failed - file not found"
  exit 1
fi

echo "========================="
echo "🎉 Build complete!"
