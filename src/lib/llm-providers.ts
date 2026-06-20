// LLM Provider configuration with models per provider
// ✅ تم إزالة hasServerKey/envKeyVar (لا server في static export)

import type { ApiProvider } from '@/store/useAppStore';

export interface ProviderModelConfig {
  id: ApiProvider;
  name: string;
  models: string[];
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
  },
  {
    id: 'gemini',
    name: 'Google AI Studio',
    models: [
      'gemini-2.0-flash',
      'gemini-2.5-flash-preview-05-20',
    ],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    models: [
      'meta/llama-3.1-8b-instruct',
      'nvidia/llama-3.1-nemotron-70b-instruct',
    ],
  },
  {
    id: 'abliteration',
    name: 'Abliteration AI',
    models: [
      'gpt-4o-mini',
      'claude-3.5-sonnet',
    ],
  },
  {
    id: 'huggingface',
    name: 'HuggingFace',
    models: [
      'mistralai/Mistral-7B-Instruct-v0.3',
      'google/gemma-2-2b-it',
    ],
  },
  {
    id: 'groq',
    name: 'Groq',
    models: [],
  },
  {
    id: 'together',
    name: 'Together AI',
    models: [],
  },
  {
    id: 'cohere',
    name: 'Cohere',
    models: [],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    models: [],
  },
  {
    id: 'agentrouter',
    name: 'Agent Router',
    models: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.0-flash',
    ],
  },
  {
    id: 'zai',
    name: 'Z.ai (GLM)',
    models: [
      'glm-4.5',
      'glm-4.5-air',
      'glm-4.6',
      'glm-4.7',
      'glm-5',
      'glm-5-turbo',
      'glm-5.1',
      'glm-5.2',
    ],
  },
];

/**
 * Get default models for a provider
 */
export function getDefaultModels(provider: ApiProvider): string[] {
  const config = LLM_PROVIDER_MODELS.find((p) => p.id === provider);
  return config?.models ?? [];
}

/**
 * Get provider display name
 */
export function getProviderName(provider: ApiProvider): string {
  const config = LLM_PROVIDER_MODELS.find((p) => p.id === provider);
  return config?.name ?? provider;
}
