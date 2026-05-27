// Alchemy Ethereum RPC proxy
// Proxies eth_* JSON-RPC calls to Alchemy

import { NextRequest, NextResponse } from 'next/server';

const ALCHEMY_BASE_URL = 'https://eth-mainnet.g.alchemy.com/v2';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ALCHEMY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Alchemy API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { method, params } = body;

    // Whitelist of allowed eth methods
    const allowedMethods = [
      'eth_blockNumber',
      'eth_getBalance',
      'eth_getTransactionCount',
      'eth_getBlockByNumber',
      'eth_getBlockByHash',
      'eth_getTransactionByHash',
      'eth_getTransactionReceipt',
      'eth_call',
      'eth_getCode',
      'eth_getStorageAt',
      'eth_gasPrice',
      'eth_estimateGas',
      'net_version',
      'eth_chainId',
    ];

    if (!method || !allowedMethods.includes(method)) {
      return NextResponse.json(
        { error: `Method not allowed: ${method}` },
        { status: 400 }
      );
    }

    const response = await fetch(`${ALCHEMY_BASE_URL}/${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params: params || [],
      }),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
