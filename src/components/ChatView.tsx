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
import { createSpeechRecognition, speakText, SPEECH_LANGUAGES, initVoices } from '@/lib/speech';
import { sendMessage } from '@/lib/gemini-client';
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
    apiKey,
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
  } = useAppStore();

  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [muted, setMuted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [lastUserText, setLastUserText] = useState('');

  const recognitionRef = useRef<unknown>(null);

  // Initialize voices on mount
  useEffect(() => {
    initVoices();
  }, []);

  const MODEL_PATH = '/live2d/kei_en/kei_basic_free/runtime/kei_basic_free.model3.json';

  // Get the active API key
  const getActiveApiKey = useCallback(() => {
    const keyEntry = apiKeys.find((k) => k.provider === activeProvider);
    return keyEntry?.key || apiKey;
  }, [apiKeys, activeProvider, apiKey]);

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
      // Stop any ongoing speech
      window.speechSynthesis.cancel();
      setAvatarState('idle');
      startRecording();
    }
  }, [isRecording, stopRecording, startRecording, setAvatarState]);

  // --- Send Message to AI ---
  const sendUserMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg = {
        id: Date.now().toString(),
        role: 'user' as const,
        content: text.trim(),
        timestamp: Date.now(),
      };
      addMessage(userMsg);
      setTextInput('');
      setLastUserText(text.trim());
      setIsLoading(true);
      setAvatarState('thinking');

      try {
        const chatMessages = [
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user' as const, content: text.trim() },
        ];

        const activeKey = getActiveApiKey();
        const data = await sendMessage(
          activeProvider,
          activeKey,
          selectedModel,
          chatMessages,
          responseLanguage,
          permanentMemory
        );

        // Store in history but don't display
        const assistantMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: data.text,
          timestamp: Date.now(),
        };
        addMessage(assistantMsg);
        setAvatarState('speaking');

        // Speak the response (voice only - no text shown)
        if (!muted) {
          const speechLang = SPEECH_LANGUAGES[responseLanguage] || 'ar-SA';
          speakText(
            data.text,
            speechLang,
            () => {
              setAvatarState('idle');
            },
            () => {
              // Speech started
            }
          );
        } else {
          setTimeout(() => setAvatarState('idle'), 1000);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
        setError(errorMsg);
        setAvatarState('idle');
      } finally {
        setIsLoading(false);
      }
    },
    [messages, activeProvider, getActiveApiKey, selectedModel, responseLanguage, isLoading, muted, addMessage, setIsLoading, setError, setAvatarState, permanentMemory]
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
    window.speechSynthesis.cancel();
    setAvatarState('idle');
  }, [setAvatarState]);

  const toggleMute = useCallback(() => {
    if (muted) {
      setMuted(false);
    } else {
      window.speechSynthesis.cancel();
      setMuted(true);
      setAvatarState('idle');
    }
  }, [muted, setAvatarState]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
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
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white" dir="ltr">{selectedModel}</h1>
            <p className="text-xs text-gray-500">
              {responseLanguage === 'ar' ? 'عربي' : responseLanguage === 'en' ? 'English' : '日本語'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            title={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-gray-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
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

      {/* Main content - Full screen avatar */}
      <div className="flex-1 relative z-10 overflow-hidden">
        {/* Avatar - Center stage */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="relative w-full max-w-[500px] max-h-full aspect-[3/4]">
            <Live2DViewer avatarState={avatarState} modelPath={MODEL_PATH} />
          </div>
        </div>

        {/* Status overlay - shows what user said briefly (NO emoji/status text) */}
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
          {/* Text input (toggle) */}
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

          {/* Main control buttons */}
          {!showTextInput && (
            <div className="flex items-center justify-center gap-6">
              {/* Stop speaking */}
              {avatarState === 'speaking' && (
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

              {/* Mic button - main CTA */}
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

              {/* Keyboard toggle */}
              {!isLoading && avatarState === 'idle' && (
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

      {/* Settings dialog */}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onModelChange={() => setAppState('selectModel')}
      />
    </div>
  );
}
