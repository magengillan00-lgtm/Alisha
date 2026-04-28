import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { apiKey, model, messages, language } = await req.json();

    if (!apiKey || !model || !messages) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({ model });

    const langInstructions: Record<string, string> = {
      ar: 'أجب دائماً باللغة العربية فقط. كن ودوداً ومفيداً. أجب بإيجاز ومناسبة للمحادثة الصوتية.',
      en: 'Always respond in English only. Be friendly and helpful. Keep responses concise and suitable for voice conversation.',
      ja: '常に日本語のみで応答してください。フレンドリーで役立つ対応をお願いします。音声会話に適した簡潔な回答を心がけてください。',
    };

    const systemPrompt = langInstructions[language] || langInstructions['ar'];

    const history = messages
      .filter((m: { role: string }) => m.role !== 'system')
      .map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const chat = genModel.startChat({
      history: history.slice(0, -1),
    });

    const lastMessage = messages[messages.length - 1];
    const prompt = `${systemPrompt}\n\nUser: ${lastMessage.content}`;

    const result = await chat.sendMessage(prompt);
    const response = result.response;
    const text = response.text();

    return NextResponse.json({ text });
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number };
    console.error('Gemini API error:', error);
    return NextResponse.json(
      { error: err.message || 'Failed to get response from Gemini' },
      { status: err.status || 500 }
    );
  }
}
