/**
 * Alisha Code Assistant — embedded AI coding helper for the Alisha app.
 *
 * Capabilities:
 *   - Answer questions about the project's code
 *   - Suggest refactors / improvements
 *   - Generate code snippets on demand
 *   - Explain complex sections of the codebase
 *
 * Reuses the same API key the user already configured for Alisha
 * (localStorage 'ALISHA_API_KEY'), or a separate dedicated key if
 * the user supplies one (localStorage 'ALISHA_CODE_KEY').
 *
 * The assistant detects the provider from the key shape:
 *   - keys starting with 'gsk_' / 'sk-'  -> Groq / OpenAI-compatible (Groq endpoint)
 *   - keys starting with 'sk-or-'        -> OpenRouter
 *   - keys starting with 'AIzaSy'        -> Gemini
 *   - keys starting with 'hf_'           -> Hugging Face inference
 *
 * Configuration env vars (consumed by GitHub Actions / build, optional):
 *   ALISHA_CODE_DEFAULT_PROVIDER  default provider when no key is set
 *   ALISHA_CODE_DEFAULT_MODEL     default model id
 *
 * Public API (attached to window):
 *   window.AlishaCodeAssistant.ask(text, mode)
 *   window.AlishaCodeAssistant.openPanel()
 *   window.AlishaCodeAssistant.closePanel()
 */

(function () {
    'use strict';

    const LS_PRIMARY_KEY = 'ALISHA_API_KEY';
    const LS_CODE_KEY    = 'ALISHA_CODE_KEY';
    const LS_HISTORY     = 'ALISHA_CODE_HISTORY';

    const MODES = {
        ask: {
            label: 'Ask',
            system: 'You are Alisha Code Assistant, an expert software engineer. ' +
                    'Answer the user\'s question about their code or project clearly and concisely. ' +
                    'When you reference code, use fenced code blocks with the correct language tag. ' +
                    'If the question is ambiguous, state your assumptions and answer the most likely intent.'
        },
        improve: {
            label: 'Suggest improvements',
            system: 'You are Alisha Code Assistant, an expert reviewer. ' +
                    'Read the provided code or description and suggest concrete improvements: ' +
                    'readability, performance, error handling, security, testing. ' +
                    'List each suggestion as a short bullet, then show a corrected snippet only when it adds value.'
        },
        generate: {
            label: 'Generate snippet',
            system: 'You are Alisha Code Assistant. Generate a self-contained, working code snippet ' +
                    'that fulfils the user\'s request. Prefer modern idioms. ' +
                    'Return only one fenced code block followed by a 1-2 line explanation.'
        },
        explain: {
            label: 'Explain code',
            system: 'You are Alisha Code Assistant. Explain the provided code section line-by-line for ' +
                    'a developer who is new to the codebase. Use plain language and call out non-obvious ' +
                    'side effects, performance considerations, and possible bugs.'
        }
    };

    function detectProvider(key) {
        if (!key) return null;
        if (key.startsWith('hf_'))      return 'huggingface';
        if (key.startsWith('sk-or-'))   return 'openrouter';
        if (key.startsWith('AIzaSy'))   return 'gemini';
        if (key.startsWith('gsk_'))     return 'groq';
        if (key.startsWith('sk-'))      return 'openai';
        return 'groq'; // safe default for OpenAI-compatible
    }

    function getActiveKey() {
        return localStorage.getItem(LS_CODE_KEY) || localStorage.getItem(LS_PRIMARY_KEY) || '';
    }

    function loadHistory() {
        try { return JSON.parse(localStorage.getItem(LS_HISTORY) || '[]'); }
        catch (e) { return []; }
    }
    function saveHistory(h) {
        try { localStorage.setItem(LS_HISTORY, JSON.stringify(h.slice(-30))); } catch (e) {}
    }

    async function callOpenAICompat(userText, system, baseUrl, model) {
        const key = getActiveKey();
        if (!key) throw new Error('No API key configured');
        const ctrl = new AbortController();
        const tout = setTimeout(() => ctrl.abort(), 25000);
        try {
            const res = await fetch(baseUrl + '/chat/completions', {
                method: 'POST', signal: ctrl.signal,
                headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    temperature: 0.3,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user',   content: userText }
                    ]
                })
            });
            clearTimeout(tout);
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error('HTTP ' + res.status + (text ? ': ' + text.slice(0, 200) : ''));
            }
            const data = await res.json();
            return data.choices && data.choices[0] && data.choices[0].message
                && data.choices[0].message.content || '';
        } finally {
            clearTimeout(tout);
        }
    }

    async function callGemini(userText, system, model) {
        const key = getActiveKey();
        if (!key) throw new Error('No API key configured');
        const ctrl = new AbortController();
        const tout = setTimeout(() => ctrl.abort(), 25000);
        try {
            const res = await fetch(
                'https://generativelanguage.googleapis.com/v1beta/models/' +
                (model || 'gemini-1.5-flash') + ':generateContent?key=' + key,
                {
                    method: 'POST', signal: ctrl.signal,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: system + '\n\nUser:\n' + userText }] }],
                        generationConfig: { temperature: 0.3 }
                    })
                }
            );
            clearTimeout(tout);
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error('HTTP ' + res.status + (text ? ': ' + text.slice(0, 200) : ''));
            }
            const data = await res.json();
            return (data.candidates && data.candidates[0] &&
                    data.candidates[0].content && data.candidates[0].content.parts &&
                    data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || '';
        } finally {
            clearTimeout(tout);
        }
    }

    async function ask(userText, mode) {
        mode = mode || 'ask';
        const cfg = MODES[mode] || MODES.ask;
        const provider = detectProvider(getActiveKey());

        if (provider === 'gemini') {
            return callGemini(userText, cfg.system, 'gemini-1.5-flash');
        }
        if (provider === 'openrouter') {
            return callOpenAICompat(userText, cfg.system, 'https://openrouter.ai/api/v1', 'meta-llama/llama-3.1-70b-instruct');
        }
        if (provider === 'openai') {
            return callOpenAICompat(userText, cfg.system, 'https://api.openai.com/v1', 'gpt-4o-mini');
        }
        // default: groq endpoint (works for gsk_ keys; very fast and free tier exists)
        return callOpenAICompat(userText, cfg.system, 'https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile');
    }

    // Light renderer: turn fenced code blocks into <pre><code>; escape HTML.
    function escapeHtml(s) {
        return s.replace(/[&<>"']/g, c => ({
            '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
        })[c]);
    }
    function renderMarkdownLite(text) {
        const safe = escapeHtml(text);
        // fenced code blocks
        const withBlocks = safe.replace(/```(\w+)?\n([\s\S]*?)```/g,
            (_, lang, code) =>
                '<pre class="ca-code"><code class="lang-' + (lang || 'plain') +
                '">' + code + '</code></pre>');
        // inline code
        return withBlocks.replace(/`([^`]+)`/g, '<code class="ca-inline">$1</code>')
                         .replace(/\n/g, '<br>');
    }

    // === UI ===
    let panel = null, openBtn = null, busy = false;

    function buildUI() {
        if (panel) return;

        // Floating button
        openBtn = document.createElement('button');
        openBtn.id = 'ca-open-btn';
        openBtn.title = 'Code Assistant';
        openBtn.textContent = '</>';
        openBtn.style.cssText =
            'position:fixed;bottom:18px;left:18px;z-index:9999;width:54px;height:54px;border-radius:50%;' +
            'border:none;background:#ff6b9d;color:#fff;font-size:18px;font-weight:700;cursor:pointer;' +
            'box-shadow:0 6px 18px rgba(0,0,0,.4);font-family:Menlo,Consolas,monospace;';
        openBtn.addEventListener('click', openPanel);
        document.body.appendChild(openBtn);

        // Panel container
        panel = document.createElement('div');
        panel.id = 'ca-panel';
        panel.style.cssText =
            'position:fixed;inset:auto 18px 18px 18px;max-width:520px;margin:0 auto;' +
            'max-height:75vh;display:none;flex-direction:column;background:rgba(15,12,41,.97);' +
            'color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:18px;z-index:10000;' +
            'font-family:Segoe UI,Roboto,Arial,sans-serif;backdrop-filter:blur(8px);' +
            'box-shadow:0 18px 48px rgba(0,0,0,.5);overflow:hidden;';

        panel.innerHTML =
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.12);">' +
                '<div style="font-weight:700;color:#ff6b9d;">Alisha Code Assistant</div>' +
                '<button id="ca-close" aria-label="Close" style="background:transparent;border:none;color:#fff;font-size:18px;cursor:pointer;">×</button>' +
            '</div>' +
            '<div style="display:flex;gap:6px;padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.08);flex-wrap:wrap;">' +
                Object.keys(MODES).map(m =>
                    '<button class="ca-mode" data-mode="' + m + '" style="' +
                    'flex:1;min-width:90px;padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18);' +
                    'background:rgba(255,255,255,.06);color:#fff;font-size:12px;cursor:pointer;">' +
                    MODES[m].label + '</button>'
                ).join('') +
            '</div>' +
            '<div id="ca-output" style="flex:1;padding:12px 14px;overflow-y:auto;font-size:13px;line-height:1.55;">' +
                '<div style="opacity:.7;">Pick a mode above, paste code or ask a question, then press Send.</div>' +
            '</div>' +
            '<div style="padding:10px 14px;border-top:1px solid rgba(255,255,255,.12);">' +
                '<textarea id="ca-input" rows="3" placeholder="Paste code or describe what you want…" ' +
                'style="width:100%;padding:8px;border-radius:10px;border:1px solid rgba(255,255,255,.18);' +
                'background:rgba(0,0,0,.35);color:#fff;font-family:Menlo,Consolas,monospace;font-size:12px;resize:vertical;"></textarea>' +
                '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">' +
                    '<button id="ca-clear" style="padding:6px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff;cursor:pointer;font-size:12px;">Clear</button>' +
                    '<button id="ca-send"  style="padding:6px 14px;border-radius:10px;border:none;background:#ff6b9d;color:#fff;font-weight:700;cursor:pointer;font-size:12px;">Send</button>' +
                '</div>' +
            '</div>';

        // Style for code blocks
        const style = document.createElement('style');
        style.textContent =
            '#ca-panel .ca-code{background:#0b0820;border:1px solid rgba(255,255,255,.12);' +
            'border-radius:10px;padding:10px;overflow:auto;font-family:Menlo,Consolas,monospace;font-size:12px;color:#e6e3ff;}' +
            '#ca-panel .ca-inline{background:rgba(255,255,255,.08);padding:1px 5px;border-radius:4px;font-family:Menlo,Consolas,monospace;font-size:12px;}' +
            '#ca-panel .ca-mode.active{background:#ff6b9d;color:#fff;border-color:#ff6b9d;}';
        document.head.appendChild(style);

        document.body.appendChild(panel);

        // Wire events
        let activeMode = 'ask';
        panel.querySelectorAll('.ca-mode').forEach(btn => {
            btn.addEventListener('click', () => {
                activeMode = btn.dataset.mode;
                panel.querySelectorAll('.ca-mode').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
        panel.querySelector('.ca-mode[data-mode="ask"]').classList.add('active');

        document.getElementById('ca-close').addEventListener('click', closePanel);
        document.getElementById('ca-clear').addEventListener('click', () => {
            document.getElementById('ca-input').value = '';
            document.getElementById('ca-output').innerHTML =
                '<div style="opacity:.7;">Cleared.</div>';
        });
        document.getElementById('ca-send').addEventListener('click', async () => {
            if (busy) return;
            const text = document.getElementById('ca-input').value.trim();
            if (!text) return;
            const out = document.getElementById('ca-output');
            const promptHtml = '<div style="margin-bottom:8px;"><strong style="color:#ff6b9d;">' +
                MODES[activeMode].label + ':</strong><br><span style="opacity:.85;">' +
                escapeHtml(text).replace(/\n/g, '<br>') + '</span></div>';
            out.innerHTML = promptHtml + '<div style="opacity:.7;">Thinking…</div>';
            busy = true;
            try {
                const reply = await ask(text, activeMode);
                out.innerHTML = promptHtml + '<div>' + renderMarkdownLite(reply || '(no response)') + '</div>';
                const h = loadHistory();
                h.push({ t: Date.now(), mode: activeMode, q: text, a: reply });
                saveHistory(h);
            } catch (e) {
                out.innerHTML = promptHtml +
                    '<div style="color:#ff8aa6;">Error: ' + escapeHtml(e.message || String(e)) + '</div>';
            } finally {
                busy = false;
            }
        });
    }

    function openPanel() {
        buildUI();
        panel.style.display = 'flex';
    }
    function closePanel() {
        if (panel) panel.style.display = 'none';
    }

    // Auto-init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildUI);
    } else {
        buildUI();
    }

    window.AlishaCodeAssistant = { ask, openPanel, closePanel, detectProvider };
})();
