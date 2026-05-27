import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { customApiKey } = body;
    const apiKey = customApiKey || process.env.ASSEMBLYAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'مفتاح AssemblyAI API غير متوفر' },
        { status: 500 }
      );
    }

    const res = await fetch(
      'https://streaming.assemblyai.com/v3/token?expires_in_seconds=480',
      {
        headers: { authorization: apiKey },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('AssemblyAI token error:', res.status, text);
      return NextResponse.json(
        { error: 'فشل في إنشاء رمز AssemblyAI' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ token: data.token });
  } catch (error: any) {
    console.error('AssemblyAI token minting error:', error);
    return NextResponse.json(
      { error: 'خطأ داخلي في إنشاء الرمز' },
      { status: 500 }
    );
  }
}

// Also support GET for backward compatibility
export async function GET(request: NextRequest) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'مفتاح AssemblyAI API غير متوفر' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      'https://streaming.assemblyai.com/v3/token?expires_in_seconds=480',
      {
        headers: { authorization: apiKey },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: 'فشل في إنشاء رمز AssemblyAI' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ token: data.token });
  } catch (error: any) {
    console.error('AssemblyAI token minting error:', error);
    return NextResponse.json(
      { error: 'خطأ داخلي في إنشاء الرمز' },
      { status: 500 }
    );
  }
}
