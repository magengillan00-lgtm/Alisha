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

interface AppStore {
  // App flow
  appState: AppState;
  setAppState: (state: AppState) => void;

  // API Key
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

  // Loading
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Error
  error: string | null;
  setError: (error: string | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  appState: 'setup',
  setAppState: (appState) => set({ appState }),

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

  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  error: null,
  setError: (error) => set({ error }),
}));
