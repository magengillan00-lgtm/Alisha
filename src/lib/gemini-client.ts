// Client-side Gemini API service
// Calls Gemini REST API directly from the browser to avoid server region restrictions

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export interface GeminiModel {
  name: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

// Only show these model name patterns (exclude embedding, vision-only, etc.)
const ALLOWED_MODEL_PATTERNS = [
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'chat-bison',
];

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

  // Step 1: Filter only models with generateContent AND matching allowed patterns
  let models = (data.models || [])
    .filter((m: GeminiModel) => {
      if (!m.supportedGenerationMethods?.includes('generateContent')) return false;
      const modelName = m.name.replace('models/', '');
      return ALLOWED_MODEL_PATTERNS.some((pattern) => modelName.includes(pattern));
    })
    .map((m: GeminiModel) => m.name.replace('models/', ''));

  // Step 2: Verify each model actually works with a tiny request
  const verifiedModels: string[] = [];
  const testPromises = models.map(async (model: string) => {
    try {
      const testRes = await fetch(
        `${BASE_URL}/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        }
      );
      if (testRes.ok) {
        return model;
      }
      return null;
    } catch {
      return null;
    }
  });

  const results = await Promise.allSettled(testPromises);
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      verifiedModels.push(r.value);
    }
  }

  // Step 3: Sort with recommended models first
  const priority = (name: string) => {
    if (name.includes('2.5-flash')) return 0;
    if (name.includes('2.5-pro')) return 1;
    if (name.includes('2.0-flash') && !name.includes('lite')) return 2;
    if (name.includes('2.0-flash-lite')) return 3;
    if (name.includes('1.5-flash')) return 4;
    if (name.includes('1.5-pro')) return 5;
    return 6;
  };

  verifiedModels.sort((a, b) => priority(a) - priority(b));

  if (verifiedModels.length === 0) {
    throw new Error('لا توجد موديلات متاحة لهذا المفتاح. تأكد من تفعيل Gemini API في Google AI Studio.');
  }

  return { models: verifiedModels };
}

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
    if (res.status === 400 && errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
      throw new Error('هذا الموديل غير متاح لمفتاحك. يرجى اختيار موديل آخر من الإعدادات.');
    }
    if (res.status === 400 && errorMsg.includes('quota')) {
      throw new Error('تم تجاوز حصة هذا الموديل. جرب موديل آخر مثل gemini-1.5-flash أو gemini-2.0-flash.');
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
    const blockReason = data?.candidates?.[0]?.finishReason;
    if (blockReason === 'SAFETY') {
      throw new Error('تم حظر الرد بسبب سياسات الأمان. حاول سؤال مختلف.');
    }
    throw new Error('لم يتم الحصول على رد من Gemini. حاول مرة أخرى.');
  }

  return { text };
}
