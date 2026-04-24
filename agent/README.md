---
title: Alisha Agent
emoji: 🌸
colorFrom: pink
colorTo: purple
sdk: docker
pinned: false
---

# 🌸 Alisha AI Agent — Multi-Provider

AI backend agent for [Alisha AI](https://magengillan00-lgtm.github.io/Alisha/) with multi-provider support.

## Features
- **Multi-Provider**: HuggingFace, NVIDIA NIM, Groq, Google Gemini
- **16 Tools**: Web search, code execution, shell, GitHub ops, file management, translate
- **Multi-Language**: Arabic, English, Japanese
- **Auto-Detection**: Keywords trigger agent mode vs simple chat
- **Conversation Memory**: Remembers recent context

## API Usage
```json
POST /api/predict
{"message": "مرحباً", "language": "ar", "provider": "huggingface"}

POST /api/agent
{"task": "ابحث عن أخبار الذكاء الاصطناعي", "language": "ar", "provider": "groq"}

GET /api/providers
GET /api/health
GET /api/tools
```
