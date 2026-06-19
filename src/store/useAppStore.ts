import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  fetchUserSettings,
  upsertUserSettings,
  fetchMemory,
  addMemoryItem,
  updateMemoryItem,
  deleteMemoryItem,
  replaceAllMemory,
  fetchMessages,
  addMessage as sbAddMessage,
  clearMessages as sbClearMessages,
} from '@/lib/supabase';
import { listModels } from '@/lib/gemini-client';

export type AppState = 'enterKey' | 'selectModel' | 'chat';
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
  // ✅ DB id (number) لعمليات Supabase
  dbId?: number;
}

// Supported API providers
export type ApiProvider = 'gemini' | 'huggingface' | 'nvidia' | 'groq' | 'together' | 'openrouter' | 'cohere' | 'mistral' | 'abliteration' | 'agentrouter';

// Supported STT providers
export type SttProvider = 'assemblyai' | 'webspeech';

export interface ApiKeyEntry {
  provider: ApiProvider;
  key: string;
}

// ✅ الذاكرة الافتراضية - تُستخدم فقط قبل تسجيل الدخول
// بعد الدخول تُحمّل من Supabase
export const DEFAULT_PERMANENT_MEMORY: MemoryItem[] = [
  {
    id: 'mem-default-1',
    content: 'AR: اسم المستخدم | EN/JP: User name',
    order: 1,
  },
  {
    id: 'mem-default-2',
    content: 'أنت أفاتار ذكي اسمك اليشيا (Alisha). أنت لست مجرد مساعد، أنت اليشيا - شخصية فريدة بذاتها.',
    order: 2,
  },
];

// ✅ مفاتيح API الافتراضية - تُحمّل من متغيرات البيئة (NEXT_PUBLIC_*)
// Next.js يستبدل process.env.NEXT_PUBLIC_* بقيمتها الحرفية وقت البناء
// لذا نستخدمها مباشرة (ليس عبر متغير وسيط)
function loadDefaultKeys(): ApiKeyEntry[] {
  const keys: ApiKeyEntry[] = []
  // ✅ Next.js يُعرّف process.env.NEXT_PUBLIC_* كقيم حرفية في الـ bundle
  // حتى لو لم يكن process معرفاً في المتصفح
  try {
    const OR = process.env.NEXT_PUBLIC_OPENROUTER_KEY
    const NV = process.env.NEXT_PUBLIC_NVIDIA_KEY
    const AB = process.env.NEXT_PUBLIC_ABLITERATION_KEY
    const HF = process.env.NEXT_PUBLIC_HUGGINGFACE_KEY
    const GM = process.env.NEXT_PUBLIC_GEMINI_KEY
    if (OR) keys.push({ provider: 'openrouter', key: OR })
    if (NV) keys.push({ provider: 'nvidia', key: NV })
    if (AB) keys.push({ provider: 'abliteration', key: AB })
    if (HF) keys.push({ provider: 'huggingface', key: HF })
    if (GM) keys.push({ provider: 'gemini', key: GM })
  } catch {
    // process غير معرف - تجاهل
  }
  return keys
}

export const DEFAULT_API_KEYS: ApiKeyEntry[] = loadDefaultKeys()

interface AppStore {
  // App flow
  appState: AppState;
  setAppState: (state: AppState) => void;

  // API Keys - remain in localStorage (user's secrets)
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

  // Chat (in-memory only, synced to Supabase)
  messages: Message[];
  addMessage: (msg: Message) => void;
  clearMessages: () => Promise<void>;

  // Avatar state
  avatarState: AvatarState;
  setAvatarState: (state: AvatarState) => void;

  // Settings (synced to Supabase)
  responseLanguage: ResponseLanguage;
  setResponseLanguage: (lang: ResponseLanguage) => void;
  selectedBackground: string;
  setSelectedBackground: (bg: string) => void;
  autoChangeBackground: boolean;
  setAutoChangeBackground: (auto: boolean) => void;
  backgroundChangeInterval: number;
  setBackgroundChangeInterval: (minutes: number) => void;
  lastBackgroundChange: number;
  setLastBackgroundChange: (ts: number) => void;

  // Permanent Memory (synced to Supabase)
  permanentMemory: MemoryItem[];
  setPermanentMemory: (items: MemoryItem[]) => void;
  addPermanentMemory: (content: string) => Promise<void>;
  removePermanentMemory: (id: string) => Promise<void>;
  updatePermanentMemory: (id: string, content: string) => Promise<void>;
  saveAllMemory: (items: MemoryItem[]) => Promise<void>;

  // Sync from Supabase
  syncFromSupabase: () => Promise<void>;
  saveSettingsToSupabase: () => Promise<void>;

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
      appState: 'enterKey',
      setAppState: (appState) => set({ appState }),

      // ✅ API keys - تبدأ بالمفاتيح الافتراضية المُدمجة
      apiKeys: DEFAULT_API_KEYS,
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
      // ✅ OpenRouter ك مزود افتراضي (يعمل من السودان، 340 موديل)
      activeProvider: 'openrouter',
      setActiveProvider: (activeProvider) => {
        set({ activeProvider })
        get().saveSettingsToSupabase()
      },

      models: [],
      setModels: (models) => set({ models }),
      selectedModel: '',
      setSelectedModel: (selectedModel) => {
        set({ selectedModel })
        get().saveSettingsToSupabase()
      },

      messages: [],
      addMessage: (message) => {
        set((state) => ({ messages: [...state.messages, message] }))
        // ✅ مزامنة مع Supabase (في الخلفية)
        sbAddMessage(message.role, message.content).catch((e) =>
          console.error('Failed to sync message:', e)
        )
      },
      clearMessages: async () => {
        set({ messages: [] })
        await sbClearMessages()
      },

      avatarState: 'idle',
      setAvatarState: (avatarState) => set({ avatarState }),

      responseLanguage: 'ar',
      setResponseLanguage: (responseLanguage) => {
        set({ responseLanguage })
        get().saveSettingsToSupabase()
      },

      selectedBackground: '',
      setSelectedBackground: (selectedBackground) => {
        set({ selectedBackground })
        get().saveSettingsToSupabase()
      },
      autoChangeBackground: false,
      setAutoChangeBackground: (autoChangeBackground) => {
        set({ autoChangeBackground })
        get().saveSettingsToSupabase()
      },
      backgroundChangeInterval: 30,
      setBackgroundChangeInterval: (backgroundChangeInterval) => {
        set({ backgroundChangeInterval })
        get().saveSettingsToSupabase()
      },
      lastBackgroundChange: 0,
      setLastBackgroundChange: (lastBackgroundChange) => set({ lastBackgroundChange }),

      permanentMemory: DEFAULT_PERMANENT_MEMORY,
      setPermanentMemory: (permanentMemory) => set({ permanentMemory }),
      addPermanentMemory: async (content) => {
        const state = get()
        const maxOrder = state.permanentMemory.reduce((max, m) => Math.max(max, m.order), 0)
        const newItem: MemoryItem = {
          id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          content,
          order: maxOrder + 1,
        }
        set({ permanentMemory: [...state.permanentMemory, newItem] })

        // ✅ مزامنة مع Supabase
        try {
          const dbItem = await addMemoryItem(content, newItem.order)
          if (dbItem) {
            set((s) => ({
              permanentMemory: s.permanentMemory.map((m) =>
                m.id === newItem.id ? { ...m, dbId: dbItem.id } : m
              )
            }))
          }
        } catch (e) {
          console.error('Failed to add memory to Supabase:', e)
        }
      },
      removePermanentMemory: async (id) => {
        const state = get()
        const item = state.permanentMemory.find((m) => m.id === id)
        set({
          permanentMemory: state.permanentMemory
            .filter((m) => m.id !== id)
            .map((m, i) => ({ ...m, order: i + 1 })),
        })

        // ✅ حذف من Supabase
        if (item?.dbId) {
          try {
            await deleteMemoryItem(item.dbId)
          } catch (e) {
            console.error('Failed to delete memory from Supabase:', e)
          }
        }
      },
      updatePermanentMemory: async (id, content) => {
        const state = get()
        set({
          permanentMemory: state.permanentMemory.map((m) =>
            m.id === id ? { ...m, content } : m
          ),
        })

        // ✅ تحديث في Supabase
        const item = state.permanentMemory.find((m) => m.id === id)
        if (item?.dbId) {
          try {
            await updateMemoryItem(item.dbId, content)
          } catch (e) {
            console.error('Failed to update memory in Supabase:', e)
          }
        }
      },
      saveAllMemory: async (items) => {
        set({ permanentMemory: items })
        try {
          await replaceAllMemory(
            items.map((i) => ({ content: i.content, sort_order: i.order }))
          )
        } catch (e) {
          console.error('Failed to save memory to Supabase:', e)
        }
      },

      // ✅ تحميل البيانات من Supabase
      syncFromSupabase: async () => {
        try {
          const [settings, memory, messages] = await Promise.all([
            fetchUserSettings(),
            fetchMemory(),
            fetchMessages(),
          ])

          if (settings) {
            set({
              responseLanguage: settings.response_language,
              selectedBackground: settings.selected_background,
              autoChangeBackground: settings.auto_change_bg,
              backgroundChangeInterval: settings.bg_interval_minutes,
              sttProvider: settings.stt_provider,
              activeProvider: settings.active_provider as ApiProvider,
              selectedModel: settings.selected_model,
            })
          }

          if (memory.length > 0) {
            set({
              permanentMemory: memory.map((m) => ({
                id: `mem-${m.id}`,
                dbId: m.id,
                content: m.content,
                order: m.sort_order,
              })),
            })
          }

          if (messages.length > 0) {
            set({
              messages: messages.map((m) => ({
                id: `msg-${m.id}`,
                role: m.role,
                content: m.content,
                timestamp: new Date(m.created_at).getTime(),
              })),
            })
          }

          // ✅ تحديد appState بناءً على البيانات:
          // - المفاتيح الافتراضية موجودة دائماً، لذا نتجاوز enterKey
          // - إذا وُجد موديل محفوظ → chat
          // - إذا لم يوجد موديل → selectModel
          const state = get()
          if (state.apiKeys.length > 0 && state.selectedModel) {
            set({ appState: 'chat' })
          } else if (state.apiKeys.length > 0) {
            // ✅ حمّل موديلات المزود النشط تلقائياً
            const activeProvider = state.activeProvider
            const apiKey = state.apiKeys.find((k) => k.provider === activeProvider)?.key
            if (apiKey) {
              try {
                const data = await listModels(activeProvider, apiKey)
                // ✅ اختيار موديل افتراضي يعمل من السودان
                // mistralai/mistral-large يعمل ويعطي content (ليس reasoning model)
                const defaultModel = data.models.find(m => m === 'mistralai/mistral-large')
                  || data.models.find(m => m.includes('mistral-large'))
                  || data.models[0]
                set({
                  models: data.models,
                  selectedModel: defaultModel || '',
                  appState: 'selectModel'
                })
              } catch (e) {
                console.error('Failed to load models:', e)
                set({ appState: 'selectModel' })
              }
            } else {
              set({ appState: 'selectModel' })
            }
          } else {
            set({ appState: 'enterKey' })
          }
        } catch (e) {
          console.error('Failed to sync from Supabase:', e)
        }
      },

      saveSettingsToSupabase: async () => {
        const state = get()
        try {
          await upsertUserSettings({
            response_language: state.responseLanguage,
            selected_background: state.selectedBackground,
            auto_change_bg: state.autoChangeBackground,
            bg_interval_minutes: state.backgroundChangeInterval,
            stt_provider: state.sttProvider,
            active_provider: state.activeProvider,
            selected_model: state.selectedModel,
          })
        } catch (e) {
          console.error('Failed to save settings to Supabase:', e)
        }
      },

      isLoading: false,
      setIsLoading: (isLoading) => set({ isLoading }),

      sttProvider: 'webspeech',
      setSttProvider: (sttProvider) => {
        set({ sttProvider })
        get().saveSettingsToSupabase()
      },

      agentRouterKey: '',
      setAgentRouterKey: (agentRouterKey) => set({ agentRouterKey }),

      error: null,
      setError: (error) => set({ error }),

      _hasHydrated: false,
      setHasHydrated: (_hasHydrated) => set({ _hasHydrated }),
    }),
    {
      name: 'alisha-store',
      version: 2, // ✅ زيادة النسخة لإجبار migration (يحل مشكلة المفاتيح القديمة)
      // ✅ نخزّن فقط المفاتيح والبيانات المحلية، الإعدادات والذاكرة في Supabase
      partialize: (state) => ({
        apiKeys: state.apiKeys,
        agentRouterKey: state.agentRouterKey,
        models: state.models,
      }),
      // ✅ migration: استبدال المفاتيح القديمة بالمفاتيح الصحيحة الجديدة
      migrate: (persistedState: unknown, version: number) => {
        const state = (persistedState as Record<string, unknown>) || {}
        // إذا كانت النسخة < 2، استبدل المفاتيح بالمفاتيح الافتراضية
        if (version < 2) {
          // إزالة المفاتيح القديمة تماماً - ستُستبدل بالـ DEFAULT_API_KEYS
          state.apiKeys = DEFAULT_API_KEYS
        }
        return state
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state._hasHydrated = true
          // ✅ بعد rehydration، تأكد من وجود المفاتيح الافتراضية
          // إذا لم توجد مفاتيح، استخدم DEFAULT_API_KEYS
          if (!state.apiKeys || state.apiKeys.length === 0) {
            state.apiKeys = DEFAULT_API_KEYS
          }
          // ✅ تأكد من وجود مفتاح OpenRouter (المزود الافتراضي)
          const hasOpenRouter = state.apiKeys?.some(
            (k: ApiKeyEntry) => k.provider === 'openrouter' && k.key.startsWith('sk-or-v1-')
          )
          if (!hasOpenRouter) {
            // استبدل كلياً بالمفاتيح الافتراضية
            state.apiKeys = DEFAULT_API_KEYS
          }
        }
      },
    }
  )
);
