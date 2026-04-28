"""
Alisha AI Agent - Multi-Provider AI Assistant
A real AI agent with 15+ tools and support for multiple AI providers:
HuggingFace, NVIDIA NIM, Groq, Google Gemini.
"""

import gradio as gr
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from huggingface_hub import InferenceClient
import os
import json
import traceback
import subprocess
import datetime
import asyncio
import requests as req_lib

# ── Provider Configuration ──────────────────────────────────────

PROVIDERS = {
    "huggingface": {
        "name": "HuggingFace",
        "env_key": "HF_TOKEN",
        "base_url": None,
        "default_model": "Qwen/Qwen2.5-72B-Instruct",
        "models": [
            "Qwen/Qwen2.5-72B-Instruct",
            "Qwen/Qwen2.5-7B-Instruct",
            "meta-llama/Llama-3.2-3B-Instruct",
            "mistralai/Mistral-7B-Instruct-v0.3",
        ],
    },
    "nvidia": {
        "name": "NVIDIA NIM",
        "env_key": "NVIDIA_API_KEY",
        "base_url": "https://integrate.api.nvidia.com/v1",
        "default_model": "meta/llama-3.1-405b-instruct",
        "models": [
            "meta/llama-3.1-405b-instruct",
            "meta/llama-3.1-70b-instruct",
            "nvidia/llama-3.1-nemotron-70b-instruct",
            "deepseek-ai/deepseek-r1",
        ],
    },
    "groq": {
        "name": "Groq",
        "env_key": "GROQ_API_KEY",
        "base_url": "https://api.groq.com/openai/v1",
        "default_model": "llama-3.3-70b-versatile",
        "models": [
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
        ],
    },
    "google": {
        "name": "Google Gemini",
        "env_key": "GOOGLE_API_KEY",
        "base_url": None,
        "default_model": "gemini-2.0-flash",
        "models": [
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
        ],
    },
}

HF_TOKEN = os.getenv("HF_TOKEN", "")
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")


def get_api_key(provider: str) -> str:
    keys = {
        "huggingface": HF_TOKEN,
        "nvidia": NVIDIA_API_KEY,
        "groq": GROQ_API_KEY,
        "google": GOOGLE_API_KEY,
    }
    return keys.get(provider, "")


def get_available_providers() -> list:
    available = []
    for pid, pinfo in PROVIDERS.items():
        key = get_api_key(pid)
        available.append({
            "id": pid,
            "name": pinfo["name"],
            "configured": bool(key),
            "models": pinfo["models"],
            "default_model": pinfo["default_model"],
        })
    return available


# ── LLM Call Abstraction ────────────────────────────────────────

def call_llm(messages: list, provider: str = "huggingface", model: str = None,
             max_tokens: int = 1500, temperature: float = 0.3) -> str:
    api_key = get_api_key(provider)
    if not api_key:
        raise ValueError(f"API key not configured for {PROVIDERS[provider]['name']}. "
                         f"Set {PROVIDERS[provider]['env_key']} in Space secrets.")

    if not model:
        model = PROVIDERS[provider]["default_model"]

    if provider == "huggingface":
        client = InferenceClient(model=model, token=api_key)
        response = client.chat_completion(
            messages=messages, max_tokens=max_tokens, temperature=temperature
        )
        return response.choices[0].message.content.strip()

    elif provider == "google":
        return _call_gemini(messages, model, api_key, max_tokens, temperature)

    else:
        # OpenAI-compatible (NVIDIA, Groq)
        base_url = PROVIDERS[provider]["base_url"]
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        resp = req_lib.post(f"{base_url}/chat/completions",
                            headers=headers, json=body, timeout=120)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


def _call_gemini(messages: list, model: str, api_key: str,
                 max_tokens: int, temperature: float) -> str:
    url = (f"https://generativelanguage.googleapis.com/v1beta/"
           f"models/{model}:generateContent?key={api_key}")

    # Convert OpenAI-style messages to Gemini format
    contents = []
    system_text = ""
    for msg in messages:
        role = msg["role"]
        if role == "system":
            system_text = msg["content"]
            continue
        gemini_role = "user" if role == "user" else "model"
        contents.append({"role": gemini_role, "parts": [{"text": msg["content"]}]})

    body = {
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": temperature,
        },
    }
    if system_text:
        body["systemInstruction"] = {"parts": [{"text": system_text}]}

    resp = req_lib.post(url, json=body, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    return data["candidates"][0]["content"]["parts"][0]["text"].strip()


# ── System Prompts ──────────────────────────────────────────────

SYSTEM_PROMPTS = {
    "ar": "أنتِ 'أليشا'، فتاة أنمي ذكية ومرحة. اسمك أليشا. اسم المستخدم: ميجن غيلان. يجب أن تكون جميع ردودك باللغة العربية فقط. كوني ودودة ومختصرة.",
    "en": "You are 'Alisha', a smart and cheerful anime girl. User's name is Magen Gillan. MUST respond exclusively in English. Be friendly and brief.",
    "ja": "あなたは「アリシャ」です。ユーザー名はメジェン・ギランです。必ず日本語のみで返答してください。短く可愛らしく話してください。"
}

AGENT_SYSTEM_PROMPT = """You are Alisha, an intelligent AI agent assistant. You can execute tasks by using the available tools.
When given a task, think step by step:
1. Analyze what needs to be done
2. Choose the right tool(s) to use
3. Execute and verify the results
4. Report back with a clear summary in the user's preferred language

Available tools and their parameters:

SEARCH & WEB:
- web_search(query): Search the web using DuckDuckGo
- fetch_webpage(url): Fetch and extract text content from any URL/webpage

CODE & SYSTEM:
- run_python(code): Execute Python code and return output
- run_shell(command): Execute a shell command (bash) and return output
- system_info(): Get system information (OS, CPU, memory, disk, Python version)

FILE OPERATIONS:
- read_file(path): Read a local file from the server
- write_file(path, content): Write content to a local file
- list_directory(path): List files and folders in a directory

GITHUB (read works on public repos, write needs GITHUB_TOKEN):
- github_read_file(repo, path, branch="main"): Read a file from GitHub. repo format: "owner/repo"
- github_list_files(repo, path="", branch="main"): List files in a GitHub repo. repo format: "owner/repo"
- github_create_or_update_file(repo, path, content, message, branch="main"): Create/update a file (needs GITHUB_TOKEN)
- github_create_pr(repo, title, body, head, base="main"): Create a pull request (needs GITHUB_TOKEN)

UTILITIES:
- calculate(expression): Evaluate a math expression safely
- datetime_now(): Get current date and time
- json_format(data): Pretty-format a JSON string
- translate(text, target_lang): Translate text to target language

IMPORTANT RULES:
1. You MUST respond with ONLY a JSON object, no extra text before or after
2. For GitHub URLs like https://github.com/owner/repo, extract the repo as "owner/repo"
3. To analyze a project, first use github_list_files to see the structure, then github_read_file to read key files
4. github_read_file and github_list_files work on public repos without GITHUB_TOKEN
5. github_create_or_update_file and github_create_pr require GITHUB_TOKEN
6. Use run_shell for system commands, run_python for Python code
7. Use fetch_webpage to read content from any URL

JSON format for actions:
{"thought": "your reasoning", "action": "tool_name", "action_input": {"param": "value"}}

JSON format for final answer:
{"thought": "reasoning", "action": "final_answer", "action_input": {"answer": "your complete answer here"}}"""


# ── Tool implementations ────────────────────────────────────────

def tool_web_search(query: str) -> str:
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
            if not results:
                return "No results found."
            output = []
            for r in results:
                output.append(f"**{r['title']}**\n{r['body']}\nURL: {r['href']}")
            return "\n\n---\n\n".join(output)
    except Exception as e:
        return f"Search error: {str(e)}"


def tool_fetch_webpage(url: str) -> str:
    import re
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; AlishaAgent/1.0)"}
        resp = req_lib.get(url, headers=headers, timeout=20)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "")
        if "json" in content_type:
            return json.dumps(resp.json(), indent=2, ensure_ascii=False)[:5000]
        text = resp.text
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
        text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
        text = re.sub(r'<[^>]+>', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        if len(text) > 5000:
            text = text[:5000] + f"\n... (truncated, total {len(text)} chars)"
        return text if text else "Page loaded but no text content found."
    except Exception as e:
        return f"Error fetching URL: {str(e)}"


def tool_run_python(code: str) -> str:
    import io
    import contextlib
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stderr_capture):
            exec_globals = {"__builtins__": __builtins__}
            exec(code, exec_globals)
        stdout = stdout_capture.getvalue()
        stderr = stderr_capture.getvalue()
        result = stdout
        if stderr:
            result += f"\nSTDERR: {stderr}"
        return result if result.strip() else "Code executed successfully (no output)."
    except Exception as e:
        return f"Error: {str(e)}\n{traceback.format_exc()}"


def tool_run_shell(command: str) -> str:
    try:
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True, timeout=30
        )
        output = result.stdout
        if result.stderr:
            output += f"\nSTDERR: {result.stderr}"
        if result.returncode != 0:
            output += f"\nExit code: {result.returncode}"
        output = output.strip()
        if len(output) > 5000:
            output = output[:5000] + "\n... (truncated)"
        return output if output else "Command executed successfully (no output)."
    except subprocess.TimeoutExpired:
        return "Error: Command timed out after 30 seconds."
    except Exception as e:
        return f"Error: {str(e)}"


def tool_system_info() -> str:
    import platform
    try:
        info = []
        info.append(f"OS: {platform.system()} {platform.release()}")
        info.append(f"Architecture: {platform.machine()}")
        info.append(f"Python: {platform.python_version()}")
        info.append(f"Hostname: {platform.node()}")
        try:
            with open('/proc/meminfo', 'r') as f:
                meminfo = f.read()
            for line in meminfo.split('\n'):
                if 'MemTotal' in line or 'MemAvailable' in line:
                    info.append(line.strip())
        except Exception:
            pass
        try:
            disk = subprocess.run(['df', '-h', '/'], capture_output=True, text=True, timeout=5)
            if disk.returncode == 0:
                info.append(f"Disk:\n{disk.stdout.strip()}")
        except Exception:
            pass
        info.append(f"CPU cores: {os.cpu_count()}")
        info.append(f"Current time: {datetime.datetime.now().isoformat()}")
        return "\n".join(info)
    except Exception as e:
        return f"Error: {str(e)}"


def tool_read_file(path: str) -> str:
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        if len(content) > 5000:
            content = content[:5000] + f"\n... (truncated, total {len(content)} chars)"
        return content
    except Exception as e:
        return f"Error: {str(e)}"


def tool_write_file(path: str, content: str) -> str:
    try:
        os.makedirs(os.path.dirname(path) if os.path.dirname(path) else '.', exist_ok=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return f"File written successfully: {path} ({len(content)} chars)"
    except Exception as e:
        return f"Error: {str(e)}"


def tool_list_directory(path: str = ".") -> str:
    try:
        items = os.listdir(path)
        lines = []
        for item in sorted(items):
            full_path = os.path.join(path, item)
            if os.path.isdir(full_path):
                lines.append(f"📁 {item}/")
            else:
                size = os.path.getsize(full_path)
                lines.append(f"📄 {item} ({size}B)")
        return "\n".join(lines) if lines else "Empty directory."
    except Exception as e:
        return f"Error: {str(e)}"


def tool_calculate(expression: str) -> str:
    import ast
    import operator
    ops = {
        ast.Add: operator.add, ast.Sub: operator.sub,
        ast.Mult: operator.mul, ast.Div: operator.truediv,
        ast.Pow: operator.pow, ast.Mod: operator.mod,
        ast.FloorDiv: operator.floordiv,
        ast.USub: operator.neg, ast.UAdd: operator.pos,
    }
    def _eval(node):
        if isinstance(node, ast.Constant):
            return node.value
        elif isinstance(node, ast.BinOp):
            return ops[type(node.op)](_eval(node.left), _eval(node.right))
        elif isinstance(node, ast.UnaryOp):
            return ops[type(node.op)](_eval(node.operand))
        else:
            raise ValueError(f"Unsupported: {type(node).__name__}")
    try:
        tree = ast.parse(expression, mode='eval')
        result = _eval(tree.body)
        return str(result)
    except Exception as e:
        return f"Error: {str(e)}"


def tool_datetime_now() -> str:
    now = datetime.datetime.now()
    utc = datetime.datetime.utcnow()
    return f"Local: {now.strftime('%Y-%m-%d %H:%M:%S')}\nUTC: {utc.strftime('%Y-%m-%d %H:%M:%S')}\nTimestamp: {int(now.timestamp())}"


def tool_json_format(data: str) -> str:
    try:
        parsed = json.loads(data)
        formatted = json.dumps(parsed, indent=2, ensure_ascii=False)
        if len(formatted) > 5000:
            formatted = formatted[:5000] + "\n... (truncated)"
        return formatted
    except Exception as e:
        return f"Error: {str(e)}"


def tool_translate(text: str, target_lang: str = "en") -> str:
    """Translate text using the current LLM provider."""
    lang_names = {"ar": "Arabic", "en": "English", "ja": "Japanese",
                  "fr": "French", "es": "Spanish", "de": "German",
                  "zh": "Chinese", "ko": "Korean", "ru": "Russian"}
    lang_name = lang_names.get(target_lang, target_lang)
    ctx = _request_context.provider, _request_context.model
    try:
        result = call_llm(
            messages=[
                {"role": "system", "content": f"You are a translator. Translate the following text to {lang_name}. Output ONLY the translation, nothing else."},
                {"role": "user", "content": text}
            ],
            provider=ctx[0],
            model=ctx[1],
            max_tokens=1000,
            temperature=0.1
        )
        return result
    except Exception as e:
        return f"Translation error: {str(e)}"


# Thread-local storage for per-request provider context (avoids race conditions)
_request_context = threading.local()
_request_context.provider = "huggingface"
_request_context.model = None


# ── GitHub tools ────────────────────────────────────────────────

def tool_github_read_file(repo: str, path: str, branch: str = "main") -> str:
    raw_url = f"https://raw.githubusercontent.com/{repo}/{branch}/{path}"
    try:
        resp = req_lib.get(raw_url, timeout=15)
        if resp.status_code == 200:
            content = resp.text
            if len(content) > 5000:
                content = content[:5000] + f"\n... (truncated, total {len(resp.text)} chars)"
            return content
    except Exception:
        pass

    headers = {"Accept": "application/vnd.github.v3.raw"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    url = f"https://api.github.com/repos/{repo}/contents/{path}?ref={branch}"
    try:
        resp = req_lib.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            content = resp.text
            if len(content) > 5000:
                content = content[:5000] + f"\n... (truncated, total {len(resp.text)} chars)"
            return content
        return f"Error ({resp.status_code}): {resp.json().get('message', 'Unknown error')}"
    except Exception as e:
        return f"Error: {str(e)}"


def tool_github_list_files(repo: str, path: str = "", branch: str = "main") -> str:
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    url = f"https://api.github.com/repos/{repo}/contents/{path}?ref={branch}"
    try:
        resp = req_lib.get(url, headers=headers, timeout=15)
        if resp.status_code == 200:
            items = resp.json()
            if isinstance(items, list):
                lines = []
                for item in items:
                    icon = "📁" if item["type"] == "dir" else "📄"
                    size = item.get('size', 0)
                    lines.append(f"{icon} {item['name']} ({item['type']}, {size}B)")
                return "\n".join(lines)
            return f"📄 {items['name']}"
        if resp.status_code == 403:
            return _scrape_github_files(repo, path, branch)
        return f"Error ({resp.status_code}): {resp.json().get('message', 'Unknown error')}"
    except Exception as e:
        return f"Error: {str(e)}"


def _scrape_github_files(repo: str, path: str, branch: str) -> str:
    import re
    url = f"https://github.com/{repo}/tree/{branch}/{path}" if path else f"https://github.com/{repo}"
    try:
        resp = req_lib.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code == 200:
            items = re.findall(
                r'<a[^>]*href="/' + re.escape(repo) + r'/(?:tree|blob)/' + re.escape(branch) + r'/([^"]+)"[^>]*>([^<]+)</a>',
                resp.text
            )
            if items:
                seen = set()
                lines = []
                for href_path, name in items:
                    name = name.strip()
                    if name and name not in seen:
                        seen.add(name)
                        lines.append(f"📄 {name}")
                return "\n".join(lines) if lines else "Could not parse file list."
            return "Could not parse file list (rate limited, try again later)."
        return f"Error ({resp.status_code})"
    except Exception as e:
        return f"Error: {str(e)}"


def tool_github_create_or_update_file(repo: str, path: str, content: str, message: str, branch: str = "main") -> str:
    import base64
    if not GITHUB_TOKEN:
        return "Error: GITHUB_TOKEN is not configured. Please add it to the Space secrets."
    headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
    url = f"https://api.github.com/repos/{repo}/contents/{path}"
    existing = req_lib.get(url, headers=headers, params={"ref": branch})
    sha = None
    if existing.status_code == 200:
        sha = existing.json().get("sha")
    data = {
        "message": message,
        "content": base64.b64encode(content.encode()).decode(),
        "branch": branch
    }
    if sha:
        data["sha"] = sha
    resp = req_lib.put(url, headers=headers, json=data)
    if resp.status_code in (200, 201):
        action = "Updated" if sha else "Created"
        return f"{action} file: {path} on branch {branch}"
    return f"Error ({resp.status_code}): {resp.json().get('message', 'Unknown error')}"


def tool_github_create_pr(repo: str, title: str, body: str, head: str, base: str = "main") -> str:
    if not GITHUB_TOKEN:
        return "Error: GITHUB_TOKEN is not configured. Please add it to the Space secrets."
    headers = {"Authorization": f"token {GITHUB_TOKEN}", "Accept": "application/vnd.github.v3+json"}
    url = f"https://api.github.com/repos/{repo}/pulls"
    data = {"title": title, "body": body, "head": head, "base": base}
    resp = req_lib.post(url, headers=headers, json=data)
    if resp.status_code == 201:
        pr = resp.json()
        return f"PR created: #{pr['number']} - {pr['html_url']}"
    return f"Error ({resp.status_code}): {resp.json().get('message', 'Unknown error')}"


# ── Tools registry ──────────────────────────────────────────────

TOOLS = {
    "web_search": {"fn": tool_web_search, "desc": "Search the web using DuckDuckGo", "params": ["query"]},
    "fetch_webpage": {"fn": tool_fetch_webpage, "desc": "Fetch text content from a URL", "params": ["url"]},
    "run_python": {"fn": tool_run_python, "desc": "Execute Python code", "params": ["code"]},
    "run_shell": {"fn": tool_run_shell, "desc": "Execute a shell/bash command", "params": ["command"]},
    "system_info": {"fn": tool_system_info, "desc": "Get system info (OS, CPU, memory)", "params": []},
    "read_file": {"fn": tool_read_file, "desc": "Read a local file", "params": ["path"]},
    "write_file": {"fn": tool_write_file, "desc": "Write content to a local file", "params": ["path", "content"]},
    "list_directory": {"fn": tool_list_directory, "desc": "List files in a directory", "params": ["path"]},
    "github_read_file": {"fn": tool_github_read_file, "desc": "Read a file from GitHub", "params": ["repo", "path", "branch"]},
    "github_list_files": {"fn": tool_github_list_files, "desc": "List files in a GitHub repo", "params": ["repo", "path", "branch"]},
    "github_create_or_update_file": {"fn": tool_github_create_or_update_file, "desc": "Create/update a file on GitHub", "params": ["repo", "path", "content", "message", "branch"]},
    "github_create_pr": {"fn": tool_github_create_pr, "desc": "Create a pull request on GitHub", "params": ["repo", "title", "body", "head", "base"]},
    "calculate": {"fn": tool_calculate, "desc": "Evaluate a math expression", "params": ["expression"]},
    "datetime_now": {"fn": tool_datetime_now, "desc": "Get current date and time", "params": []},
    "json_format": {"fn": tool_json_format, "desc": "Pretty-format a JSON string", "params": ["data"]},
    "translate": {"fn": tool_translate, "desc": "Translate text to another language", "params": ["text", "target_lang"]},
}


# ── Agent Loop ──────────────────────────────────────────────────

def run_agent(task: str, language: str = "ar", max_steps: int = 10,
              provider: str = "huggingface", model: str = None) -> dict:
    _request_context.provider = provider
    _request_context.model = model

    api_key = get_api_key(provider)
    if not api_key:
        return {"steps": [], "final_answer": f"Error: {PROVIDERS[provider]['env_key']} is not set."}

    steps = []
    conversation = [
        {"role": "system", "content": AGENT_SYSTEM_PROMPT},
        {"role": "user", "content": f"Task: {task}\nLanguage preference: {language}"}
    ]

    for step_num in range(max_steps):
        try:
            assistant_msg = call_llm(
                messages=conversation, provider=provider, model=model,
                max_tokens=1500, temperature=0.3
            )

            try:
                json_start = assistant_msg.find("{")
                json_end = assistant_msg.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    parsed = json.loads(assistant_msg[json_start:json_end])
                else:
                    parsed = {"thought": assistant_msg, "action": "final_answer",
                              "action_input": {"answer": assistant_msg}}
            except json.JSONDecodeError:
                parsed = {"thought": assistant_msg, "action": "final_answer",
                          "action_input": {"answer": assistant_msg}}

            thought = parsed.get("thought", "")
            action = parsed.get("action", "final_answer")
            action_input = parsed.get("action_input", {})

            step_info = {
                "step": step_num + 1,
                "thought": thought,
                "action": action,
                "action_input": action_input
            }

            if action == "final_answer":
                answer = action_input.get("answer", thought) if isinstance(action_input, dict) else str(action_input)
                step_info["result"] = answer
                steps.append(step_info)
                return {"steps": steps, "final_answer": answer}

            if action in TOOLS:
                tool = TOOLS[action]
                fn = tool["fn"]
                kwargs = {}
                if isinstance(action_input, str):
                    if tool["params"]:
                        kwargs[tool["params"][0]] = action_input
                else:
                    for param in tool["params"]:
                        if param in action_input:
                            kwargs[param] = action_input[param]
                try:
                    observation = fn(**kwargs)
                except TypeError as te:
                    observation = f"Error calling {action}: {str(te)}. Required params: {tool['params']}"
            else:
                observation = f"Unknown tool: {action}. Available tools: {list(TOOLS.keys())}"

            step_info["result"] = observation
            steps.append(step_info)

            conversation.append({"role": "assistant", "content": assistant_msg})
            conversation.append({"role": "user", "content": f"Observation: {observation}\n\nContinue with your next step. Remember to respond with JSON format."})

        except Exception as e:
            step_info = {"step": step_num + 1, "thought": "Error occurred", "action": "error", "result": str(e)}
            steps.append(step_info)
            return {"steps": steps, "final_answer": f"Error: {str(e)}"}

    return {"steps": steps, "final_answer": "Reached maximum steps without completing the task."}


# ── Simple chat ─────────────────────────────────────────────────

def simple_chat(message: str, language: str = "ar",
                provider: str = "huggingface", model: str = None,
                history: list = None) -> dict:
    if not message:
        return {"response": ""}

    api_key = get_api_key(provider)
    if not api_key:
        return {"response": f"Error: {PROVIDERS[provider]['env_key']} is not set."}

    system_prompt = SYSTEM_PROMPTS.get(language, SYSTEM_PROMPTS["ar"])
    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history for context
    if history:
        for user_msg, bot_msg in history[-5:]:
            if user_msg:
                messages.append({"role": "user", "content": user_msg})
            if bot_msg:
                messages.append({"role": "assistant", "content": bot_msg})

    messages.append({"role": "user", "content": message})

    try:
        result = call_llm(
            messages=messages, provider=provider, model=model,
            max_tokens=500, temperature=0.7
        )
        return {"response": result}
    except Exception as e:
        return {"response": f"Error: {str(e)}"}


# ── FastAPI app ─────────────────────────────────────────────────

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/predict")
async def api_predict(request: Request):
    body = await request.json()
    message = body.get("message", "")
    language = body.get("language", "ar")
    provider = body.get("provider", "huggingface")
    model = body.get("model", None)
    result = await asyncio.to_thread(simple_chat, message, language, provider, model)
    return JSONResponse(content=result)


@app.post("/api/agent")
async def api_agent(request: Request):
    body = await request.json()
    task = body.get("task", body.get("message", ""))
    language = body.get("language", "ar")
    max_steps = body.get("max_steps", 10)
    provider = body.get("provider", "huggingface")
    model = body.get("model", None)
    result = await asyncio.to_thread(run_agent, task, language, max_steps, provider, model)
    return JSONResponse(content=result)


@app.get("/api/tools")
async def api_tools():
    tools_info = {}
    for name, tool in TOOLS.items():
        tools_info[name] = {"description": tool["desc"], "parameters": tool["params"]}
    return JSONResponse(content={
        "tools": tools_info,
        "total": len(TOOLS),
        "github_configured": bool(GITHUB_TOKEN),
    })


@app.get("/api/providers")
async def api_providers():
    return JSONResponse(content={"providers": get_available_providers()})


@app.get("/api/health")
async def api_health():
    providers_status = {}
    for pid in PROVIDERS:
        providers_status[pid] = bool(get_api_key(pid))
    return JSONResponse(content={
        "status": "ok",
        "tools_count": len(TOOLS),
        "providers": providers_status,
        "github_configured": bool(GITHUB_TOKEN),
    })


# ── Modern Gradio Chat UI ──────────────────────────────────────

CUSTOM_CSS = """
.main-header {
    text-align: center;
    padding: 20px 0 10px 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    margin-bottom: 16px;
    color: white;
}
.main-header h1 { color: white !important; margin: 0; font-size: 2em; }
.main-header p { color: rgba(255,255,255,0.85) !important; margin: 4px 0 0 0; }
.chat-container { max-width: 900px; margin: 0 auto; }
.step-box {
    background: #f8f9fa;
    border-left: 4px solid #667eea;
    padding: 12px 16px;
    margin: 8px 0;
    border-radius: 0 8px 8px 0;
    font-size: 0.9em;
}
.step-thought { color: #555; font-style: italic; }
.step-action { color: #667eea; font-weight: bold; }
.step-result { color: #333; background: #fff; padding: 8px; border-radius: 4px; margin-top: 4px; white-space: pre-wrap; max-height: 200px; overflow-y: auto; }
.tool-card {
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    border-radius: 12px;
    padding: 16px;
    margin: 8px 4px;
    text-align: center;
    transition: transform 0.2s;
}
.tool-card:hover { transform: translateY(-2px); }
.tool-icon { font-size: 2em; display: block; margin-bottom: 8px; }
.final-answer-box {
    background: linear-gradient(135deg, #667eea22 0%, #764ba222 100%);
    border: 2px solid #667eea;
    border-radius: 12px;
    padding: 16px;
    margin-top: 12px;
}
.provider-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.8em;
    font-weight: bold;
    margin-left: 8px;
}
"""


def format_agent_steps(result: dict) -> str:
    parts = []
    for step in result.get("steps", []):
        action = step.get("action", "")
        if action == "final_answer":
            continue
        thought = step.get("thought", "")
        action_input = step.get("action_input", {})
        step_result = str(step.get("result", ""))
        if len(step_result) > 300:
            step_result = step_result[:300] + "..."
        input_str = ""
        if isinstance(action_input, dict):
            for k, v in action_input.items():
                v_str = str(v)
                if len(v_str) > 100:
                    v_str = v_str[:100] + "..."
                input_str += f"  `{k}`: {v_str}\n"

        parts.append(f"""**Step {step['step']}** — `{action}`
> 💭 {thought}
{input_str}
```
{step_result}
```
---""")

    final = result.get("final_answer", "")
    if final:
        parts.append(f"\n**✨ Final Answer:**\n\n{final}")

    return "\n\n".join(parts)


def agent_chat_fn(message, history, language, max_steps, provider, model_choice):
    if not message.strip():
        return "", history

    task_keywords_ar = ['ابحث', 'نفذ', 'اعمل', 'عدل', 'أنشئ', 'احذف', 'اكتب كود', 'شغل', 'حلل',
                        'قم ب', 'ساعدني', 'افحص', 'اقرأ', 'github.com', 'حمل', 'احسب', 'ترجم']
    task_keywords_en = ['search', 'execute', 'create', 'delete', 'write code', 'run', 'analyze',
                        'build', 'fix', 'modify', 'find', 'list files', 'github.com', 'fetch',
                        'calculate', 'shell', 'read file', 'translate']

    lower = message.lower()
    is_task = any(k in message for k in task_keywords_ar) or any(k in lower for k in task_keywords_en)

    # Use selected model or provider default
    selected_model = model_choice if model_choice else None

    provider_label = PROVIDERS.get(provider, {}).get("name", provider)

    if is_task:
        result = run_agent(message, language, int(max_steps), provider, selected_model)
        formatted = format_agent_steps(result)
        header = f"🤖 **Agent Mode** ({len(result.get('steps', []))} steps) — *{provider_label}*"
        history = history + [[message, f"{header}\n\n{formatted}"]]
    else:
        result = simple_chat(message, language, provider, selected_model, history)
        reply = result.get("response", "Error")
        history = history + [[message, reply]]

    return "", history


def update_model_choices(provider):
    """Update model dropdown when provider changes."""
    if provider in PROVIDERS:
        models = PROVIDERS[provider]["models"]
        default = PROVIDERS[provider]["default_model"]
        key = get_api_key(provider)
        status = "🟢" if key else "🔴"
        return gr.Dropdown(choices=models, value=default, label=f"{status} Model")
    return gr.Dropdown(choices=[], value=None)


with gr.Blocks(title="🌸 Alisha Agent", css=CUSTOM_CSS) as demo:

    gr.HTML(f"""
    <div class="main-header">
        <h1>🌸 Alisha AI Agent</h1>
        <p>وكيل ذكاء اصطناعي متعدد المزودين — Multi-Provider AI Agent with {len(TOOLS)} tools</p>
    </div>
    """)

    with gr.Tab("💬 Chat"):
        gr.Markdown("Send a message to chat, or give a task (use keywords like **ابحث**, **نفذ**, **search**, **execute**) to activate agent mode automatically.")

        with gr.Row():
            language = gr.Radio(
                choices=[("العربية", "ar"), ("English", "en"), ("日本語", "ja")],
                value="ar", label="🌐 Language", scale=2
            )
            max_steps = gr.Slider(minimum=1, maximum=20, value=10, step=1, label="⚡ Max Steps", scale=1)

        with gr.Row():
            provider = gr.Dropdown(
                choices=[(p["name"], pid) for pid, p in PROVIDERS.items()],
                value="huggingface",
                label="🔌 Provider",
                scale=2,
            )
            model_choice = gr.Dropdown(
                choices=PROVIDERS["huggingface"]["models"],
                value=PROVIDERS["huggingface"]["default_model"],
                label="🟢 Model" if HF_TOKEN else "🔴 Model",
                scale=3,
            )

        provider.change(update_model_choices, [provider], [model_choice])

        chatbot = gr.Chatbot(label="Alisha", height=500)
        with gr.Row():
            msg = gr.Textbox(
                label="",
                placeholder="اكتب رسالتك أو مهمتك هنا... / Type your message or task here...",
                lines=2, scale=6, show_label=False,
            )
            send_btn = gr.Button("🚀 Send", variant="primary", scale=1)

        send_btn.click(agent_chat_fn, [msg, chatbot, language, max_steps, provider, model_choice], [msg, chatbot])
        msg.submit(agent_chat_fn, [msg, chatbot, language, max_steps, provider, model_choice], [msg, chatbot])

        gr.Examples(
            examples=[
                ["مرحبا، كيف حالك؟"],
                ["ابحث عن أحدث أخبار الذكاء الاصطناعي"],
                ["اكتب كود Python لحساب أول 10 أرقام فيبوناتشي"],
                ["https://github.com/magengillan00-lgtm/Alisha\nافحص هذا المشروع ولخصه لي"],
                ["احسب 2^32 + 100"],
                ["ترجم 'مرحبا بالعالم' إلى الإنجليزية"],
                ["Search for the latest news about GPT-5"],
                ["Run shell command: uname -a"],
            ],
            inputs=msg,
            label="💡 Examples / أمثلة"
        )

    with gr.Tab("🔧 Tools"):
        gr.Markdown(f"### Available Tools ({len(TOOLS)} tools)")

        categories = {
            "🔍 Search & Web": ["web_search", "fetch_webpage"],
            "💻 Code & System": ["run_python", "run_shell", "system_info"],
            "📁 File Operations": ["read_file", "write_file", "list_directory"],
            "🐙 GitHub": ["github_read_file", "github_list_files", "github_create_or_update_file", "github_create_pr"],
            "🧮 Utilities": ["calculate", "datetime_now", "json_format", "translate"],
        }

        for cat_name, tool_names in categories.items():
            gr.Markdown(f"#### {cat_name}")
            tools_md = "| Tool | Description | Parameters |\n|------|-------------|------------|\n"
            for name in tool_names:
                if name in TOOLS:
                    tool = TOOLS[name]
                    params = ", ".join(tool["params"]) if tool["params"] else "—"
                    tools_md += f"| `{name}` | {tool['desc']} | {params} |\n"
            gr.Markdown(tools_md)

        gr.Markdown(f"\n**GitHub configured:** {'✅ Yes' if GITHUB_TOKEN else '❌ No — Add GITHUB_TOKEN to Space secrets'}")

        gr.Markdown("""
### API Endpoints
| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/api/predict` | POST | `{"message": "...", "language": "ar", "provider": "huggingface", "model": "..."}` | Simple chat |
| `/api/agent` | POST | `{"task": "...", "language": "ar", "max_steps": 10, "provider": "huggingface"}` | Agent mode with tools |
| `/api/tools` | GET | — | List all available tools |
| `/api/providers` | GET | — | List available providers and status |
| `/api/health` | GET | — | Health check with provider status |
        """)

    with gr.Tab("🔌 Providers"):
        gr.Markdown("### AI Provider Configuration")
        gr.Markdown("Configure multiple AI providers. Add API keys as Space secrets to enable them.")

        providers_md = "| Provider | Status | Env Variable | Models |\n|----------|--------|-------------|--------|\n"
        for pid, pinfo in PROVIDERS.items():
            key = get_api_key(pid)
            status = "🟢 Active" if key else "🔴 Not configured"
            models_str = ", ".join(pinfo["models"][:2]) + ("..." if len(pinfo["models"]) > 2 else "")
            providers_md += f"| **{pinfo['name']}** | {status} | `{pinfo['env_key']}` | {models_str} |\n"
        gr.Markdown(providers_md)

        gr.Markdown("""
### How to Configure
1. Go to your [Space Settings](https://huggingface.co/spaces/Magen01/Alisha-Agent/settings)
2. Scroll to **Repository secrets**
3. Add the API key for the provider you want to use:
   - `HF_TOKEN` — HuggingFace access token
   - `NVIDIA_API_KEY` — NVIDIA NIM API key
   - `GROQ_API_KEY` — Groq API key
   - `GOOGLE_API_KEY` — Google Gemini API key
   - `GITHUB_TOKEN` — GitHub personal access token (for write operations)
        """)


demo = gr.mount_gradio_app(app, demo, path="/")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
