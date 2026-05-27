#!/bin/bash
# Build APK for Alisha app
# This script builds the static export for Capacitor and creates the Android APK

set -e

echo "🔧 Building Alisha APK..."

cd /home/z/my-project

# Step 1: Save original next.config.ts
echo "📦 Preparing build environment..."
cp next.config.ts next.config.ts.backup

# Step 2: Temporarily move API routes out (they're not needed for static export)
mkdir -p /tmp/alisha-api-backup
mv src/app/api /tmp/alisha-api-backup/ 2>/dev/null || true

# Step 3: Create export config
cat > next.config.ts << 'NEXTCONFIG'
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
NEXTCONFIG

# Step 4: Build static export
echo "🏗️ Building static export..."
rm -rf out
npx next build

# Step 5: Restore original config and API routes
echo "📦 Restoring project files..."
cp next.config.ts.backup next.config.ts
rm next.config.ts.backup
mv /tmp/alisha-api-backup/api src/app/api 2>/dev/null || true
rm -rf /tmp/alisha-api-backup

# Step 6: Add Capacitor Android platform if not exists
echo "📱 Setting up Capacitor Android..."
if [ ! -d "android" ]; then
  npx cap add android
fi

# Step 7: Sync with Capacitor
echo "🔄 Syncing with Capacitor..."
npx cap sync android

# Step 8: Build APK
echo "🔨 Building Android APK..."
export ANDROID_HOME=/home/z/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

cd android
chmod +x gradlew
./gradlew assembleDebug 2>&1 | tail -20

# Step 9: Find and copy APK
APK_PATH=$(find . -name "*.apk" -path "*/debug/*" | head -1)
if [ -n "$APK_PATH" ]; then
  VERSION=$(grep versionName app/src/main/AndroidManifest.xml 2>/dev/null | head -1 || echo "1.0")
  DEST="/home/z/my-project/download/Alisha-v2.0.0-multi-provider.apk"
  cp "$APK_PATH" "$DEST"
  echo "✅ APK built successfully: $DEST"
else
  echo "❌ APK not found!"
  exit 1
fi

cd /home/z/my-project
echo "🎉 Build complete!"
