<div align="center">

<img src="alicia_avatar.png" width="140" alt="Alisha"/>

# 🤖 Alisha AI

### interactive Anime Avatar Assistant with Multi-Provider AI

*Live2D & VRM Anime Avatar • Multi-Language TTS & Voice Input • Multiple AI Backends*

<br/>

[![Live Demo](https://img.shields.io/badge/▶%20Live%20Demo-GitHub%20Pages-ff6b9d?style=for-the-badge&logo=github&logoColor=white)](https://magengillan00-lgtm.github.io/Alisha/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/magengillan00-lgtm/Alisha?style=for-the-badge&color=ff6b9d)](https://github.com/magengillan00-lgtm/Alisha/stargazers)

<br/>

> **Alisha** is a next-generation AI companion — combining live 2D/3D anime avatars with multi-provider artificial intelligence and full Arabic, Japanese, and English language support. Runs directly in the browser with zero installation.

</div>

---

## 🎭 Avatars

<div align="center">

### Live2D — 2D Animated

| | | |
|:---:|:---:|:---:|
| <img src="assets/previews/haru.jpg" width="160" style="border-radius:16px; border:2px solid #ff6b9d;"/><br/>**Haru**<br/><sub>🌸 Pink hair • Casual dress</sub> | <img src="assets/previews/epsilon.jpg" width="160" style="border-radius:16px; border:2px solid #7c83ff;"/><br/>**Epsilon**<br/><sub>❄️ White short hair • Green eyes</sub> | <img src="assets/previews/kei.jpg" width="160" style="border-radius:16px; border:2px solid #4caf50;"/><br/>**Kei**<br/><sub>🍀 Green hair • School uniform</sub> |
| <img src="assets/previews/tsumiki.jpg" width="160" style="border-radius:16px; border:2px solid #607d8b;"/><br/>**Tsumiki**<br/><sub>🎀 Black hair • White dress</sub> | <img src="assets/previews/chino.jpg" width="160" style="border-radius:16px; border:2px solid #3f51b5;"/><br/>**Chino** · 香風智乃<br/><sub>🐰 Long white hair • Blue uniform</sub> | |

### VRM — 3D Full Body

| |
|:---:|
| <img src="assets/previews/waifu3d.jpg" width="200" style="border-radius:16px; border:3px solid #9c27b0;"/><br/>**Waifu 3D**<br/><sub>🐇 Bunny suit • Full body movements • Lip sync</sub> |

</div>

---

## ✨ Features

### 🤖 Multi-Provider AI

| Provider | Model | Speed | Notes |
|----------|-------|-------|-------|
| **Groq** | Llama 3.3 70B | ⚡⚡⚡⚡⚡ | Default, fastest |
| **Gemini** | 2.0 Flash | ⚡⚡⚡ | Via HuggingFace Space |
| **KiloClaw** | Backend | ⚡⚡⚡ | Free fallback |
| **Custom API** | You choose | ⚡⚡⚡⚡⚡ | Pro mode in settings |

**Smart Fallback:** If one provider fails, automatically tries the next one.

### 🌐 Multi-Language Support

| Language | Voice | Notes |
|----------|-------|-------|
| 🇸🇦 **Arabic** | Native TTS | Full Arabic responses |
| 🇺🇸 **English** | Native TTS | English-only responses |
| 🇯🇵 **Japanese** | Native TTS | 日本語完全対応 |

### 🎤 Voice Interaction

- **Microphone Input** — Voice-to-text with automatic language detection
- **Text-to-Speech** — Natural voice output with lip sync
- **Per-Language Voices** — Choose from available system voices

### 🎨 Visual Experience

- Live2D avatars with natural idle animations
- VRM 3D avatar with breathing, arm movements, eye tracking
- Lip sync synchronized with speech
- 3 anime backgrounds: Space 🌌 • Sakura Garden 🌸 • Room 🏠

### ⚙️ Two Modes

| Easy Mode | Pro Mode |
|-----------|----------|
| No API key needed | Add your own API key |
| KiloClaw free backend | Fetch real available models |
| Default models | Test each model before choosing |
| Works out of the box | Full control over AI provider |

---

## 🚀 Getting Started

### Quick Start (No Setup Required)

1. Visit: **[magengillan00-lgtm.github.io/Alisha](https://magengillan00-lgtm.github.io/Alisha/)**
2. Select language, avatar, and background
3. Click "Start" and begin chatting!

### Pro Mode (Custom API)

1. Open **Settings** (⚙️)
2. Scroll to **🔧 Pro Mode** at bottom
3. Enter your API key (Groq/HuggingFace/OpenRouter)
4. Click **Verify** — real models will load
5. Select your preferred model
6. Click **Save**

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│              User Browser                   │
│         GitHub Pages — index.html           │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │   AI Provider     │  ← User selectable
         └─────────┬─────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
  Groq          Gemini        KiloClaw
(Llama 3.3)    (2.0 Flash)    (Backend)
 Default        HF Space       Free
```

---

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Three.js** | 0.177 | 3D VRM rendering |
| **@pixiv/three-vrm** | 3.x | VRM avatar support |
| **PIXI.js** | 6.5 | 2D Live2D rendering |
| **pixi-live2d-display** | 0.4 | Cubism 4 engine |
| **Web Speech API** | Native | TTS + STT |
| **Groq API** | Latest | Llama 3.3 70B |
| **Google Gemini** | 2.0 Flash | Multimodal AI |
| **GitHub Actions** | — | CI/CD + secrets injection |

---

## 📁 Project Structure

```
Alisha/
├── index.html                      # Main application
├── README.md                       # This file
├── LICENSE                         # MIT License
├── memory.json                     # Conversation memory
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD with secret injection
├── assets/
│   ├── models/
│   │   ├── 2d/                     # Live2D models
│   │   │   ├── kei_vowels_pro/
│   │   │   ├── Epsilon_free/
│   │   │   ├── haru/
│   │   │   ├── tsumiki/
│   │   │   └── chino/
│   │   ├── 3d/                     # VRM models
│   │   │   ├── waifu.vrm
│   │   │   └── backgrounds/
│   ├── previews/                   # Avatar screenshots
│   └── audio/
└── (clean build)                   # No legacy files
```

---

## 🔐 Security

- **API keys stored as GitHub Secrets** — Never exposed in source code
- **Injected at build time** via GitHub Actions
- **No conversation data** stored on external servers
- **LocalStorage only** for user preferences

---

## 🎯 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| 🎤 Click bottom button | Voice input (default) |
| 💬 Click top button | Toggle text chat |
| 🎤 In chat mode | Start voice recording |

---

## 📋 Changelog

### v2.2.0 — Pro Mode
- ✅ Add custom API keys in Settings
- ✅ Fetch real available models per provider
- ✅ Better voice recording indicator
- ✅ User name in AI prompts
- ✅ Strong language enforcement

### v2.1.0 — KiloClaw Edition
- ✅ KiloClaw free backend
- ✅ Auto-greeting on first interaction
- ✅ Separate mic input language
- ✅ Better UI controls

### v2.0.0 — Multi-Provider
- ✅ Groq + Gemini + KiloClaw
- ✅ Provider switching
- ✅ Model selection

---

<div align="center">

### 🧑‍💻 Developer

**Magen Gillan** (ميجن غيلان) — The Red King

---

### 📄 License

**MIT** — Free for personal and commercial use

---

### ⭐ Show Your Support

If you like Alisha, give it a star on GitHub!

[![GitHub Stars](https://img.shields.io/github/stars/magengillan00-lgtm/Alisha?style=social)](https://github.com/magengillan00-lgtm/Alisha)

---

*Built with ❤️ using KiloClaw AI*

**Version:** `v2.2.0` — Pro Mode &nbsp;|&nbsp; **Last Updated:** 2026-04-19

</div>