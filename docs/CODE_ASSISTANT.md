# Alisha Code Assistant

The **Alisha Code Assistant** is an embedded AI coding helper that ships
inside the Alisha web app. It reuses the same multi-provider architecture
already wired into Alisha (Groq, Gemini, OpenRouter, OpenAI, HuggingFace).

## Where to find it

Open the app (`index.html`) — a small floating **`</>`** button appears at
the bottom-left of the screen. Clicking it opens the assistant panel.

## What it can do

| Mode | Purpose |
| --- | --- |
| **Ask** | Answer questions about the code or about the Alisha project itself. |
| **Improve** | Review pasted code and suggest refactors / better error handling. |
| **Generate** | Produce a self-contained code snippet for a stated task. |
| **Explain** | Walk through a complex section of code line-by-line in plain English. |

## Configuration

The assistant looks up its API key in this order:

1. `localStorage.ALISHA_CODE_KEY` — optional, dedicated key for the
   assistant only. Set this if you want the coding assistant to use a
   different model/provider than the one Alisha uses for chat.
2. `localStorage.ALISHA_API_KEY` — the primary Alisha key (set in the
   app's existing setup modal).

You can set the dedicated coding key from the browser DevTools console:

```js
// Use Groq (fast, free tier available)
localStorage.setItem('ALISHA_CODE_KEY', 'gsk_...');

// Or Gemini
localStorage.setItem('ALISHA_CODE_KEY', 'AIzaSy...');

// Or OpenRouter (access to Llama / Claude / GPT-4 / etc.)
localStorage.setItem('ALISHA_CODE_KEY', 'sk-or-...');

// Or OpenAI
localStorage.setItem('ALISHA_CODE_KEY', 'sk-...');
```

The assistant detects the provider from the key prefix — no extra config
needed.

### Optional environment variables

These are **build-time** environment variables consumed only if you run
your own deploy pipeline (CI / a custom build script). They are *not*
required for the default GitHub Pages deployment.

| Env var | Default | Purpose |
| --- | --- | --- |
| `ALISHA_CODE_DEFAULT_PROVIDER` | `groq` | Provider used when no key is configured (informational). |
| `ALISHA_CODE_DEFAULT_MODEL` | provider-specific | Default model id for snippet generation. |

> The deploy pipeline never injects API keys into the published HTML.
> Each visitor brings their own key, stored only in their browser.

## Provider routing & default models

| Key prefix | Endpoint | Default model |
| --- | --- | --- |
| `gsk_` | `api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| `AIzaSy` | `generativelanguage.googleapis.com/v1beta` | `gemini-1.5-flash` |
| `sk-or-` | `openrouter.ai/api/v1` | `meta-llama/llama-3.1-70b-instruct` |
| `sk-` | `api.openai.com/v1` | `gpt-4o-mini` |

## Privacy & safety

* The assistant runs entirely in the browser. Your code and prompts are
  sent only to the AI provider matching the configured key.
* The last 30 conversations are kept in `localStorage` under
  `ALISHA_CODE_HISTORY` for personal reference. Clear that key to wipe.
* All AI replies are HTML-escaped before rendering. Fenced code blocks
  are syntax-tagged but not executed.

## Public JS API

If you want to embed the assistant elsewhere or trigger it from the
console, the module exposes:

```js
window.AlishaCodeAssistant.openPanel();   // show the panel
window.AlishaCodeAssistant.closePanel();  // hide it
window.AlishaCodeAssistant.ask(text, mode); // returns a Promise<string>
// mode is one of: 'ask' | 'improve' | 'generate' | 'explain'
```

## Source

* [`assets/js/code-assistant.js`](../assets/js/code-assistant.js)
* Wired into [`index.html`](../index.html) via a single `<script defer>` tag.
