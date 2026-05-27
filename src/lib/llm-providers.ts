// LLM Provider configuration with models per provider
// Used for quick model selection and server-side proxy routing

import type { ApiProvider } from '@/store/useAppStore';

export interface ProviderModelConfig {
  id: ApiProvider;
  name: string;
  models: string[];
  envKeyVar?: string; // Environment variable name for server-side key
  hasServerKey: boolean; // Whether .env.local has a default key
}

export const LLM_PROVIDER_MODELS: ProviderModelConfig[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    models: [
      'openai/gpt-4o-mini',
      'meta-llama/llama-3.1-8b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
    ],
    envKeyVar: 'OPENROUTER_API_KEY',
    hasServerKey: true,
  },
  {
    id: 'gemini',
    name: 'Google AI Studio',
    models: [
      'gemini-2.0-flash',
      'gemini-2.5-flash-preview-05-20',
    ],
    envKeyVar: 'GOOGLE_AI_API_KEY',
    hasServerKey: true,
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    models: [
      'meta/llama-3.1-8b-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
    ],
    envKeyVar: 'NVIDIA_NIM_API_KEY',
    hasServerKey: true,
  },
  {
    id: 'abliteration',
    name: 'Abliteration AI',
    models: [
      'gpt-4o-mini',
      'claude-3.5-sonnet',
    ],
    envKeyVar: 'ABLITERATION_API_KEY',
    hasServerKey: true,
  },
  {
    id: 'huggingface',
    name: 'HuggingFace',
    models: [
      'mistralai/Mistral-7B-Instruct-v0.3',
      'google/gemma-2-2b-it',
    ],
    envKeyVar: 'HUGGINGFACE_API_KEY',
    hasServerKey: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    models: [],
    hasServerKey: false,
  },
  {
    id: 'together',
    name: 'Together AI',
    models: [],
    hasServerKey: false,
  },
  {
    id: 'cohere',
    name: 'Cohere',
    models: [],
    hasServerKey: false,
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    models: [],
    hasServerKey: false,
  },
];

/**
 * Get the server-side env key for a provider (if available)
 */
export function getEnvKeyVar(provider: ApiProvider): string | undefined {
  const config = LLM_PROVIDER_MODELS.find((p) => p.id === provider);
  return config?.envKeyVar;
}

/**
 * Check if a provider has a server-side default key
 */
export function hasServerKey(provider: ApiProvider): boolean {
  const config = LLM_PROVIDER_MODELS.find((p) => p.id === provider);
  return config?.hasServerKey ?? false;
}

/**
 * Get default models for a provider
 */
export function getDefaultModels(provider: ApiProvider): string[] {
  const config = LLM_PROVIDER_MODELS.find((p) => p.id === provider);
  return config?.models ?? [];
}

/**
 * Get all providers that have server-side keys available
 */
export function getProvidersWithServerKeys(): ApiProvider[] {
  return LLM_PROVIDER_MODELS.filter((p) => p.hasServerKey).map((p) => p.id);
}
