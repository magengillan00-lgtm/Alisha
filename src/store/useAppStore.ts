import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppState = 'selectModel' | 'chat';
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
export type ApiProvider = 'gemini' | 'huggingface' | 'nvidia' | 'groq' | 'together' | 'openrouter' | 'cohere' | 'mistral' | 'abliteration';

// Supported STT providers
export type SttProvider = 'assemblyai' | 'webspeech';

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

  // API Keys - multi provider (manual)
  apiKeys: ApiKeyEntry[];
  setApiKeys: (keys: ApiKeyEntry[]) => void;
  addApiKey: (entry: ApiKeyEntry) => void;
  getApiKey: (provider: ApiProvider) => string;
  activeProvider: ApiProvider;
  setActiveProvider: (provider: ApiProvider) => void;

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

  // STT Provider
  sttProvider: SttProvider;
  setSttProvider: (provider: SttProvider) => void;

  // Agent Router API Key
  agentRouterKey: string;
  setAgentRouterKey: (key: string) => void;

  // Error
  error: string | null;
  setError: (error: string | null) => void;

  // Hydration flag
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      appState: 'selectModel',
      setAppState: (appState) => set({ appState }),

      // Multi-provider API keys (manual entry)
      apiKeys: [],
      setApiKeys: (apiKeys) => set({ apiKeys }),
      addApiKey: (entry) =>
        set((state) => {
          const existing = state.apiKeys.filter((k) => k.provider !== entry.provider);
          return { apiKeys: [...existing, entry] };
        }),
      getApiKey: (provider) => {
        const entry = get().apiKeys.find((k) => k.provider === provider);
        return entry?.key || '';
      },
      activeProvider: 'gemini',
      setActiveProvider: (activeProvider) => set({ activeProvider }),

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

      sttProvider: 'assemblyai',
      setSttProvider: (sttProvider) => set({ sttProvider }),

      agentRouterKey: '',
      setAgentRouterKey: (agentRouterKey) => set({ agentRouterKey }),

      error: null,
      setError: (error) => set({ error }),

      _hasHydrated: false,
      setHasHydrated: (_hasHydrated) => set({ _hasHydrated }),
    }),
    {
      name: 'alisha-store',
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        activeProvider: state.activeProvider,
        selectedModel: state.selectedModel,
        selectedBackground: state.selectedBackground,
        responseLanguage: state.responseLanguage,
        permanentMemory: state.permanentMemory,
        models: state.models,
        sttProvider: state.sttProvider,
        agentRouterKey: state.agentRouterKey,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true;
          // Determine initial app state based on persisted data
          if (state.apiKeys.length > 0 && state.selectedModel) {
            state.appState = 'chat';
          } else {
            state.appState = 'selectModel';
          }
        }
      },
    }
  )
);
