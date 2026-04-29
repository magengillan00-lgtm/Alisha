// Multi-provider AI API client
// Supports: Gemini, HuggingFace, NVIDIA, Groq, Together, OpenRouter, Cohere, Mistral

import { ApiProvider, type MemoryItem } from '@/store/useAppStore';

// ============ PROVIDER CONFIGURATIONS ============

interface ProviderConfig {
  name: string;
  baseUrl: string;
  listEndpoint: string;
  chatEndpoint: (model: string) => string;
  listModels: (apiKey: string) => Promise<string[]>;
  sendMessage: (apiKey: string, model: string, messages: { role: string; content: string }[], systemPrompt: string) => Promise<string>;
  testModel: (apiKey: string, model: string) => Promise<boolean>;
}

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const ALLOWED_GEMINI_PATTERNS = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

// ============ GEMINI PROVIDER ============

const geminiProvider: ProviderConfig = {
  name: 'Gemini',
  baseUrl: GEMINI_BASE_URL,
  listEndpoint: `${GEMINI_BASE_URL}/models`,
  chatEndpoint: (model) => `${GEMINI_BASE_URL}/models/${model}:generateContent`,
  listModels: async (apiKey: string): Promise<string[]> => {
    const res = await fetch(`${GEMINI_BASE_URL}/models?key=${apiKey}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || '';
      if (res.status === 400 && errorMsg.includes('location is not supported')) {
        throw new Error('موقعك الجغرافي غير مدعوم لاستخدام Gemini API.');
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error('مفتاح Gemini API غير صالح.');
      }
      throw new Error(errorMsg || 'فشل في جلب قائمة موديلات Gemini');
    }
    const data = await res.json();
    let models = (data.models || [])
      .filter((m: { supportedGenerationMethods?: string[]; name: string }) => {
        if (!m.supportedGenerationMethods?.includes('generateContent')) return false;
        const modelName = m.name.replace('models/', '');
        return ALLOWED_GEMINI_PATTERNS.some((p) => modelName.includes(p));
      })
      .map((m: { name: string }) => m.name.replace('models/', ''));
    return models;
  },
  sendMessage: async (apiKey: string, model: string, messages: { role: string; content: string }[], systemPrompt: string): Promise<string> => {
    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const res = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.9, topP: 0.95, topK: 40, maxOutputTokens: 1024 },
      }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || '';
      if (res.status === 429) throw new Error('تم تجاوز حد الطلبات. انتظر قليلاً.');
      throw new Error(errorMsg || 'حدث خطأ أثناء الاتصال بـ Gemini');
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('لم يتم الحصول على رد من Gemini.');
    return text;
  },
  testModel: async (apiKey: string, model: string): Promise<boolean> => {
    try {
      const res = await fetch(`${GEMINI_BASE_URL}/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

// ============ HUGGINGFACE PROVIDER ============

const huggingfaceProvider: ProviderConfig = {
  name: 'HuggingFace',
  baseUrl: 'https://api-inference.huggingface.co',
  listEndpoint: 'https://huggingface.co/api/models',
  chatEndpoint: (model) => `https://api-inference.huggingface.co/models/${model}/v1/chat/completions`,
  listModels: async (apiKey: string): Promise<string[]> => {
    // Common free text generation models on HF
    const commonModels = [
      'mistralai/Mistral-7B-Instruct-v0.3',
      'google/gemma-2-2b-it',
      'google/gemma-2-9b-it',
      'microsoft/Phi-3-mini-4k-instruct',
      'meta-llama/Meta-Llama-3-8B-Instruct',
      'HuggingFaceH4/zephyr-7b-beta',
    ];
    // Verify which ones are available
    const verified = await Promise.allSettled(
      commonModels.map(async (model) => {
        try {
          const res = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
          });
          if (res.ok || res.status === 503) return model; // 503 = model loading, still valid
          return null;
        } catch {
          return null;
        }
      })
    );
    return verified.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value !== null).map((r) => r.value);
  },
  sendMessage: async (apiKey: string, model: string, messages: { role: string; content: string }[], systemPrompt: string): Promise<string> => {
    const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: allMessages, max_tokens: 1024, temperature: 0.9 }),
    });
    if (!res.ok) {
      if (res.status === 503) throw new Error('الموديل قيد التحميل حالياً. حاول مرة أخرى بعد قليل.');
      throw new Error('حدث خطأ أثناء الاتصال بـ HuggingFace');
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || 'لم يتم الحصول على رد.';
  },
  testModel: async (apiKey: string, model: string): Promise<boolean> => {
    try {
      const res = await fetch(`https://api-inference.huggingface.co/models/${model}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
      });
      return res.ok || res.status === 503;
    } catch {
      return false;
    }
  },
};

// ============ NVIDIA PROVIDER ============

const nvidiaProvider: ProviderConfig = {
  name: 'NVIDIA',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  listEndpoint: 'https://integrate.api.nvidia.com/v1/models',
  chatEndpoint: (model) => `https://integrate.api.nvidia.com/v1/chat/completions`,
  listModels: async (apiKey: string): Promise<string[]> => {
    const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error('مفتاح NVIDIA API غير صالح.');
    const data = await res.json();
    // Filter for chat models
    const chatModels = (data.data || [])
      .filter((m: { id: string }) => !m.id.includes('embedding') && !m.id.includes('ranking') && !m.id.includes('rerank'))
      .map((m: { id: string }) => m.id);
    return chatModels.slice(0, 30); // Limit to 30
  },
  sendMessage: async (apiKey: string, model: string, messages: { role: string; content: string }[], systemPrompt: string): Promise<string> => {
    const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: allMessages, max_tokens: 1024, temperature: 0.9 }),
    });
    if (!res.ok) throw new Error('حدث خطأ أثناء الاتصال بـ NVIDIA API');
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || 'لم يتم الحصول على رد.';
  },
  testModel: async (apiKey: string, model: string): Promise<boolean> => {
    try {
      const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

// ============ GROQ PROVIDER ============

const groqProvider: ProviderConfig = {
  name: 'Groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  listEndpoint: 'https://api.groq.com/openai/v1/models',
  chatEndpoint: () => 'https://api.groq.com/openai/v1/chat/completions',
  listModels: async (apiKey: string): Promise<string[]> => {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error('مفتاح Groq API غير صالح.');
    const data = await res.json();
    return (data.data || []).map((m: { id: string }) => m.id);
  },
  sendMessage: async (apiKey: string, model: string, messages: { role: string; content: string }[], systemPrompt: string): Promise<string> => {
    const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: allMessages, max_tokens: 1024, temperature: 0.9 }),
    });
    if (!res.ok) throw new Error('حدث خطأ أثناء الاتصال بـ Groq API');
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || 'لم يتم الحصول على رد.';
  },
  testModel: async (apiKey: string, model: string): Promise<boolean> => {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

// ============ TOGETHER PROVIDER ============

const togetherProvider: ProviderConfig = {
  name: 'Together',
  baseUrl: 'https://api.together.xyz/v1',
  listEndpoint: 'https://api.together.xyz/v1/models',
  chatEndpoint: () => 'https://api.together.xyz/v1/chat/completions',
  listModels: async (apiKey: string): Promise<string[]> => {
    const res = await fetch('https://api.together.xyz/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error('مفتاح Together API غير صالح.');
    const data = await res.json();
    return (data.data || []).map((m: { id: string }) => m.id);
  },
  sendMessage: async (apiKey: string, model: string, messages: { role: string; content: string }[], systemPrompt: string): Promise<string> => {
    const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    const res = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: allMessages, max_tokens: 1024, temperature: 0.9 }),
    });
    if (!res.ok) throw new Error('حدث خطأ أثناء الاتصال بـ Together API');
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || 'لم يتم الحصول على رد.';
  },
  testModel: async (apiKey: string, model: string): Promise<boolean> => {
    try {
      const res = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

// ============ OPENROUTER PROVIDER ============

const openrouterProvider: ProviderConfig = {
  name: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  listEndpoint: 'https://openrouter.ai/api/v1/models',
  chatEndpoint: () => 'https://openrouter.ai/api/v1/chat/completions',
  listModels: async (apiKey: string): Promise<string[]> => {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error('مفتاح OpenRouter API غير صالح.');
    const data = await res.json();
    // Filter free models
    const freeModels = (data.data || [])
      .filter((m: { pricing?: { prompt?: string } }) => (m.pricing?.prompt || '0') === '0')
      .map((m: { id: string }) => m.id);
    return freeModels.slice(0, 30);
  },
  sendMessage: async (apiKey: string, model: string, messages: { role: string; content: string }[], systemPrompt: string): Promise<string> => {
    const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: allMessages, max_tokens: 1024, temperature: 0.9 }),
    });
    if (!res.ok) throw new Error('حدث خطأ أثناء الاتصال بـ OpenRouter API');
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || 'لم يتم الحصول على رد.';
  },
  testModel: async (apiKey: string, model: string): Promise<boolean> => {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

// ============ COHERE PROVIDER ============

const cohereProvider: ProviderConfig = {
  name: 'Cohere',
  baseUrl: 'https://api.cohere.ai/v1',
  listEndpoint: 'https://api.cohere.ai/v1/models',
  chatEndpoint: () => 'https://api.cohere.ai/v1/chat',
  listModels: async (apiKey: string): Promise<string[]> => {
    const res = await fetch('https://api.cohere.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error('مفتاح Cohere API غير صالح.');
    const data = await res.json();
    return (data.models || []).map((m: { name: string }) => m.name);
  },
  sendMessage: async (apiKey: string, model: string, messages: { role: string; content: string }[], systemPrompt: string): Promise<string> => {
    const chatHistory = [];
    let lastMessage = '';
    for (const m of messages) {
      if (m.role === 'user') lastMessage = m.content;
      else if (m.role === 'assistant') chatHistory.push({ role: 'CHATBOT', message: m.content });
      else chatHistory.push({ role: 'USER', message: m.content });
    }
    const res = await fetch('https://api.cohere.ai/v1/chat', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        message: lastMessage,
        preamble: systemPrompt,
        chat_history: chatHistory,
      }),
    });
    if (!res.ok) throw new Error('حدث خطأ أثناء الاتصال بـ Cohere API');
    const data = await res.json();
    return data.text || 'لم يتم الحصول على رد.';
  },
  testModel: async (apiKey: string, model: string): Promise<boolean> => {
    try {
      const res = await fetch('https://api.cohere.ai/v1/chat', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, message: 'hi', max_tokens: 5 }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

// ============ MISTRAL PROVIDER ============

const mistralProvider: ProviderConfig = {
  name: 'Mistral',
  baseUrl: 'https://api.mistral.ai/v1',
  listEndpoint: 'https://api.mistral.ai/v1/models',
  chatEndpoint: () => 'https://api.mistral.ai/v1/chat/completions',
  listModels: async (apiKey: string): Promise<string[]> => {
    const res = await fetch('https://api.mistral.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error('مفتاح Mistral API غير صالح.');
    const data = await res.json();
    return (data.data || []).map((m: { id: string }) => m.id);
  },
  sendMessage: async (apiKey: string, model: string, messages: { role: string; content: string }[], systemPrompt: string): Promise<string> => {
    const allMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: allMessages, max_tokens: 1024, temperature: 0.9 }),
    });
    if (!res.ok) throw new Error('حدث خطأ أثناء الاتصال بـ Mistral API');
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || 'لم يتم الحصول على رد.';
  },
  testModel: async (apiKey: string, model: string): Promise<boolean> => {
    try {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 5 }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
};

// ============ PROVIDER REGISTRY ============

export const PROVIDERS: Record<ApiProvider, ProviderConfig> = {
  gemini: geminiProvider,
  huggingface: huggingfaceProvider,
  nvidia: nvidiaProvider,
  groq: groqProvider,
  together: togetherProvider,
  openrouter: openrouterProvider,
  cohere: cohereProvider,
  mistral: mistralProvider,
};

export const PROVIDER_INFO: { id: ApiProvider; name: string; nameAr: string; icon: string; color: string; keyPlaceholder: string }[] = [
  { id: 'gemini', name: 'Google Gemini', nameAr: 'جوجل جيميني', icon: '⚡', color: 'from-blue-500 to-cyan-500', keyPlaceholder: 'AIza...' },
  { id: 'huggingface', name: 'HuggingFace', nameAr: 'هاجينج فيس', icon: '🤗', color: 'from-yellow-500 to-orange-500', keyPlaceholder: 'hf_...' },
  { id: 'nvidia', name: 'NVIDIA NIM', nameAr: 'إنفيديا', icon: '💚', color: 'from-green-500 to-emerald-600', keyPlaceholder: 'nvapi-...' },
  { id: 'groq', name: 'Groq', nameAr: 'جروك', icon: '🚀', color: 'from-orange-500 to-red-500', keyPlaceholder: 'gsk_...' },
  { id: 'together', name: 'Together AI', nameAr: 'توجذر', icon: '🔗', color: 'from-purple-500 to-pink-500', keyPlaceholder: 'Bearer ...' },
  { id: 'openrouter', name: 'OpenRouter', nameAr: 'أوبن راوتر', icon: '🌐', color: 'from-indigo-500 to-violet-500', keyPlaceholder: 'sk-or-...' },
  { id: 'cohere', name: 'Cohere', nameAr: 'كوهير', icon: '🔮', color: 'from-teal-500 to-cyan-500', keyPlaceholder: 'Bearer ...' },
  { id: 'mistral', name: 'Mistral AI', nameAr: 'ميسترال', icon: '🌪️', color: 'from-sky-500 to-blue-600', keyPlaceholder: 'Bearer ...' },
];

// ============ PUBLIC API FUNCTIONS ============

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const LANG_INSTRUCTIONS: Record<string, string> = {
  ar: `أنت مساعد صوتي ذكي مع أفاتار Live2D.
- أجب دائماً باللغة العربية فقط، بغض النظر عن لغة سؤال المستخدم.
- كن ودوداً وطبيعياً كأنك تتحدث مع صديق.
- أجب بإيجاز ومناسب للمحادثة الصوتية (جمل قصيرة).
- لا تستخدم Markdown أو رموز خاصة في الرد.
- تجنب القوائم المرقمة والنقاط، استخدم جمل عادية.`,
  en: `You are a smart voice assistant with a Live2D avatar.
- Always respond in English only, regardless of the user's input language.
- Be friendly and natural, like talking to a friend.
- Keep responses concise and suitable for voice conversation (short sentences).
- Do not use Markdown or special symbols in your response.
- Avoid numbered lists and bullet points, use normal sentences.`,
  ja: `あなたはLive2Dアバター付きのスマート音声アシスタントです。
- ユーザーの入力言語に関係なく、常に日本語のみで応答してください。
- 友達と話すように、親しみやすく自然に答えてください。
- 音声会話に適した簡潔な回答（短い文）を心がけてください。
- Markdownや特殊記号は使わないでください。
- 番号付きリストや箇条書きは避け、普通の文を使ってください。`,
};

function buildSystemPrompt(language: string, permanentMemory: MemoryItem[]): string {
  const langInstruction = LANG_INSTRUCTIONS[language] || LANG_INSTRUCTIONS['ar'];
  if (permanentMemory.length === 0) return langInstruction;

  const memoryBlock = permanentMemory
    .sort((a, b) => a.order - b.order)
    .map((m) => `[${m.order}] ${m.content}`)
    .join('\n');

  return `${langInstruction}\n\n--- تعليمات مهمة من ملف الذاكرة الدائمة (يجب اتباعها دائماً) ---\n${memoryBlock}\n--- نهاية التعليمات ---`;
}

export async function listModels(provider: ApiProvider, apiKey: string): Promise<{ models: string[] }> {
  const p = PROVIDERS[provider];
  let models = await p.listModels(apiKey);

  // Verify each model works
  const verifiedModels: string[] = [];
  const batchSize = 5;
  for (let i = 0; i < models.length; i += batchSize) {
    const batch = models.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map((m) => p.testModel(apiKey, m)));
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === 'fulfilled' && results[j].value) {
        verifiedModels.push(batch[j]);
      }
    }
  }

  if (verifiedModels.length === 0) {
    throw new Error(`لا توجد موديلات متاحة لمفتاح ${p.name}. تأكد من صحة المفتاح.`);
  }

  return { models: verifiedModels };
}

export async function sendMessage(
  provider: ApiProvider,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  language: string,
  permanentMemory: MemoryItem[]
): Promise<{ text: string }> {
  const p = PROVIDERS[provider];
  const systemPrompt = buildSystemPrompt(language, permanentMemory);
  const formattedMessages = messages.map((m) => ({ role: m.role, content: m.content }));
  const text = await p.sendMessage(apiKey, model, formattedMessages, systemPrompt);
  return { text };
}

// Legacy support for backward compatibility
export { sendMessage as _legacySendMessage };
