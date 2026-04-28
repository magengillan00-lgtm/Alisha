import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Use REST API to list models
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: 'مفتاح API غير صالح. يرجى التحقق من المفتاح وإعادة المحاولة.' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: errorData.error?.message || 'فشل في جلب قائمة الموديلات' },
        { status: res.status }
      );
    }

    const data = await res.json();

    const models = (data.models || [])
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        m.supportedGenerationMethods?.includes('generateContent')
      )
      .map((m: { name: string }) => m.name.replace('models/', ''))
      .sort();

    if (models.length === 0) {
      // Fallback to known models if API returns empty
      return NextResponse.json({
        models: [
          'gemini-2.5-flash-preview-05-20',
          'gemini-2.5-pro-preview-05-06',
          'gemini-2.0-flash',
          'gemini-2.0-flash-lite',
          'gemini-1.5-flash',
          'gemini-1.5-pro',
        ],
      });
    }

    return NextResponse.json({ models });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('List models error:', error);
    return NextResponse.json(
      { error: err.message || 'فشل في جلب قائمة الموديلات' },
      { status: 500 }
    );
  }
}
