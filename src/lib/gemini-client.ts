// Client-side Gemini API service
// Calls Gemini REST API directly from the browser to avoid server region restrictions

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiModel {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

export async function listModels(apiKey: string): Promise<{ models: string[] }> {
  const res = await fetch(`${BASE_URL}/models?key=${apiKey}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || '';

    if (res.status === 400) {
      if (errorMsg.includes('location is not supported')) {
        throw new Error('موقعك الجغرافي غير مدعوم لاستخدام Gemini API. يرجى استخدام VPN أو الاتصال من منطقة مختلفة.');
      }
      throw new Error('مفتاح API غير صالح. يرجى التحقق من المفتاح وإعادة المحاولة.');
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('مفتاح API غير صالح أو ليس لديك صلاحية الوصول.');
    }
    throw new Error(errorMsg || 'فشل في جلب قائمة الموديلات');
  }

  const data = await res.json();

  const models = (data.models || [])
    .filter((m: GeminiModel) =>
      m.supportedGenerationMethods?.includes('generateContent')
    )
    .map((m: GeminiModel) => m.name.replace('models/', ''))
    .sort();

  if (models.length === 0) {
    return {
      models: [
        'gemini-2.5-flash-preview-05-20',
        'gemini-2.5-pro-preview-05-06',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
      ],
    };
  }

  return { models };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const LANG_INSTRUCTIONS: Record<string, string> = {
  ar: 'أجب دائماً باللغة العربية فقط. كن ودوداً ومفيداً. أجب بإيجاز ومناسبة للمحادثة الصوتية.',
  en: 'Always respond in English only. Be friendly and helpful. Keep responses concise and suitable for voice conversation.',
  ja: '常に日本語のみで応答してください。フレンドリーで役立つ対応をお願いします。音声会話に適した簡潔な回答を心がけてください。',
};

export async function sendMessage(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  language: string
): Promise<{ text: string }> {
  const systemPrompt = LANG_INSTRUCTIONS[language] || LANG_INSTRUCTIONS['ar'];

  // Build Gemini API format
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const requestBody = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0.9,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 1024,
    },
  };

  const res = await fetch(
    `${BASE_URL}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || '';

    if (res.status === 400 && errorMsg.includes('location is not supported')) {
      throw new Error('موقعك الجغرافي غير مدعوم لاستخدام Gemini API.');
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('مفتاح API غير صالح.');
    }
    if (res.status === 429) {
      throw new Error('تم تجاوز حد الطلبات. يرجى الانتظار قليلاً ثم حاول مرة أخرى.');
    }

    throw new Error(errorMsg || 'حدث خطأ أثناء الاتصال بـ Gemini');
  }

  const data = await res.json();

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('لم يتم الحصول على رد من Gemini. حاول مرة أخرى.');
  }

  return { text };
}
