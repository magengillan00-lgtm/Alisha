'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Send,
  Settings,
  Trash2,
  StopCircle,
  Keyboard,
  VolumeX,
  Volume2,
  MessageSquare,
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
    clearMessages,
    isLoading,
    setIsLoading,
    setError,
    setAppState,
  } = useAppStore();

  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [showText, setShowText] = useState(true);
  const [muted, setMuted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);


  const recognitionRef = useRef<unknown>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize voices on mount
  useEffect(() => {
    initVoices();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const MODEL_PATH = '/live2d/kei_en/kei_basic_free/runtime/kei_basic_free.model3.json';

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
      } catch (e) {
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

  // --- Send Message to Gemini ---
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
      setIsLoading(true);
      setAvatarState('thinking');

      try {
        const chatMessages = [
          ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user' as const, content: text.trim() },
        ];

        // Call Gemini API directly from browser (bypasses server region restrictions)
        const data = await sendMessage(apiKey, selectedModel, chatMessages, responseLanguage);

        const assistantMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: data.text,
          timestamp: Date.now(),
        };
        addMessage(assistantMsg);
        setAvatarState('speaking');

        // Speak the response
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
    [messages, apiKey, selectedModel, responseLanguage, isLoading, muted, addMessage, setIsLoading, setError, setAvatarState]
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

  const handleClearChat = useCallback(() => {
    window.speechSynthesis.cancel();
    clearMessages();
    setAvatarState('idle');
  }, [clearMessages, setAvatarState]);

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
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950 overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

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
            onClick={handleClearChat}
            className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            title="مسح المحادثة"
          >
            <Trash2 className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            title="الإعدادات"
          >
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex relative z-10 overflow-hidden">
        {/* Avatar side */}
        <div className="hidden md:flex w-1/2 lg:w-2/5 items-center justify-center p-4">
          <div className="relative w-full max-w-[500px] aspect-[3/4]">
            <Live2DViewer avatarState={avatarState} modelPath={MODEL_PATH} />
          </div>
        </div>

        {/* Chat side */}
        <div className="w-full md:w-1/2 lg:w-3/5 flex flex-col border-l border-white/5">
          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
          >
            {/* Mobile avatar */}
            <div className="md:hidden flex justify-center mb-4">
              <div className="relative w-48 h-64">
                <Live2DViewer avatarState={avatarState} modelPath={MODEL_PATH} />
              </div>
            </div>

            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-4"
                >
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                    <Mic className="w-8 h-8 text-emerald-400" />
                  </div>
                </motion.div>
                <h2 className="text-lg font-semibold text-white mb-2">ابدأ المحادثة</h2>
                <p className="text-sm text-gray-400 max-w-xs">
                  اضغط على زر الميكروفون للتحدث صوتياً أو اكتب رسالتك في الأسفل
                </p>
              </div>
            )}

            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-100 rounded-br-md'
                        : 'bg-white/5 border border-white/10 text-gray-200 rounded-bl-md'
                    }`}
                  >
                    {msg.role === 'assistant' && !showText ? (
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Volume2 className="w-4 h-4" />
                        <span className="italic">
                          {responseLanguage === 'ar'
                            ? 'تم الرد صوتياً'
                            : responseLanguage === 'en'
                            ? 'Voice reply'
                            : '音声で返信'}
                        </span>
                        <button
                          onClick={() => setShowText(true)}
                          className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                        >
                          {responseLanguage === 'ar' ? 'عرض النص' : 'Show text'}
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <p className="text-[10px] text-gray-500 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-4 border-t border-white/10 bg-black/20 backdrop-blur-sm">
            {/* Interim text */}
            {interimText && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
              >
                <p className="text-sm text-emerald-300">{interimText}</p>
              </motion.div>
            )}

            <div className="flex items-center gap-2">
              {/* Text input */}
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      handleTextSubmit(e);
                    }
                  }}
                  placeholder={
                    responseLanguage === 'ar'
                      ? 'اكتب رسالتك...'
                      : responseLanguage === 'en'
                      ? 'Type your message...'
                      : 'メッセージを入力...'
                  }
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
                  disabled={isLoading}
                />
              </div>

              {/* Send button */}
              <button
                onClick={() => handleTextSubmit()}
                disabled={!textInput.trim() || isLoading}
                className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-4 h-4 text-emerald-400" />
              </button>

              {/* Stop speaking button */}
              {avatarState === 'speaking' && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={stopSpeaking}
                  className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center hover:bg-rose-500/30 transition-all"
                >
                  <StopCircle className="w-4 h-4 text-rose-400" />
                </motion.button>
              )}

              {/* Mic button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleRecording}
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isRecording
                    ? 'bg-rose-500 border border-rose-400 shadow-lg shadow-rose-500/50'
                    : 'bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500/30'
                }`}
              >
                {isRecording ? (
                  <MicOff className="w-4 h-4 text-white" />
                ) : (
                  <Mic className="w-4 h-4 text-emerald-400" />
                )}
              </motion.button>
            </div>

            {/* Hint */}
            <p className="text-[10px] text-gray-600 text-center mt-2">
              🎤 اضغط الميكروفون للتحدث | ⌨️ أو اكتب رسالتك
            </p>
          </div>
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
