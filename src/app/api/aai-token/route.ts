import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'AssemblyAI API key not configured' },
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
      const text = await res.text();
      console.error('AssemblyAI token error:', res.status, text);
      return NextResponse.json(
        { error: 'Failed to mint AssemblyAI token', details: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ token: data.token });
  } catch (error: any) {
    console.error('AssemblyAI token minting error:', error);
    return NextResponse.json(
      { error: 'Internal error minting token' },
      { status: 500 }
    );
  }
}
