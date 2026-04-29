import { create } from 'zustand';

export type AppState = 'setup' | 'selectModel' | 'chat';
export type AvatarState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type ResponseLanguage = 'ar' | 'en' | 'ja';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface MemoryItem {
  id: string;
  content: string;
  order: number;
}

// Supported API providers
export type ApiProvider = 'gemini' | 'huggingface' | 'nvidia' | 'groq' | 'together' | 'openrouter' | 'cohere' | 'mistral';

export interface ApiKeyEntry {
  provider: ApiProvider;
  key: string;
}

export const DEFAULT_PERMANENT_MEMORY: MemoryItem[] = [
  {
    id: 'mem-1',
    content: 'AR: اسم المستخدم هو غيلان بن عقبة | EN/JP: The user name is magen gillan',
    order: 1,
  },
  {
    id: 'mem-2',
    content: 'أنت أفاتار ذكي اسمك اليشيا (Alisha). أنت لست مجرد مساعد، أنت اليشيا - شخصية فريدة بذاتها.',
    order: 2,
  },
  {
    id: 'mem-3',
    content: 'المستخدم لقبه الملك الأحمر (Red King) أو أكنا أوو (akna ow) باللغة اليابانية.',
    order: 3,
  },
];

interface AppStore {
  // App flow
  appState: AppState;
  setAppState: (state: AppState) => void;

  // API Keys - multi provider
  apiKeys: ApiKeyEntry[];
  setApiKeys: (keys: ApiKeyEntry[]) => void;
  getApiKey: (provider: ApiProvider) => string;
  activeProvider: ApiProvider;
  setActiveProvider: (provider: ApiProvider) => void;

  // Legacy support - kept for backward compatibility
  apiKey: string;
  setApiKey: (key: string) => void;

  // Models
  models: string[];
  setModels: (models: string[]) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;

  // Chat
  messages: Message[];
  addMessage: (msg: Message) => void;
  clearMessages: () => void;

  // Avatar state
  avatarState: AvatarState;
  setAvatarState: (state: AvatarState) => void;

  // Settings
  responseLanguage: ResponseLanguage;
  setResponseLanguage: (lang: ResponseLanguage) => void;

  // Background
  selectedBackground: string;
  setSelectedBackground: (bg: string) => void;

  // Permanent Memory
  permanentMemory: MemoryItem[];
  setPermanentMemory: (items: MemoryItem[]) => void;
  addPermanentMemory: (content: string) => void;
  removePermanentMemory: (id: string) => void;
  updatePermanentMemory: (id: string, content: string) => void;

  // Loading
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Error
  error: string | null;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  appState: 'setup',
  setAppState: (appState) => set({ appState }),

  // Multi-provider API keys
  apiKeys: [],
  setApiKeys: (apiKeys) => set({ apiKeys }),
  getApiKey: (provider) => {
    const entry = get().apiKeys.find((k) => k.provider === provider);
    return entry?.key || '';
  },
  activeProvider: 'gemini',
  setActiveProvider: (activeProvider) => set({ activeProvider }),

  // Legacy
  apiKey: '',
  setApiKey: (apiKey) => set({ apiKey }),

  models: [],
  setModels: (models) => set({ models }),
  selectedModel: '',
  setSelectedModel: (selectedModel) => set({ selectedModel }),

  messages: [],
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),

  avatarState: 'idle',
  setAvatarState: (avatarState) => set({ avatarState }),

  responseLanguage: 'ar',
  setResponseLanguage: (responseLanguage) => set({ responseLanguage }),

  selectedBackground: '',
  setSelectedBackground: (selectedBackground) => set({ selectedBackground }),

  permanentMemory: DEFAULT_PERMANENT_MEMORY,
  setPermanentMemory: (permanentMemory) => set({ permanentMemory }),
  addPermanentMemory: (content) =>
    set((state) => {
      const maxOrder = state.permanentMemory.reduce((max, m) => Math.max(max, m.order), 0);
      const newItem: MemoryItem = {
        id: `mem-${Date.now()}`,
        content,
        order: maxOrder + 1,
      };
      return { permanentMemory: [...state.permanentMemory, newItem] };
    }),
  removePermanentMemory: (id) =>
    set((state) => ({
      permanentMemory: state.permanentMemory.filter((m) => m.id !== id).map((m, i) => ({ ...m, order: i + 1 })),
    })),
  updatePermanentMemory: (id, content) =>
    set((state) => ({
      permanentMemory: state.permanentMemory.map((m) => (m.id === id ? { ...m, content } : m)),
    })),

  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  error: null,
  setError: (error) => set({ error }),
}));
