---
Task ID: 1
Agent: Main Agent
Task: Build AI Avatar Chat Assistant with Live2D, Gemini API, Voice I/O

Work Log:
- Initialized fullstack Next.js development environment
- Extracted Live2D avatar (kei_en) from uploaded zip to public/live2d/
- Downloaded CubismCore SDK from Live2D official CDN
- Created Zustand store for app state management (appState, apiKey, models, messages, avatarState, settings)
- Built Gemini API proxy routes (/api/gemini for chat, /api/gemini/models for listing)
- Built SetupWizard component for API key input and verification
- Built ModelSelector component for choosing Gemini models
- Built Live2DViewer component with 4 avatar states (idle, listening, thinking, speaking)
- Built ChatView component with voice/text input, message display, and avatar integration
- Built SettingsDialog component for language, voice, and model configuration
- Created speech utilities (Web Speech API for recognition and synthesis)
- Loaded Live2D SDK via CDN (pixi.js 6.5.10, CubismCore, pixi-live2d-display)
- Fixed compilation issues (function hoisting, variable naming)

Stage Summary:
- Full application built with Next.js 16, TypeScript, Tailwind CSS, shadcn/ui
- Features: Gemini API integration, Web Speech API (STT/TTS), Live2D Avatar with 4 states
- 3 response languages supported: Arabic, English, Japanese
- Responsive design with mobile/desktop avatar layouts
- Dark theme with emerald/teal accent colors
- All files saved to /home/z/my-project/
