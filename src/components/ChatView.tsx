'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  MessageSquare,
  AlertTriangle,
  X,
  Mic,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/useAppStore';
import { speakText, SPEECH_LANGUAGES, initVoices, warmupSpeech, cancelSpeech, initTTS, unlockAudio, getVoiceRate } from '@/lib/speech';
import { createSTTSession, type STTSession } from '@/lib/stt-providers';
import { sendMessage } from '@/lib/gemini-client';
import { getAvatarModelPath } from '@/components/AvatarSelector';
import SettingsDialog from '@/components/SettingsDialog';

// Background IDs for auto-rotation
const BG_IDS = [
  'bg1-anime-night','bg2-sakura-garden','bg3-ocean-dream','bg4-galaxy-stars','bg5-magic-forest',
  'bg6-sunset-city','bg7-snow-mountain','bg8-lavender-field','bg9-temple-sakura','bg10-rain-window',
  'bg11-shrine-golden','bg12-floating-island','bg13-cozy-room','bg14-aurora-lake','bg15-autumn-castle',
  'bg16-underwater-palace','bg17-bamboo-forest','bg18-steampunk-city','bg19-cloud-paradise','bg20-magic-library',
  'bg21-cherry-blossom-night','bg22-ice-palace','bg23-firework-festival','bg24-zen-garden','bg25-starlight-beach',
  'bg26-ancient-temple','bg27-flower-field','bg28-cloud-city','bg29-moonlight-forest','bg30-sakura-river',
];

const Live2DViewer = dynamic(() => import('@/components/Live2DViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function ChatView() {
  const {
    selectedModel,
    responseLanguage,
    selectedVoiceId,
    selectedAvatar,
    avatarState,
    setAvatarState,
    messages,
    addMessage,
    isLoading,
    setIsLoading,
    error,
    setError,
    setAppState,
    selectedBackground,
    activeProvider,
    apiKeys,
    permanentMemory,
    setSelectedModel,
    sttProvider,
  } = useAppStore();

  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastUserText, setLastUserText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const sttSessionRef = useRef<STTSession | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Auto-rotation background logic (fixes: timer stops when app is in background)
  const autoChangeBackground = useAppStore((s) => s.autoChangeBackground);
  const backgroundChangeInterval = useAppStore((s) => s.backgroundChangeInterval);
  const lastBackgroundChange = useAppStore((s) => s.lastBackgroundChange);
  const setSelectedBackground = useAppStore((s) => s.setSelectedBackground);
  const setLastBackgroundChange = useAppStore((s) => s.setLastBackgroundChange);

  useEffect(() => {
    if (!autoChangeBackground) return;

    const checkAndRotate = () => {
      const now = Date.now();
      const intervalMs = backgroundChangeInterval * 60 * 1000;
      const lastChange = lastBackgroundChange || now;

      if (now - lastChange >= intervalMs) {
        // Time to change background
        const currentBg = useAppStore.getState().selectedBackground;
        const currentIndex = BG_IDS.indexOf(currentBg);
        const nextIndex = (currentIndex + 1) % BG_IDS.length;
        setSelectedBackground(BG_IDS[nextIndex]);
        setLastBackgroundChange(now);
      }
    };

    // Check immediately on mount / visibility change
    checkAndRotate();

    // Use setInterval but also rely on visibilitychange for background tab fix
    const timer = setInterval(checkAndRotate, 30000); // check every 30 seconds

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible - immediately check if rotation is due
        checkAndRotate();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoChangeBackground, backgroundChangeInterval, lastBackgroundChange, setSelectedBackground, setLastBackgroundChange]);

  // Initialize TTS and voices on mount
  useEffect(() => {
    initVoices();
    initTTS();

    const handleFirstInteraction = () => {
      unlockAudio();
      warmupSpeech();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Auto-dismiss error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  // ✅ مسار النموذج يعتمد على الأفاتار المختار
  const MODEL_PATH = getAvatarModelPath(selectedAvatar);

  // Get the active API key
  const getActiveApiKey = useCallback(() => {
    const keyEntry = apiKeys.find((k) => k.provider === activeProvider);
    return keyEntry?.key || '';
  }, [apiKeys, activeProvider]);

  // Build system prompt
  const buildSystemPrompt = useCallback(() => {
    const LANG_INSTRUCTIONS: Record<string, string> = {
      ar: `أنت مساعد صوتي ذكي مع أفاتار Live2D.
- أجب دائماً باللغة العربية فقط، بغض النظر عن لغة سؤال المستخدم.
- كن ودوداً وطبيعياً كأنك تتحدث مع صديق.
- أجب بإيجاز ومناسب للمحادثة الصوتية (جمل قصيرة).
- لا تستخدم Markdown أو رموز خاصة في الرد.
- تجنب القوائم المرقمة والنقاط، استخدم جمل عادية.`,
      en: `You are a smart voice assistant with a Live2D avatar.
- Always respond in English only, regardless of the user's input language.
- Be friendly and natural, like talking to a friend.
- Keep responses concise and suitable for voice conversation (short sentences).
- Do not use Markdown or special symbols in your response.
- Avoid numbered lists and bullet points, use normal sentences.`,
      ja: `あなたはLive2Dアバター付きのスマート音声アシスタントです。
- ユーザーの入力言語に関係なく、常に日本語のみで応答してください。
- 友達と話すように、親しみやすく自然に答えてください。
- 音声会話に適した簡潔な回答（短い文）を心がけてください。
- Markdownや特殊記号は使わないでください。
- 番号付きリストや箇条書きは避け、普通の文を使ってください。`,
    };

    let prompt = LANG_INSTRUCTIONS[responseLanguage] || LANG_INSTRUCTIONS['ar'];

    if (permanentMemory.length > 0) {
      const memoryBlock = permanentMemory
        .sort((a, b) => a.order - b.order)
        .map((m) => `[${m.order}] ${m.content}`)
        .join('\n');
      prompt += `\n\n--- تعليمات مهمة من ملف الذاكرة الدائمة (يجب اتباعها دائماً) ---\n${memoryBlock}\n--- نهاية التعليمات ---`;
    }

    return prompt;
  }, [responseLanguage, permanentMemory]);

  // --- Speech Recognition (supports AssemblyAI + Web Speech API) ---
  const startRecording = useCallback(() => {
    const lang = responseLanguage;

    try {
      const session = createSTTSession(
        sttProvider,
        lang,
        (result) => {
          if (result.isFinal) {
            setInterimText('');
            sendUserMessage(result.text);
          } else {
            setInterimText(result.text);
          }
        },
        (error) => {
          console.error('STT error:', error);
          setIsRecording(false);
          setAvatarState('idle');
          if (error.includes('not-allowed') || error.includes('permission') || error === 'الميكروفون') {
            setError('يرجى السماح بالوصول إلى الميكروفون');
          } else {
            setError('حدث خطأ في التعرف على الصوت: ' + error);
          }
        },
        () => {
          setIsRecording(false);
          setAvatarState('idle');
        }
      );

      sttSessionRef.current = session;
      // Note: unlockAudio() is called from handleMicPress (user gesture) before this function
      session.start();
      setIsRecording(true);
      setAvatarState('listening');
      setInterimText('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل في بدء التعرف على الصوت';
      setError(msg);
    }
  }, [responseLanguage, sttProvider, setError, setAvatarState]);

  const stopRecording = useCallback(() => {
    if (sttSessionRef.current) {
      sttSessionRef.current.stop();
      sttSessionRef.current = null;
    }
    setIsRecording(false);
    setAvatarState('idle');
  }, [setAvatarState]);

  // --- Send Message to AI ---
  const sendUserMessage = useCallback(
    async (text: string, retryCount = 0, isRetry = false) => {
      if (!text.trim() || isLoading) return;

      // Only add user message if this is not a retry (fix duplicate message bug)
      if (!isRetry) {
        const userMsg = {
          id: Date.now().toString(),
          role: 'user' as const,
          content: text.trim(),
          timestamp: Date.now(),
        };
        addMessage(userMsg);
      }
      setTextInput('');
      setLastUserText(text.trim());
      setIsLoading(true);
      setAvatarState('thinking');

      // Cancel any current speech before sending new message
      cancelSpeech();
      setIsSpeaking(false);

      try {
        // Keep last 20 messages to avoid token limits
        const recentMessages = messages.slice(-20);
        const chatMessages = [
          ...recentMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user' as const, content: text.trim() },
        ];

        let responseText: string;

        // Get the active API key
        const activeKey = getActiveApiKey();
        
        if (!activeKey) {
          throw new Error('لم يتم العثور على مفتاح API. يرجى إضافة مفتاح من الإعدادات.');
        }
        
        // Call provider API directly from client (GitHub Pages = static, no server proxy)
        const result = await sendMessage(
          activeProvider,
          activeKey,
          selectedModel,
          chatMessages,
          responseLanguage,
          permanentMemory
        );
        responseText = result.text;

        const assistantMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: responseText,
          timestamp: Date.now(),
        };
        addMessage(assistantMsg);

        // Always speak the response - voice is always on, no way to disable
        const speechLang = SPEECH_LANGUAGES[responseLanguage] || 'ar-SA';
        // ✅ الحصول على rate من الصوت المختار
        const voiceRate = getVoiceRate(selectedVoiceId);

        // ✅ Safety timeout: إذا لم تنتهِ spokeText خلال (النص الطول × 150ms + 40 ثانية)، أجبر العودة لـ idle
        const safetyMaxMs = Math.max(40000, responseText.length * 150);
        const speakingSafetyTimer = setTimeout(() => {
          console.warn('ChatView: Speaking safety timeout, forcing idle');
          cancelSpeech();
          setIsSpeaking(false);
          setAvatarState('idle');
        }, safetyMaxMs);

        setTimeout(() => {
          speakText(
            responseText,
            speechLang,
            () => {
              clearTimeout(speakingSafetyTimer);
              setIsSpeaking(false);
              setAvatarState('idle');
            },
            () => {
              setIsSpeaking(true);
              setAvatarState('speaking');
            },
            voiceRate
          );
        }, 300);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
        setError(errorMsg);
        setAvatarState('idle');
      } finally {
        setIsLoading(false);
      }
    },
    [messages, activeProvider, getActiveApiKey, selectedModel, responseLanguage, selectedVoiceId, isLoading, addMessage, setIsLoading, setError, setAvatarState, permanentMemory, setSelectedModel, buildSystemPrompt]
  );

  const handleTextSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (textInput.trim()) {
        // CRITICAL: unlockAudio() synchronously in gesture callstack before async sendUserMessage
        unlockAudio();
        warmupSpeech();
        sendUserMessage(textInput);
      }
    },
    [textInput, sendUserMessage]
  );

  const handleMicPress = useCallback(() => {
    // CRITICAL: unlockAudio() must be called synchronously here (in the gesture callstack)
    // before any async operations, to unblock audio playback on Android WebView.
    unlockAudio();
    warmupSpeech();
    if (isRecording) {
      stopRecording();
    } else {
      cancelSpeech();
      setIsSpeaking(false);
      setAvatarState('idle');
      startRecording();
    }
  }, [isRecording, stopRecording, startRecording, setAvatarState]);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Background */}
      {selectedBackground ? (
        <div className="fixed inset-0 z-0">
          <img
            src={`/backgrounds/${selectedBackground}.png`}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>
      ) : (
        <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950 z-0">
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
      )}

      {/* Top bar - compact, respects safe area */}
      <header className="relative z-10 flex items-center justify-between px-3 py-2 bg-black/30 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <MessageSquare className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-semibold text-white truncate max-w-[160px]" dir="ltr">{selectedModel}</h1>
            <p className="text-[10px] text-gray-500">
              {responseLanguage === 'ar' ? 'عربي' : responseLanguage === 'en' ? 'English' : '日本語'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          title="الإعدادات"
        >
          <img
            src="/settings-icon.png"
            alt="Settings"
            className="w-5 h-5 rounded object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </button>
      </header>

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative z-20 bg-red-500/20 border-b border-red-500/30 px-4 py-2 flex items-center gap-2"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content - Full screen avatar */}
      <div className="flex-1 relative z-10 overflow-hidden min-h-0">
        {/* Avatar - Center stage - يملأ الشاشة بالكامل */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full">
            <Live2DViewer avatarState={avatarState} modelPath={MODEL_PATH} />
          </div>
        </div>

        {/* Status overlay - user text */}
        <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
          {lastUserText && avatarState !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-black/40 backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/10 max-w-xs"
            >
              <p className="text-xs text-emerald-300 text-center truncate">{lastUserText}</p>
            </motion.div>
          )}
        </div>

        {/* Interim text overlay (speech recognition) */}
        {interimText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-14 left-0 right-0 flex justify-center pointer-events-none"
          >
            <div className="bg-emerald-500/20 backdrop-blur-sm rounded-2xl px-4 py-2 border border-emerald-500/30 max-w-xs">
              <p className="text-xs text-emerald-200 text-center">{interimText}</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom input area - always visible, fixed to bottom */}
      <div
        className="relative z-30 bg-gray-950/95 backdrop-blur-sm border-t border-white/10 px-3 py-2 flex-shrink-0"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <form onSubmit={handleTextSubmit} className="flex gap-2 items-end">
          <input
            ref={textInputRef}
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onFocus={() => {
              // Prevent mobile keyboard from pushing the page up
              // Scroll the input into view after a small delay (after keyboard opens)
              setTimeout(() => {
                textInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }, 300);
            }}
            placeholder={
              responseLanguage === 'ar'
                ? 'اكتب رسالتك...'
                : responseLanguage === 'en'
                ? 'Type your message...'
                : 'メッセージを入力...'
            }
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
            disabled={isLoading}
          />

          {/* Mic button - always visible for voice input */}
          <button
            type="button"
            onClick={handleMicPress}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
              isRecording
                ? 'bg-gradient-to-br from-rose-500 to-red-600 border border-rose-300/50 shadow-lg shadow-rose-500/30 animate-pulse'
                : avatarState === 'thinking'
                ? 'bg-amber-500/20 border border-amber-500/30 cursor-wait'
                : 'bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
            disabled={isLoading}
            title={isRecording ? 'إيقاف التسجيل' : 'تسجيل صوتي'}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isRecording ? (
              <div className="w-3.5 h-3.5 bg-white rounded-sm" />
            ) : (
              <Mic className="w-4 h-4 text-gray-400" />
            )}
          </button>

          <button
            type="submit"
            disabled={!textInput.trim() || isLoading}
            className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
          >
            <Send className="w-4 h-4 text-emerald-400" />
          </button>
        </form>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
