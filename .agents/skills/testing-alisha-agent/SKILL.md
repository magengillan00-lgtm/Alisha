# Testing Alisha Agent on HuggingFace Space

## Overview
Alisha Agent is a Gradio-based AI agent deployed on HuggingFace Spaces with 15 tools organized in 5 categories. It uses a unified chat UI with keyword-based auto-detection to route messages to either simple chat mode or agent mode.

## Live URLs
- **HF Space:** https://Magen01-alisha-agent.hf.space
- **GitHub Pages (frontend):** https://magengillan00-lgtm.github.io/Alisha/

## Devin Secrets Needed
- `HF_TOKEN` — HuggingFace API token (for the Space and model inference)
- `GITHUB_TOKEN` — (optional) GitHub Personal Access Token for write operations (create files, create PRs)

## Testing the Agent

### Auto-Detection Routing
The agent uses keyword detection to decide between chat mode and agent mode:
- **Arabic task keywords:** ابحث, نفذ, اعمل, عدل, أنشئ, احذف, اكتب كود, شغل, حلل, قم ب, ساعدني, افحص, اقرأ, حمل, احسب
- **English task keywords:** search, execute, create, delete, write code, run, analyze, build, fix, modify, find, list files, fetch, calculate, shell, read file
- **Also triggers agent mode:** Messages containing `github.com` URLs
- **Simple chat:** Any message without task keywords goes to simple chat (30s timeout)
- **Agent mode:** Messages with keywords route to agent (120s timeout)

### Testing Tools via UI
1. Navigate to the HF Space URL
2. Use the example buttons at the bottom for quick testing
3. Available example prompts cover: greeting, web search, Python code, GitHub analysis, calculate, English search, shell command

### Key Test Scenarios

#### Simple Chat (should NOT trigger agent)
- Input: `مرحبا، كيف حالك؟` or `Hello, how are you?`
- Expected: Simple text response, no "🤖 Agent Mode" prefix

#### Web Search
- Input: `ابحث عن أحدث أخبار الذكاء الاصطناعي`
- Expected: Agent Mode with `web_search` tool, returns URLs

#### GitHub Repo Analysis (public repos work without GITHUB_TOKEN)
- Input: `https://github.com/owner/repo افحص هذا المشروع ولخصه لي`
- Expected: Uses `github_list_files` then `github_read_file`
- Note: Public repos use `raw.githubusercontent.com` fallback to avoid API rate limits

#### Shell Command
- Input: `Run shell command: uname -a`
- Expected: Uses `run_shell` tool, returns system info

#### Calculate
- Input: `احسب 2^32 + 100`
- Expected: Uses `calculate` tool, returns 4294967396

### Tools Tab
- Click "🔧 Tools" tab to verify all 15 tools are listed
- 5 categories: Search & Web (2), Code & System (3), File Operations (3), GitHub (4), Utilities (3)
- Shows GitHub configuration status and API endpoints

### Language Switching
- Use the radio buttons (العربية / English / 日本語) to switch language
- The system prompt changes based on selected language
- Simple greetings in any language should NOT trigger agent mode

## Architecture Notes
- **Backend:** `app.py` — Gradio 5.x with FastAPI custom endpoints
- **Deployment:** Docker SDK on HuggingFace Spaces (Python 3.12)
- **Model:** Qwen/Qwen2.5-72B-Instruct via HuggingFace Inference API
- **Agent pattern:** ReAct (Think → Act → Observe → Repeat) with max steps configurable (1-20)
- **API endpoints:** `/api/predict` (chat), `/api/agent` (tasks), `/api/tools` (list)

## Common Issues
- **GitHub API rate limiting:** Public repo tools may hit 60 req/hour limit. The code has a fallback to `raw.githubusercontent.com` for reading files.
- **Python 3.13 incompatibility:** The Space uses Docker with Python 3.12 because Gradio's `audioop` dependency was removed in Python 3.13.
- **GITHUB_TOKEN not set:** GitHub write operations (create/update files, create PRs) will fail without `GITHUB_TOKEN` as a Space secret. Read operations on public repos work without it.
- **Agent timeout:** Agent mode has a 120s timeout. Complex multi-step tasks may time out if the model is slow.

## Frontend (index.html)
- The frontend on GitHub Pages connects to the HF Space backend
- Uses `callHuggingFaceAgent()` with `isTaskMessage()` for routing
- `checkModelStatus()` sends real API requests to verify model availability (may consume API quota)
