import { NextRequest, NextResponse } from 'next/server';

/**
 * Web3 / Alchemy API Route
 * Proxies blockchain queries through Alchemy RPC
 */

interface Web3Request {
  method: string;
  params?: any[];
  customApiKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: Web3Request = await request.json();
    const { method, params = [], customApiKey } = body;

    const apiKey = customApiKey || process.env.ALCHEMY_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'مفتاح Alchemy API غير متوفر' }, { status: 400 });
    }

    const endpoint = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Alchemy API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Alchemy RPC error');
    }

    return NextResponse.json({ result: data.result });
  } catch (error: any) {
    console.error('Web3 API error:', error);
    return NextResponse.json(
      { error: 'فشل في استعلام البلوكتشين', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
