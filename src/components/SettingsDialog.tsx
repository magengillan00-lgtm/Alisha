'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Globe, Volume2, Cpu, LogOut, X } from 'lucide-react';
import { useAppStore, type ResponseLanguage } from '@/store/useAppStore';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onModelChange: () => void;
}

const LANGUAGES: { code: ResponseLanguage; label: string; flag: string }[] = [
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
];

export default function SettingsDialog({ open, onClose, onModelChange }: SettingsDialogProps) {
  const {
    selectedModel,
    responseLanguage,
    setResponseLanguage,
    setAppState,
    setSelectedModel,
    clearMessages,
    models,
  } = useAppStore();
  const [tempModel, setTempModel] = useState(selectedModel);
  const [showModelSelect, setShowModelSelect] = useState(false);

  const handleLanguageChange = (lang: ResponseLanguage) => {
    setResponseLanguage(lang);
  };

  const handleModelChange = () => {
    setSelectedModel(tempModel);
    clearMessages();
    setAppState('selectModel');
    onClose();
    onModelChange();
  };

  const handleReset = () => {
    clearMessages();
    setAppState('setup');
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25 }}
          className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Settings className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">الإعدادات</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="p-5 space-y-6">
            {/* Language Selection */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <Globe className="w-4 h-4 text-emerald-400" />
                لغة الرد
              </label>
              <div className="grid grid-cols-3 gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`px-3 py-3 rounded-xl border text-sm font-medium transition-all duration-200 flex flex-col items-center gap-1 ${
                      responseLanguage === lang.code
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xl">{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                تغيير اللغة سيؤثر على صوت الرد تلقائياً
              </p>
            </div>

            {/* Voice Info */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                الصوت
              </label>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">
                    {responseLanguage === 'ar' ? '🇸🇦' : responseLanguage === 'en' ? '🇺🇸' : '🇯🇵'}
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">
                      {responseLanguage === 'ar' ? 'صوت عربي' : responseLanguage === 'en' ? 'English Voice' : '日本語音声'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {responseLanguage === 'ar' ? 'يتم استخدام Web Speech Synthesis' : 'Using Web Speech Synthesis'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                <Cpu className="w-4 h-4 text-emerald-400" />
                الموديل الحالي
              </label>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-2">
                <p className="text-sm text-white font-mono truncate" dir="ltr">{selectedModel}</p>
              </div>

              {!showModelSelect ? (
                <button
                  onClick={() => setShowModelSelect(true)}
                  className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:bg-white/10 transition-all"
                >
                  تغيير الموديل
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar">
                    {models.map((model) => (
                      <button
                        key={model}
                        onClick={() => setTempModel(model)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all ${
                          tempModel === model
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                        }`}
                        dir="ltr"
                      >
                        {model}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowModelSelect(false)}
                      className="flex-1 py-2 rounded-lg bg-white/5 text-gray-400 text-xs hover:bg-white/10 transition-all"
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleModelChange}
                      disabled={tempModel === selectedModel}
                      className="flex-1 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      تأكيد (إعادة بدء)
                    </button>
                  </div>
                  <p className="text-xs text-amber-400/80">
                    ⚠️ تغيير الموديل سيعيد بدء المحادثة
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-white/10">
            <button
              onClick={handleReset}
              className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              تسجيل الخروج وتغيير المفتاح
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
