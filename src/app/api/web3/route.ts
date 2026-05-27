import { NextRequest, NextResponse } from 'next/server';

/**
 * Web3 / Alchemy API Route
 * Proxies blockchain queries through Alchemy RPC
 */

// Allowlist of safe read-only Ethereum RPC methods
const ALLOWED_METHODS = new Set([
  'eth_blockNumber',
  'eth_getBalance',
  'eth_call',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getLogs',
  'eth_gasPrice',
  'eth_estimateGas',
  'net_version',
  'web3_clientVersion',
  'alchemy_getTokenBalances',
  'alchemy_getTokenMetadata',
  'alchemy_getNftMetadata',
  'alchemy_getAssetTransfers',
]);

interface Web3Request {
  method: string;
  params?: any[];
  customApiKey?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: Web3Request = await request.json();
    const { method, params = [], customApiKey } = body;

    // Validate method against allowlist
    if (!ALLOWED_METHODS.has(method)) {
      return NextResponse.json(
        { error: `الطريقة '${method}' غير مسموح بها` },
        { status: 403 }
      );
    }

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
      throw new Error(`Alchemy API error (${response.status})`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Alchemy RPC error');
    }

    return NextResponse.json({ result: data.result });
  } catch (error: any) {
    console.error('Web3 API error:', error);
    return NextResponse.json(
      { error: 'فشل في استعلام البلوكتشين' },
      { status: 500 }
    );
  }
}
