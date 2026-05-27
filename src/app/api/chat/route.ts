import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// ==========================================
// Multi-Provider LLM Chat API
// ==========================================

type LLMProviderId = 'zai' | 'openrouter' | 'google' | 'nvidia' | 'abliteration' | 'huggingface';

interface ChatRequest {
  message: string;
  history: Array<{ role: string; content: string }>;
  systemPrompt?: string;
  provider?: LLMProviderId;
  model?: string;
  customApiKey?: string;
}

// Build messages array for OpenAI-compatible APIs
function buildMessages(message: string, history: Array<{ role: string; content: string }>, systemPrompt?: string) {
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  if (Array.isArray(history)) {
    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  messages.push({ role: 'user', content: message });
  return messages;
}

// Get API key (custom override or server default)
function getApiKey(provider: LLMProviderId, customApiKey?: string): string | undefined {
  if (customApiKey) return customApiKey;

  const envMap: Record<LLMProviderId, string | undefined> = {
    zai: undefined, // ZAI uses SDK, no key needed
    openrouter: process.env.OPENROUTER_API_KEY,
    google: process.env.GEMINI_API_KEY,
    nvidia: process.env.NVIDIA_API_KEY,
    abliteration: process.env.ABLITERATION_API_KEY,
    huggingface: process.env.HUGGINGFACE_API_KEY,
  };

  return envMap[provider];
}

// ==========================================
// Provider-specific API call functions
// ==========================================

async function callZAI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const zai = await ZAI.create();
  const response = await zai.chat.completions.create({
    messages,
    stream: false,
    thinking: { type: 'disabled' },
  });
  return response.choices?.[0]?.message?.content || 'عذراً، لم أتمكن من الرد.';
}

async function callOpenAICompatible(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  extraHeaders?: Record<string, string>
): Promise<string> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'عذراً، لم أتمكن من الرد.';
}

async function callGemini(
  apiKey: string,
  model: string,
  message: string,
  history: Array<{ role: string; content: string }>,
  systemPrompt?: string
): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build Gemini format contents
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  // Add history
  if (Array.isArray(history)) {
    for (const msg of history) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  }

  // Add current message
  contents.push({
    role: 'user',
    parts: [{ text: message }],
  });

  const body: any = { contents };

  if (systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  body.generationConfig = {
    maxOutputTokens: 2048,
    temperature: 0.7,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'عذراً، لم أتمكن من الرد.';
}

async function callHuggingFace(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  // Use HuggingFace OpenAI-compatible API
  const endpoint = 'https://api-inference.huggingface.co/v1/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    // Fallback to older inference API format
    const fallbackEndpoint = `https://api-inference.huggingface.co/models/${model}`;
    const prompt = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + '\nAssistant:';

    const fallbackResponse = await fetch(fallbackEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 1024, temperature: 0.7 },
      }),
    });

    if (!fallbackResponse.ok) {
      const errorText = await fallbackResponse.text();
      throw new Error(`HuggingFace API error (${fallbackResponse.status}): ${errorText}`);
    }

    const data = await fallbackResponse.json();
    if (Array.isArray(data) && data[0]?.generated_text) {
      const text = data[0].generated_text;
      const assistantPart = text.split('Assistant:').pop();
      return assistantPart?.trim() || text.trim();
    }
    return typeof data === 'string' ? data : JSON.stringify(data);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'عذراً، لم أتمكن من الرد.';
}

// ==========================================
// Main POST handler
// ==========================================

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const {
      message,
      history = [],
      systemPrompt,
      provider = 'zai',
      model,
      customApiKey,
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = getApiKey(provider, customApiKey);

    // Route to the appropriate provider
    let reply: string;

    switch (provider) {
      case 'zai': {
        const messages = buildMessages(message, history, systemPrompt);
        reply = await callZAI(messages);
        break;
      }

      case 'openrouter': {
        if (!apiKey) throw new Error('مفتاح OpenRouter API غير متوفر');
        const messages = buildMessages(message, history, systemPrompt);
        const selectedModel = model || 'openai/gpt-4o-mini';
        reply = await callOpenAICompatible(
          'https://openrouter.ai/api/v1/chat/completions',
          apiKey,
          selectedModel,
          messages,
          {
            'HTTP-Referer': 'https://alisha.dpdns.org',
            'X-Title': 'Alisha AI Assistant',
          }
        );
        break;
      }

      case 'google': {
        if (!apiKey) throw new Error('مفتاح Google AI API غير متوفر');
        const selectedModel = model || 'gemini-2.0-flash';
        reply = await callGemini(apiKey, selectedModel, message, history, systemPrompt);
        break;
      }

      case 'nvidia': {
        if (!apiKey) throw new Error('مفتاح NVIDIA API غير متوفر');
        const messages = buildMessages(message, history, systemPrompt);
        const selectedModel = model || 'meta/llama-3.1-8b-instruct';
        reply = await callOpenAICompatible(
          'https://integrate.api.nvidia.com/v1/chat/completions',
          apiKey,
          selectedModel,
          messages
        );
        break;
      }

      case 'abliteration': {
        if (!apiKey) throw new Error('مفتاح Abliteration AI API غير متوفر');
        const messages = buildMessages(message, history, systemPrompt);
        const selectedModel = model || 'abliterated-model';
        reply = await callOpenAICompatible(
          'https://api.abliteration.ai/v1/chat/completions',
          apiKey,
          selectedModel,
          messages
        );
        break;
      }

      case 'huggingface': {
        if (!apiKey) throw new Error('مفتاح HuggingFace API غير متوفر');
        const messages = buildMessages(message, history, systemPrompt);
        const selectedModel = model || 'mistralai/Mistral-7B-Instruct-v0.3';
        reply = await callHuggingFace(apiKey, selectedModel, messages);
        break;
      }

      default: {
        const messages = buildMessages(message, history, systemPrompt);
        reply = await callZAI(messages);
      }
    }

    return NextResponse.json({ reply, provider, model: model || 'default' });
  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'فشل في الحصول على الرد', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
