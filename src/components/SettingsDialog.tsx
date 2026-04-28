'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Volume2,
  Cpu,
  LogOut,
  X,
  Palette,
  Save,
  Image,
} from 'lucide-react';
import { useAppStore, type ResponseLanguage } from '@/store/useAppStore';

interface BackgroundOption {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  gradient: string; // CSS gradient fallback while image loads
}

const BACKGROUNDS: BackgroundOption[] = [
  { id: 'bg1-anime-night', name: 'سماء ليلية', nameEn: 'Night Sky', emoji: '🌙', gradient: 'from-indigo-900 via-purple-900 to-blue-900' },
  { id: 'bg2-sakura-garden', name: 'حديقة الساكورا', nameEn: 'Sakura Garden', emoji: '🌸', gradient: 'from-pink-400 via-rose-300 to-amber-200' },
  { id: 'bg3-ocean-dream', name: 'حلم المحيط', nameEn: 'Ocean Dream', emoji: '🌊', gradient: 'from-cyan-600 via-teal-500 to-blue-400' },
  { id: 'bg4-galaxy-stars', name: 'المجرة والنجوم', nameEn: 'Galaxy Stars', emoji: '✨', gradient: 'from-violet-900 via-fuchsia-800 to-indigo-900' },
  { id: 'bg5-magic-forest', name: 'الغابة السحرية', nameEn: 'Magic Forest', emoji: '🌳', gradient: 'from-emerald-900 via-green-700 to-teal-800' },
  { id: 'bg6-sunset-city', name: 'غروب المدينة', nameEn: 'Sunset City', emoji: '🌆', gradient: 'from-orange-500 via-rose-400 to-purple-600' },
  { id: 'bg7-snow-mountain', name: 'الجبال الثلجية', nameEn: 'Snow Mountain', emoji: '🏔️', gradient: 'from-blue-200 via-slate-200 to-indigo-300' },
  { id: 'bg8-lavender-field', name: 'حقل اللافندر', nameEn: 'Lavender Field', emoji: '💜', gradient: 'from-purple-400 via-violet-300 to-pink-300' },
  { id: 'bg9-temple-sakura', name: 'معبد الساكورا', nameEn: 'Temple Sakura', emoji: '⛩️', gradient: 'from-red-400 via-pink-300 to-amber-200' },
  { id: 'bg10-rain-window', name: 'مطر النافذة', nameEn: 'Rain Window', emoji: '🌧️', gradient: 'from-slate-700 via-gray-600 to-blue-800' },
];

const LANGUAGES: { code: ResponseLanguage; label: string; flag: string }[] = [
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
];

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onModelChange: () => void;
}

export default function SettingsDialog({ open, onClose, onModelChange }: SettingsDialogProps) {
  const {
    selectedModel,
    responseLanguage,
    setResponseLanguage,
    selectedBackground,
    setSelectedBackground,
    setAppState,
    setSelectedModel,
    clearMessages,
    models,
  } = useAppStore();

  const [tempModel, setTempModel] = useState(selectedModel);
  const [tempLanguage, setTempLanguage] = useState(responseLanguage);
  const [tempBackground, setTempBackground] = useState(selectedBackground);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const hasChanges = (
    tempLanguage !== responseLanguage ||
    tempModel !== selectedModel ||
    tempBackground !== selectedBackground
  );

  const handleSave = () => {
    // Language change - no restart needed
    if (tempLanguage !== responseLanguage) {
      setResponseLanguage(tempLanguage);
    }

    // Background change - no restart needed
    if (tempBackground !== selectedBackground) {
      setSelectedBackground(tempBackground);
    }

    // Model change requires restart (clear chat)
    if (tempModel !== selectedModel) {
      setSelectedModel(tempModel);
      clearMessages();
      onClose();
      onModelChange();
      return;
    }

    onClose();
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
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 300, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 300, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="bg-gray-900/95 backdrop-blur-xl rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[85vh] overflow-hidden shadow-2xl border border-white/10 sm:border-white/5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - sticky */}
          <div className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur-xl flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <img
                  src="/settings-icon.png"
                  alt="Settings"
                  className="w-full h-full object-cover rounded-xl"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <h2 className="text-lg font-semibold text-white">الإعدادات</h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="overflow-y-auto custom-scrollbar max-h-[calc(85vh-130px)]">
            <div className="p-5 space-y-7">

              {/* ===== Language ===== */}
              <div>
                <button
                  onClick={() => setActiveSection(activeSection === 'lang' ? null : 'lang')}
                  className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3 w-full text-right"
                >
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span>لغة الرد</span>
                  <span className="text-gray-600 text-xs mr-auto">▼</span>
                </button>
                <div className="grid grid-cols-3 gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setTempLanguage(lang.code)}
                      className={`px-3 py-3 rounded-xl border text-sm font-medium transition-all duration-200 flex flex-col items-center gap-1.5 ${
                        tempLanguage === lang.code
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-500/10'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <span className="text-2xl">{lang.flag}</span>
                      <span className="text-xs">{lang.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2.5">
                  الرد سيكون بلغة الإعدادات حتى لو أرسلت بلغة مختلفة
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-white/5" />

              {/* ===== Voice ===== */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  الصوت
                </label>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {tempLanguage === 'ar' ? '🇸🇦' : tempLanguage === 'en' ? '🇺🇸' : '🇯🇵'}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">
                        {tempLanguage === 'ar' ? 'صوت عربي' : tempLanguage === 'en' ? 'English Voice' : '日本語音声'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Web Speech Synthesis - يتغير تلقائياً مع اللغة
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/5" />

              {/* ===== Backgrounds ===== */}
              <div>
                <button
                  onClick={() => setActiveSection(activeSection === 'bg' ? null : 'bg')}
                  className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3 w-full text-right"
                >
                  <Palette className="w-4 h-4 text-emerald-400" />
                  <span>خلفية الأفاتار</span>
                  <span className="text-gray-600 text-xs mr-auto">▼</span>
                </button>

                {/* Background grid - 2 columns */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Default / no background option */}
                  <button
                    onClick={() => setTempBackground('')}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 group ${
                      tempBackground === ''
                        ? 'border-emerald-400 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="aspect-[16/10] bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-lg">⬛</p>
                        <p className="text-[10px] text-gray-400 mt-1">افتراضي</p>
                      </div>
                    </div>
                    {tempBackground === '' && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>

                  {BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setTempBackground(bg.id)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 group ${
                        tempBackground === bg.id
                          ? 'border-emerald-400 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                          : 'border-white/10 hover:border-white/30 hover:shadow-lg'
                      }`}
                    >
                      <div className="aspect-[16/10] relative">
                        {/* Gradient fallback */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${bg.gradient}`} />
                        {/* Actual image */}
                        <img
                          src={`/backgrounds/${bg.id}.png`}
                          alt={bg.name}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
                      </div>
                      {/* Label */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs">{bg.emoji}</span>
                          <span className="text-[10px] text-white font-medium truncate">{bg.name}</span>
                        </div>
                      </div>
                      {/* Selected checkmark */}
                      {tempBackground === bg.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-1.5 right-1.5 w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center shadow-lg"
                        >
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </motion.div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-white/5" />

              {/* ===== Model ===== */}
              <div>
                <button
                  onClick={() => setActiveSection(activeSection === 'model' ? null : 'model')}
                  className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-3 w-full text-right"
                >
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>الموديل</span>
                  <span className="text-gray-600 text-xs mr-auto">▼</span>
                </button>

                {!showModelSelect ? (
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-3">
                    <p className="text-sm text-white font-mono truncate" dir="ltr">{tempModel}</p>
                    <button
                      onClick={() => setShowModelSelect(true)}
                      className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      تغيير الموديل
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar bg-white/5 rounded-xl p-2 border border-white/10">
                      {models.map((model) => (
                        <button
                          key={model}
                          onClick={() => setTempModel(model)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-mono transition-all ${
                            tempModel === model
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-transparent text-gray-400 hover:bg-white/10 border border-transparent'
                          }`}
                          dir="ltr"
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowModelSelect(false)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      إغلاق القائمة
                    </button>
                    <p className="text-xs text-amber-400/80">
                      تغيير الموديل سيمسح المحادثة الحالية
                    </p>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-white/5" />

              {/* ===== Logout ===== */}
              <div>
                <button
                  onClick={handleReset}
                  className="w-full py-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  تسجيل الخروج وتغيير المفتاح
                </button>
              </div>

              {/* Bottom spacing */}
              <div className="h-2" />
            </div>
          </div>

          {/* Footer - sticky save button */}
          <div className="sticky bottom-0 z-10 bg-gray-900/95 backdrop-blur-xl border-t border-white/10 px-5 py-4">
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-500 text-white font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:shadow-none"
            >
              <Save className="w-4 h-4" />
              حفظ التغييرات
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
