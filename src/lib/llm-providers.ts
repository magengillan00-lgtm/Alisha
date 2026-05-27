/**
 * LLM Provider System
 * Supports: z-ai-web-dev-sdk, OpenRouter, Google AI Studio, NVIDIA, Abliteration, HuggingFace, Alchemy (Web3)
 */

export type LLMProviderId = 'zai' | 'openrouter' | 'google' | 'nvidia' | 'abliteration' | 'huggingface';

export interface LLMProviderConfig {
  id: LLMProviderId;
  name: string;
  nameAr: string;
  description: string;
  envKey: string;
  defaultModel: string;
  models: { id: string; name: string }[];
  apiFormat: 'openai' | 'gemini' | 'huggingface';
  endpoint: string;
  supportsCustomKey: boolean;
}

export const LLM_PROVIDERS: Record<LLMProviderId, LLMProviderConfig> = {
  zai: {
    id: 'zai',
    name: 'Z-AI SDK',
    nameAr: 'Z-AI',
    description: 'Built-in AI assistant',
    envKey: 'ZAI_API_KEY',
    defaultModel: 'default',
    models: [{ id: 'default', name: 'Default Model' }],
    apiFormat: 'openai',
    endpoint: '/api/chat',
    supportsCustomKey: false,
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    nameAr: 'OpenRouter',
    description: 'Multi-model LLM proxy with 100+ models',
    envKey: 'OPENROUTER_API_KEY',
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
      { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)' },
      { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B (Free)' },
    ],
    apiFormat: 'openai',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    supportsCustomKey: true,
  },
  google: {
    id: 'google',
    name: 'Google AI Studio',
    nameAr: 'Google AI Studio',
    description: 'Gemini models with excellent Arabic support',
    envKey: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.0-flash',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    ],
    apiFormat: 'gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    supportsCustomKey: true,
  },
  nvidia: {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    nameAr: 'NVIDIA NIM',
    description: 'NVIDIA accelerated AI models',
    envKey: 'NVIDIA_API_KEY',
    defaultModel: 'meta/llama-3.1-8b-instruct',
    models: [
      { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B' },
      { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Nemotron 70B' },
      { id: 'mistralai/mixtral-8x7b-instruct-v0.1', name: 'Mixtral 8x7B' },
    ],
    apiFormat: 'openai',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    supportsCustomKey: true,
  },
  abliteration: {
    id: 'abliteration',
    name: 'Abliteration AI',
    nameAr: 'Abliteration AI',
    description: 'Abliteration AI - Uncensored models',
    envKey: 'ABLITERATION_API_KEY',
    defaultModel: 'abliterated-model',
    models: [
      { id: 'abliterated-model', name: 'Abliterated Model' },
    ],
    apiFormat: 'openai',
    endpoint: 'https://api.abliteration.ai/v1/chat/completions',
    supportsCustomKey: true,
  },
  huggingface: {
    id: 'huggingface',
    name: 'HuggingFace',
    nameAr: 'HuggingFace',
    description: 'Open-source models via HuggingFace Inference API',
    envKey: 'HUGGINGFACE_API_KEY',
    defaultModel: 'mistralai/Mistral-7B-Instruct-v0.3',
    models: [
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B Instruct' },
      { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B' },
      { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B' },
      { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B' },
    ],
    apiFormat: 'huggingface',
    endpoint: 'https://api-inference.huggingface.co/models',
    supportsCustomKey: true,
  },
};

export const PROVIDER_LIST = Object.values(LLM_PROVIDERS);

// Default provider (Z-AI works reliably, users can switch)
export const DEFAULT_LLM_PROVIDER: LLMProviderId = 'zai';
export const DEFAULT_LLM_MODEL = 'default';

// LocalStorage keys for custom API keys
const API_KEYS_STORAGE_KEY = 'alisha_api_keys';

export interface CustomAPIKeys {
  openrouter?: string;
  google?: string;
  nvidia?: string;
  abliteration?: string;
  huggingface?: string;
  alchemy?: string;
  assemblyai?: string;
}

export function loadCustomAPIKeys(): CustomAPIKeys {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(API_KEYS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveCustomAPIKeys(keys: CustomAPIKeys): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(keys));
  } catch (e) {
    console.error('Failed to save API keys:', e);
  }
}

export function getAPIKeyForProvider(provider: LLMProviderId, customKeys: CustomAPIKeys): string | undefined {
  // ZAI doesn't use custom API keys - it uses the SDK internally
  if (provider === 'zai') return undefined;

  const envKeyMap: Record<LLMProviderId, keyof CustomAPIKeys | undefined> = {
    zai: undefined,
    openrouter: 'openrouter',
    google: 'google',
    nvidia: 'nvidia',
    abliteration: 'abliteration',
    huggingface: 'huggingface',
  };
  const key = envKeyMap[provider];
  return key ? customKeys[key] : undefined;
}

// Alchemy/Web3 provider (separate from LLM)
export interface Web3ProviderConfig {
  id: 'alchemy';
  name: string;
  nameAr: string;
  envKey: string;
  endpoint: string;
}

export const WEB3_PROVIDER: Web3ProviderConfig = {
  id: 'alchemy',
  name: 'Alchemy',
  nameAr: 'Alchemy',
  envKey: 'ALCHEMY_API_KEY',
  endpoint: 'https://eth-mainnet.g.alchemy.com/v2',
};
