// Server-side chat proxy route
// Uses keys from .env.local as defaults when no manual key is provided

import { NextRequest, NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/gemini-client';
import type { ApiProvider } from '@/store/useAppStore';

// Map provider IDs to their env var names
const ENV_KEY_MAP: Record<string, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  gemini: 'GOOGLE_AI_API_KEY',
  nvidia: 'NVIDIA_NIM_API_KEY',
  abliteration: 'ABLITERATION_API_KEY',
  huggingface: 'HUGGINGFACE_API_KEY',
  groq: 'GROQ_API_KEY',
  together: 'TOGETHER_API_KEY',
  cohere: 'COHERE_API_KEY',
  mistral: 'MISTRAL_API_KEY',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      provider,
      model,
      messages,
      systemPrompt,
      apiKey: clientKey,
    }: {
      provider: ApiProvider;
      model: string;
      messages: { role: string; content: string }[];
      systemPrompt: string;
      apiKey?: string;
    } = body;

    if (!provider || !model || !messages) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, model, messages' },
        { status: 400 }
      );
    }

    // Use client-provided key, or fall back to server env key
    const envVarName = ENV_KEY_MAP[provider];
    const apiKey = clientKey || (envVarName ? process.env[envVarName] : undefined);

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key available for this provider' },
        { status: 401 }
      );
    }

    const p = PROVIDERS[provider];
    if (!p) {
      return NextResponse.json(
        { error: `Unknown provider: ${provider}` },
        { status: 400 }
      );
    }

    const text = await p.sendMessage(apiKey, model, messages, systemPrompt);
    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
