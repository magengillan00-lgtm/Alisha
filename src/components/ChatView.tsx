'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  MessageSquare,
  AlertTriangle,
  X,
  Mic,
  MicOff,
  Square,
  Type,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/useAppStore';
import { createSpeechRecognition, speakText, SPEECH_LANGUAGES, initVoices, warmupSpeech, cancelSpeech, initTTS, unlockAudio, requestMicrophonePermission, isSpeaking as checkIsSpeaking } from '@/lib/speech';
import { AssemblyAISTREAMING_STT } from '@/lib/assemblyai/stt';
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
    error,
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
    sttProvider,
    setSttProvider,
  } = useAppStore();

  const [textInput, setTextInput] = useState('');
  const [interimText, setInterimText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastUserText, setLastUserText] = useState('');
  const [keySwitchNotice, setKeySwitchNotice] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [accumulatedText, setAccumulatedText] = useState('');
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const assemblyaiRef = useRef<AssemblyAISTREAMING_STT | null>(null);
  const [assemblyaiStatus, setAssemblyaiStatus] = useState<string>('disconnected');

  const recognitionRef = useRef<unknown>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const isRecordingRef = useRef(false);
  const isSpeakingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  // Initialize TTS and voices on mount, and request mic permission
  useEffect(() => {
    initVoices();
    initTTS();

    // Request microphone permission on mount - retry up to 3 times
    const requestMicPerm = async (attempt = 0) => {
      const granted = await requestMicrophonePermission();
      setMicPermissionGranted(granted);
      if (!granted && attempt < 3) {
        // Retry after a short delay
        setTimeout(() => requestMicPerm(attempt + 1), 2000);
      }
    };
    requestMicPerm();

    // Unlock audio on first user interaction
    const handleFirstInteraction = () => {
      unlockAudio();
      warmupSpeech();
      // Re-init TTS after first interaction (audio may now be unlocked)
      initTTS();
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

  // Initialize AssemblyAI STT when provider changes
  useEffect(() => {
    if (sttProvider === 'assemblyai') {
      const stt = new AssemblyAISTREAMING_STT({
        apiKey: 'd89c20e81ef94c04b1f633317c88c7c5',
      });
      stt.setCallbacks(
        (result) => {
          if (result.isFinal) {
            setAccumulatedText(prev => {
              const newText = prev ? prev + ' ' + result.text : result.text;
              return newText;
            });
            setInterimText('');
          } else {
            setInterimText(result.text);
          }
        },
        (error) => {
          console.error('AssemblyAI error:', error.message);
          setIsRecording(false);
          setAvatarState('idle');
          setError('خطأ في AssemblyAI: ' + error.message);
        },
        (status) => {
          setAssemblyaiStatus(status);
          if (status === 'listening') setAvatarState('listening');
          else if (status === 'processing') setAvatarState('listening');
          else if (status === 'disconnected' || status === 'error') {
            if (!isRecordingRef.current) setAvatarState('idle');
          }
        }
      );
      assemblyaiRef.current = stt;
    }
    return () => {
      assemblyaiRef.current?.stop();
    };
  }, [sttProvider]);

  // Auto-dismiss key switch notice
  useEffect(() => {
    if (keySwitchNotice) {
      const timer = setTimeout(() => setKeySwitchNotice(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [keySwitchNotice]);

  // Auto-dismiss error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [error, setError]);

  // Focus text input when shown
  useEffect(() => {
    if (showTextInput && textInputRef.current) {
      setTimeout(() => textInputRef.current?.focus(), 100);
    }
  }, [showTextInput]);

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

  // --- Voice Recording (Main Screen) ---
  const startRecording = useCallback(() => {
    // AssemblyAI mode
    if (sttProvider === 'assemblyai' && assemblyaiRef.current) {
      cancelSpeech();
      setIsSpeaking(false);
      setAvatarState('idle');
      setInterimText('');
      setAccumulatedText('');
      setIsRecording(true);
      setAvatarState('listening');
      assemblyaiRef.current.start().catch((error: any) => {
        setIsRecording(false);
        setAvatarState('idle');
        setError('فشل في بدء AssemblyAI: ' + error.message);
      });
      return;
    }

    // Web Speech API mode
    const lang = SPEECH_LANGUAGES[responseLanguage] || 'ar-SA';

    const recognition = createSpeechRecognition(
      lang,
      (transcript, isFinal) => {
        if (isFinal) {
          // Accumulate final text
          setAccumulatedText(prev => {
            const newText = prev ? prev + ' ' + transcript : transcript;
            return newText;
          });
          setInterimText('');
        } else {
          setInterimText(transcript);
        }
      },
      (err) => {
        console.error('Recognition error:', err);
        setIsRecording(false);
        setAvatarState('idle');
        if (err === 'not-allowed') {
          setError('يرجى السماح بالوصول إلى الميكروفون');
          // Try requesting permission again
          requestMicrophonePermission().then(granted => {
            setMicPermissionGranted(granted);
          });
        }
      },
      () => {
        // Recognition ended - if we were recording and it stopped on its own,
        // auto-send the accumulated text
        if (isRecordingRef.current) {
          setIsRecording(false);
          setAvatarState('idle');
          // Auto-send accumulated text when recognition ends naturally
          setAccumulatedText(prev => {
            if (prev.trim()) {
              // Use setTimeout to avoid state update during render
              const text = prev.trim();
              setTimeout(() => {
                sendUserMessage(text);
              }, 100);
            }
            return '';
          });
          setInterimText('');
        }
      }
    );

    if (!recognition) {
      setError('المتصفح لا يدعم التعرف على الصوت. استخدم الإدخال النصي بدلاً من ذلك.');
      return;
    }

    recognitionRef.current = recognition;
    unlockAudio();
    warmupSpeech();

    // Cancel any ongoing speech before recording
    cancelSpeech();
    setIsSpeaking(false);
    setAvatarState('idle');

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setError('فشل في بدء التعرف على الصوت');
      return;
    }

    setIsRecording(true);
    setAvatarState('listening');
    setInterimText('');
    setAccumulatedText('');
  }, [responseLanguage, setError, setAvatarState, sttProvider]);

  const stopRecording = useCallback(() => {
    // AssemblyAI mode
    if (sttProvider === 'assemblyai' && assemblyaiRef.current) {
      assemblyaiRef.current.stop();
      setIsRecording(false);
      setAvatarState('idle');
      setAccumulatedText(prev => {
        if (prev.trim()) {
          const text = prev.trim();
          setTimeout(() => sendUserMessage(text), 100);
        }
        return '';
      });
      setInterimText('');
      return;
    }

    // Web Speech API mode
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

    // Send the accumulated text
    setAccumulatedText(prev => {
      if (prev.trim()) {
        const text = prev.trim();
        setTimeout(() => {
          sendUserMessage(text);
        }, 100);
      }
      return '';
    });
    setInterimText('');
  }, [setAvatarState, sttProvider]);

  const handleMicPress = useCallback(() => {
    if (isRecording) {
      // Stop recording and send
      stopRecording();
    } else if (isSpeaking) {
      // Interrupt Alisha and start recording
      cancelSpeech();
      setIsSpeaking(false);
      setAvatarState('idle');
      // Small delay then start recording
      setTimeout(() => {
        startRecording();
      }, 200);
    } else {
      // Start recording
      startRecording();
    }
  }, [isRecording, isSpeaking, stopRecording, startRecording]);

  // --- Send Message to AI ---
  const sendUserMessage = useCallback(
    async (text: string, retryCount = 0, isRetry = false) => {
      if (!text.trim() || isLoading) return;

      // Only add user message if this is not a retry
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
        const chatMessages = [
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user' as const, content: text.trim() },
        ];

        let responseText: string;

        if (isUsingFreeKey && selectedFreeKey) {
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
                markKeyExhausted(selectedFreeKey.id);
                const nextKey = switchToNextAvailableKey();

                if (nextKey) {
                  setKeySwitchNotice(`تم التبديل إلى مفتاح: ${nextKey.category} - ${nextKey.model}`);
                  if (nextKey.model !== selectedModel) {
                    setSelectedModel(nextKey.model);
                  }
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
          const activeKey = getActiveApiKey();
          if (!activeKey) {
            throw new Error('لم يتم العثور على مفتاح API. يرجى إضافة مفتاح من الإعدادات.');
          }
          try {
            const data = await sendMessage(
              activeProvider,
              activeKey,
              selectedModel,
              chatMessages,
              responseLanguage,
              permanentMemory
            );
            responseText = data.text;
          } catch (apiErr) {
            const apiErrorMsg = apiErr instanceof Error ? apiErr.message : '';
            // Handle geo-restriction errors
            if (apiErrorMsg === 'GEO_BLOCKED') {
              throw new Error('موقعك الجغرافي غير مدعوم من هذا المزود. جرب: 1) المفاتيح المجانية، 2) مزود Groq أو OpenRouter، 3) استخدام VPN.');
            }
            if (apiErrorMsg === 'RATE_LIMITED') {
              throw new Error('تم تجاوز حد الطلبات. انتظر قليلاً ثم حاول مجدداً.');
            }
            if (apiErrorMsg === 'KEY_INVALID') {
              throw new Error('مفتاح API غير صالح أو منتهي الصلاحية. تحقق من المفتاح في الإعدادات.');
            }
            throw apiErr;
          }
        }

        const assistantMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: responseText,
          timestamp: Date.now(),
        };
        addMessage(assistantMsg);

        // Always speak the response - voice is always on, no way to disable
        const speechLang = SPEECH_LANGUAGES[responseLanguage] || 'ar-SA';
        setTimeout(() => {
          speakText(
            responseText,
            speechLang,
            () => {
              setIsSpeaking(false);
              if (!isRecordingRef.current) {
                setAvatarState('idle');
              }
            },
            () => {
              setIsSpeaking(true);
              setAvatarState('speaking');
            }
          );
        }, 300);
      } catch (err) {
        let errorMsg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
        // Handle geo-restriction errors from free keys
        if (errorMsg === 'GEO_BLOCKED') {
          errorMsg = 'موقعك الجغرافي غير مدعوم. جرب استخدام المفاتيح المجانية أو مزود آخر.';
        }
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
        setShowTextInput(false);
      }
    },
    [textInput, sendUserMessage]
  );

  // Get the full display text (accumulated + interim)
  const fullDisplayText = accumulatedText
    ? interimText
      ? accumulatedText + ' ' + interimText
      : accumulatedText
    : interimText;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)' }}>
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

      {/* Top bar - compact */}
      <header className="relative z-10 flex items-center justify-between px-3 py-2 bg-black/30 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <MessageSquare className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-semibold text-white truncate max-w-[160px]" dir="ltr">{selectedModel}</h1>
            <p className="text-[10px] text-gray-500">
              {responseLanguage === 'ar' ? 'عربي' : responseLanguage === 'en' ? 'English' : '日本語'}
              {isUsingFreeKey && selectedFreeKey && (
                <span className="text-emerald-500"> · {selectedFreeKey.category}</span>
              )}
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

        {/* Status overlay - last user text */}
        <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none">
          {lastUserText && !isRecording && avatarState !== 'idle' && (
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

        {/* Speech recognition overlay (while recording) */}
        {isRecording && fullDisplayText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-14 left-0 right-0 flex justify-center pointer-events-none px-4"
          >
            <div className="bg-emerald-500/20 backdrop-blur-sm rounded-2xl px-4 py-2 border border-emerald-500/30 max-w-sm">
              <p className="text-sm text-emerald-200 text-center" dir="auto">{fullDisplayText}</p>
            </div>
          </motion.div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/20 backdrop-blur-sm rounded-full px-3 py-1.5 border border-red-500/30"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] text-red-300">
              {responseLanguage === 'ar' ? 'جاري التسجيل...' : responseLanguage === 'en' ? 'Recording...' : '録音中...'}
            </span>
          </motion.div>
        )}
      </div>

      {/* Bottom input area - Mic button (primary) + Text toggle + Send */}
      <div
        className="relative z-10 bg-gray-950/95 backdrop-blur-sm border-t border-white/10 px-3 py-2 flex-shrink-0"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex gap-2 items-center justify-center">
          {/* Text input toggle button */}
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
              showTextInput
                ? 'bg-white/10 border border-white/20'
                : 'bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
            title={responseLanguage === 'ar' ? 'إدخال نصي' : 'Text input'}
          >
            <Type className={`w-4 h-4 ${showTextInput ? 'text-emerald-400' : 'text-gray-400'}`} />
          </button>

          {/* Main mic button - primary input method */}
          <button
            onClick={handleMicPress}
            disabled={isLoading && !isSpeaking}
            className={`relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all flex-shrink-0 ${
              isRecording
                ? 'bg-red-500/30 border-2 border-red-500/60 shadow-lg shadow-red-500/20'
                : isSpeaking
                ? 'bg-emerald-500/30 border-2 border-emerald-500/60 shadow-lg shadow-emerald-500/20 animate-pulse'
                : 'bg-emerald-500/20 border-2 border-emerald-500/40 hover:bg-emerald-500/30 shadow-lg shadow-emerald-500/10'
            }`}
            title={
              isRecording
                ? (responseLanguage === 'ar' ? 'أوقف التسجيل' : 'Stop recording')
                : isSpeaking
                ? (responseLanguage === 'ar' ? 'مقاطعة والبدء بالكلام' : 'Interrupt & speak')
                : (responseLanguage === 'ar' ? 'ابدأ الكلام' : 'Start speaking')
            }
          >
            {isRecording ? (
              <Square className="w-6 h-6 text-red-400 fill-red-400" />
            ) : isSpeaking ? (
              <div className="relative">
                <Mic className="w-6 h-6 text-emerald-400" />
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              </div>
            ) : (
              <Mic className="w-6 h-6 text-emerald-400" />
            )}
          </button>

          {/* Quick text input (when toggled) */}
          <button
            onClick={() => {
              if (textInput.trim()) {
                sendUserMessage(textInput);
                setTextInput('');
              } else {
                setShowTextInput(!showTextInput);
              }
            }}
            disabled={isLoading && !showTextInput}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
              textInput.trim()
                ? 'bg-emerald-500/20 border border-emerald-500/30'
                : 'bg-white/5 border border-white/10 hover:bg-white/10'
            }`}
            title={responseLanguage === 'ar' ? 'إرسال' : 'Send'}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className={`w-4 h-4 ${textInput.trim() ? 'text-emerald-400' : 'text-gray-400'}`} />
            )}
          </button>
        </div>

        {/* Text input row (expandable) */}
        <AnimatePresence>
          {showTextInput && (
            <motion.form
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleTextSubmit}
              className="overflow-hidden mt-2"
            >
              <div className="flex gap-2 items-center">
                <input
                  ref={textInputRef}
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
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
                  disabled={isLoading}
                  dir="auto"
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isLoading}
                  className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
                >
                  <Send className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Hint text */}
        {!isRecording && !isSpeaking && !isLoading && (
          <p className="text-[10px] text-gray-600 text-center mt-1">
            {responseLanguage === 'ar'
              ? 'اضغط على المايكروفون للتكلم • اضغط مجدداً للإيقاف'
              : responseLanguage === 'en'
              ? 'Tap mic to speak • Tap again to stop'
              : 'マイクをタップして話す • もう一度タップして停止'}
          </p>
        )}
        {isSpeaking && !isRecording && (
          <p className="text-[10px] text-emerald-600 text-center mt-1">
            {responseLanguage === 'ar'
              ? 'اضغط على المايكروفون لمقاطعة أليشيا'
              : responseLanguage === 'en'
              ? 'Tap mic to interrupt Alisha'
              : 'マイクをタップしてアリシャを中断'}
          </p>
        )}
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onMicPress={handleMicPress}
        isRecording={isRecording}
        avatarState={avatarState}
      />
    </div>
  );
}
