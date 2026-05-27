#!/bin/bash
# deploy.sh - Deploy Alisha to VPS server
# Run this script on the VPS server (alisha.dpdns.org)
# This will pull the latest code from GitHub and restart the service
#
# IMPORTANT: Before running, create .env.local with your API keys!
# See .env.example for required variables.

set -e

echo "🚀 Alisha Deployment Script"
echo "==========================="

PROJECT_DIR="${1:-/root/Alisha}"
REPO_URL="https://github.com/magengillan00-lgtm/Alisha.git"

# Step 1: Navigate to project directory
cd "$PROJECT_DIR" || {
  echo "📁 Project directory not found. Cloning..."
  git clone "$REPO_URL" "$PROJECT_DIR"
  cd "$PROJECT_DIR"
}

# Step 2: Pull latest changes
echo "📥 Pulling latest changes from GitHub..."
git fetch origin
git reset --hard origin/main

# Step 3: Check for .env.local
if [ ! -f .env.local ]; then
  echo "⚠️  .env.local not found!"
  echo "📋 Creating from .env.example - you MUST fill in your API keys!"
  cp .env.example .env.local
  echo "❌ Please edit .env.local with your API keys, then re-run this script."
  exit 1
fi

# Step 4: Install dependencies
echo "📦 Installing dependencies..."
npm install 2>/dev/null || bun install

# Step 5: Build the project
echo "🏗️ Building project..."
npm run build 2>/dev/null || bun run build

# Step 6: Restart the service
echo "🔄 Restarting service..."
if command -v pm2 &> /dev/null; then
  pm2 restart alisha 2>/dev/null || pm2 start npm --name alisha -- start
elif [ -f "ecosystem.config.js" ]; then
  pm2 start ecosystem.config.js
else
  pm2 start npm --name alisha -- start
fi

echo "✅ Deployment complete!"
echo "🌐 Visit: https://alisha.dpdns.org"
echo "==========================="
