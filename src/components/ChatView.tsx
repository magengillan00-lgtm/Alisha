'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Mic,
  MicOff,
  Send,
  VolumeX,
  Volume2,
  MessageSquare,
  Keyboard,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/useAppStore';
import { createSpeechRecognition, speakText, SPEECH_LANGUAGES, initVoices, warmupSpeech, cancelSpeech, initTTS, unlockAudio } from '@/lib/speech';
import { sendMessage } from '@/lib/gemini-client';
import { sendFreeKeyMessage } from '@/lib/free-keys';
import SettingsDialog from '@/components/SettingsDialog';

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
    avatarState,
    setAvatarState,
    messages,
    addMessage,
    isLoading,
    setIsLoading,
    setError,
    setAppState,
    selectedBackground,
    activeProvider,
    apiKeys,
    permanentMemory,
    selectedFreeKey,
    isUsingFreeKey,
    markKeyExhausted,
    switchToNextAvailableKey,
    setSelectedModel,
  } = useAppStore();

  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [lastUserText, setLastUserText] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keySwitchNotice, setKeySwitchNotice] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<unknown>(null);

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

  // Detect keyboard visibility using visualViewport API
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    function handleResize() {
      const keyboardUp = vv.height < window.innerHeight * 0.85;
      setKeyboardVisible(keyboardUp);
    }

    vv.addEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);

    return () => {
      vv.removeEventListener('resize', handleResize);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Auto-dismiss key switch notice
  useEffect(() => {
    if (keySwitchNotice) {
      const timer = setTimeout(() => setKeySwitchNotice(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [keySwitchNotice]);

  const MODEL_PATH = '/live2d/kei_en/kei_basic_free/runtime/kei_basic_free.model3.json';

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

  // --- Speech Recognition ---
  const startRecording = useCallback(() => {
    const lang = SPEECH_LANGUAGES[responseLanguage] || 'ar-SA';

    const recognition = createSpeechRecognition(
      lang,
      (transcript, isFinal) => {
        if (isFinal) {
          setInterimText('');
          sendUserMessage(transcript);
        } else {
          setInterimText(transcript);
        }
      },
      (error) => {
        console.error('Recognition error:', error);
        setIsRecording(false);
        setAvatarState('idle');
        if (error === 'not-allowed') {
          setError('يرجى السماح بالوصول إلى الميكروفون');
        }
      },
      () => {
        setIsRecording(false);
        setAvatarState('idle');
      }
    );

    if (!recognition) {
      setError('المتصفح لا يدعم التعرف على الصوت. استخدم الإدخال النصي بدلاً من ذلك.');
      return;
    }

    recognitionRef.current = recognition;
    unlockAudio();
    warmupSpeech();
    recognition.start();
    setIsRecording(true);
    setAvatarState('listening');
    setInterimText('');
  }, [responseLanguage, setError, setAvatarState]);

  const stopRecording = useCallback(() => {
    const recognition = recognitionRef.current as { stop: () => void; abort: () => void } | null;
    if (recognition) {
      try {
        recognition.stop();
      } catch (_e) {
        recognition.abort();
      }
    }
    setIsRecording(false);
    setAvatarState('idle');
  }, [setAvatarState]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      cancelSpeech();
      setIsSpeaking(false);
      setAvatarState('idle');
      startRecording();
    }
  }, [isRecording, stopRecording, startRecording, setAvatarState]);

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

      // Stop any current speech
      cancelSpeech();
      setIsSpeaking(false);
      setShowTextInput(false);

      try {
        const chatMessages = [
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user' as const, content: text.trim() },
        ];

        let responseText: string;

        if (isUsingFreeKey && selectedFreeKey) {
          // Use free key API
          try {
            const systemPrompt = buildSystemPrompt();
            responseText = await sendFreeKeyMessage(
              selectedFreeKey,
              selectedModel,
              chatMessages,
              systemPrompt
            );
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : '';
            
            if (errorMsg === 'RATE_LIMITED' || errorMsg === 'KEY_EXPIRED') {
              if (retryCount < 5) {
                // Mark current key as exhausted
                markKeyExhausted(selectedFreeKey.id);
                
                // Try switching to next available key
                const nextKey = switchToNextAvailableKey();
                
                if (nextKey) {
                  setKeySwitchNotice(`تم التبديل إلى مفتاح: ${nextKey.category} - ${nextKey.model}`);
                  
                  // If the model changed, update it
                  if (nextKey.model !== selectedModel) {
                    setSelectedModel(nextKey.model);
                  }
                  
                  // Retry with new key (isRetry = true to avoid duplicate user message)
                  setIsLoading(false);
                  setAvatarState('idle');
                  setTimeout(() => sendUserMessage(text, retryCount + 1, true), 500);
                  return;
                } else {
                  throw new Error('تم نفاد جميع المفاتيح المتاحة. حاول مرة أخرى لاحقاً أو أدخل مفتاحك يدوياً من الإعدادات.');
                }
              } else {
                throw new Error('تم تجاوز عدد المحاولات. حاول مرة أخرى لاحقاً.');
              }
            }
            throw err;
          }
        } else {
          // Use manual API key
          const activeKey = getActiveApiKey();
          if (!activeKey) {
            throw new Error('لم يتم العثور على مفتاح API. يرجى إضافة مفتاح من الإعدادات.');
          }
          const data = await sendMessage(
            activeProvider,
            activeKey,
            selectedModel,
            chatMessages,
            responseLanguage,
            permanentMemory
          );
          responseText = data.text;
        }

        const assistantMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: responseText,
          timestamp: Date.now(),
        };
        addMessage(assistantMsg);

        // Always speak the response (voice-only mode)
        const speechLang = SPEECH_LANGUAGES[responseLanguage] || 'ar-SA';
        setTimeout(() => {
          speakText(
            responseText,
            speechLang,
            () => {
              setIsSpeaking(false);
              setAvatarState('idle');
            },
            () => {
              setIsSpeaking(true);
              setAvatarState('speaking');
            }
          );
        }, 200);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
        setError(errorMsg);
        setAvatarState('idle');
      } finally {
        setIsLoading(false);
      }
    },
    [messages, activeProvider, getActiveApiKey, selectedModel, responseLanguage, isLoading, addMessage, setIsLoading, setError, setAvatarState, permanentMemory, isUsingFreeKey, selectedFreeKey, markKeyExhausted, switchToNextAvailableKey, setSelectedModel, buildSystemPrompt]
  );

  const handleTextSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (textInput.trim()) {
        sendUserMessage(textInput);
      }
    },
    [textInput, sendUserMessage]
  );

  const stopSpeaking = useCallback(() => {
    cancelSpeech();
    setIsSpeaking(false);
    setAvatarState('idle');
  }, [setAvatarState]);

  // When keyboard is visible, show compact layout
  if (keyboardVisible && showTextInput) {
    return (
      <div className="h-[100dvh] flex flex-col bg-gray-950">
        <div className="flex items-center justify-between px-4 py-2 bg-black/30 border-b border-white/10">
          <p className="text-xs text-gray-400 truncate">{selectedModel}</p>
          <button
            onClick={() => { setShowTextInput(false); setKeyboardVisible(false); }}
            className="text-xs text-emerald-400 px-2"
          >
            {responseLanguage === 'ar' ? 'إخفاء' : responseLanguage === 'en' ? 'Hide' : '閉じる'}
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-3">
          {avatarState === 'thinking' && (
            <div className="w-10 h-10 border-3 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
          )}
          {lastUserText && avatarState !== 'idle' && (
            <div className="bg-white/5 rounded-xl px-4 py-2 border border-white/10 max-w-xs">
              <p className="text-xs text-emerald-300 text-center">{lastUserText}</p>
            </div>
          )}
        </div>

        <div className="bg-gray-950/95 border-t border-white/10 px-3 py-2 pb-3">
          <form onSubmit={handleTextSubmit} className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                responseLanguage === 'ar'
                  ? 'اكتب رسالتك...'
                  : responseLanguage === 'en'
                  ? 'Type your message...'
                  : 'メッセージを入力...'
              }
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
              disabled={isLoading}
              autoFocus
            />
            <button
              type="submit"
              disabled={!textInput.trim() || isLoading}
              className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
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

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white" dir="ltr">{selectedModel}</h1>
            <p className="text-xs text-gray-500">
              {responseLanguage === 'ar' ? 'عربي' : responseLanguage === 'en' ? 'English' : '日本語'}
              {isUsingFreeKey && selectedFreeKey && (
                <span className="text-emerald-500"> · {selectedFreeKey.category}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={stopSpeaking}
            className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            title="إيقاف الصوت"
          >
            {isSpeaking ? (
              <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
            ) : (
              <VolumeX className="w-4 h-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            title="الإعدادات"
          >
            <img
              src="/settings-icon.png"
              alt="Settings"
              className="w-6 h-6 rounded object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </button>
        </div>
      </header>

      {/* Key switch notice */}
      {keySwitchNotice && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="relative z-20 bg-amber-500/20 border-b border-amber-500/30 px-4 py-2"
        >
          <p className="text-xs text-amber-300 text-center">{keySwitchNotice}</p>
        </motion.div>
      )}

      {/* Main content - Full screen avatar */}
      <div className="flex-1 relative z-10 overflow-hidden min-h-0">
        {/* Avatar - Center stage */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="relative w-full max-w-[500px] max-h-full aspect-[3/4]">
            <Live2DViewer avatarState={avatarState} modelPath={MODEL_PATH} />
          </div>
        </div>

        {/* Status overlay */}
        <div className="absolute top-6 left-0 right-0 flex justify-center pointer-events-none">
          {lastUserText && avatarState !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-black/40 backdrop-blur-sm rounded-2xl px-5 py-2.5 border border-white/10 max-w-sm"
            >
              <p className="text-sm text-emerald-300 text-center truncate">{lastUserText}</p>
            </motion.div>
          )}
        </div>

        {/* Interim text overlay */}
        {interimText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-16 left-0 right-0 flex justify-center pointer-events-none"
          >
            <div className="bg-emerald-500/20 backdrop-blur-sm rounded-2xl px-5 py-2.5 border border-emerald-500/30 max-w-sm">
              <p className="text-sm text-emerald-200 text-center">{interimText}</p>
            </div>
          </motion.div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-950/90 via-gray-950/50 to-transparent">
          {showTextInput && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <form onSubmit={handleTextSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={
                    responseLanguage === 'ar'
                      ? 'اكتب رسالتك...'
                      : responseLanguage === 'en'
                      ? 'Type your message...'
                      : 'メッセージを入力...'
                  }
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
                  disabled={isLoading}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isLoading}
                  className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-4 h-4 text-emerald-400" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowTextInput(false)}
                  className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
                >
                  <Mic className="w-4 h-4 text-gray-400" />
                </button>
              </form>
            </motion.div>
          )}

          {!showTextInput && (
            <div className="flex items-center justify-center gap-6">
              {isSpeaking && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={stopSpeaking}
                  className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center hover:bg-rose-500/30 transition-all"
                  title="إيقاف"
                >
                  <span className="w-5 h-5 bg-rose-400 rounded-sm" />
                </motion.button>
              )}

              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                  isRecording
                    ? 'bg-gradient-to-br from-rose-500 to-red-600 border-2 border-rose-300 shadow-rose-500/50 scale-110'
                    : avatarState === 'thinking'
                    ? 'bg-amber-500/20 border-2 border-amber-500/50 shadow-amber-500/20 cursor-wait'
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600 border-2 border-emerald-300/50 shadow-emerald-500/40 hover:scale-105'
                }`}
              >
                {isLoading ? (
                  <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isRecording ? (
                  <MicOff className="w-8 h-8 text-white" />
                ) : (
                  <Mic className="w-8 h-8 text-white" />
                )}
              </motion.button>

              {!isLoading && avatarState === 'idle' && !isSpeaking && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={() => setShowTextInput(true)}
                  className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
                  title="إدخال نصي"
                >
                  <Keyboard className="w-5 h-5 text-gray-400" />
                </motion.button>
              )}
            </div>
          )}
        </div>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
