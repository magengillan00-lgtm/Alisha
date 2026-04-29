'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Volume2,
  Cpu,
  LogOut,
  X,
  Palette,
  Save,
  Brain,
  Clock,
  Plus,
  Trash2,
  ChevronRight,
  Image as ImageIcon,
  Layers,
  Key,
} from 'lucide-react';
import { useAppStore, type ResponseLanguage, type MemoryItem } from '@/store/useAppStore';
import { PROVIDER_INFO } from '@/lib/gemini-client';

// ============ BACKGROUNDS DATA ============

interface BackgroundOption {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  gradient: string;
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
  { id: 'bg11-shrine-golden', name: 'معبد ذهبي', nameEn: 'Golden Shrine', emoji: '🏯', gradient: 'from-amber-400 via-orange-300 to-pink-400' },
  { id: 'bg12-floating-island', name: 'جزيرة عائمة', nameEn: 'Floating Island', emoji: '🏝️', gradient: 'from-sky-400 via-blue-500 to-teal-500' },
  { id: 'bg13-cozy-room', name: 'غرفة مريحة', nameEn: 'Cozy Room', emoji: '🏠', gradient: 'from-amber-800 via-orange-900 to-red-900' },
  { id: 'bg14-aurora-lake', name: 'شفق القطبي', nameEn: 'Aurora Lake', emoji: '🌌', gradient: 'from-green-400 via-teal-500 to-purple-600' },
  { id: 'bg15-autumn-castle', name: 'قلعة الخريف', nameEn: 'Autumn Castle', emoji: '🍂', gradient: 'from-red-600 via-orange-500 to-amber-400' },
  { id: 'bg16-underwater-palace', name: 'قصر تحت الماء', nameEn: 'Underwater Palace', emoji: '🐚', gradient: 'from-blue-600 via-cyan-500 to-teal-600' },
  { id: 'bg17-bamboo-forest', name: 'غابة البامبو', nameEn: 'Bamboo Forest', emoji: '🎋', gradient: 'from-green-700 via-emerald-600 to-teal-700' },
  { id: 'bg18-steampunk-city', name: 'مدينة البخار', nameEn: 'Steampunk City', emoji: '⚙️', gradient: 'from-amber-600 via-orange-700 to-red-800' },
  { id: 'bg19-cloud-paradise', name: 'جنة السحب', nameEn: 'Cloud Paradise', emoji: '☁️', gradient: 'from-pink-300 via-purple-300 to-indigo-300' },
  { id: 'bg20-magic-library', name: 'المكتبة السحرية', nameEn: 'Magic Library', emoji: '📚', gradient: 'from-amber-800 via-yellow-900 to-orange-900' },
];

const LANGUAGES: { code: ResponseLanguage; label: string; flag: string }[] = [
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
];

// ============ SETTINGS SECTION COMPONENT ============

function SettingSection({
  icon,
  label,
  children,
  defaultOpen = true,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 flex-shrink-0">
          {icon}
        </div>
        <span className="text-sm font-medium text-gray-200 flex-1 text-right">{label}</span>
        <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============ MEMORY EDITOR COMPONENT ============

function MemoryEditor({
  memory,
  onUpdate,
  onAdd,
  onRemove,
  title,
  icon,
}: {
  memory: MemoryItem[];
  onUpdate: (id: string, content: string) => void;
  onAdd: (content: string) => void;
  onRemove: (id: string) => void;
  title: string;
  icon: React.ReactNode;
}) {
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleAdd = () => {
    if (newItem.trim()) {
      onAdd(newItem.trim());
      setNewItem('');
      // Scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const startEdit = (item: MemoryItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
  };

  const saveEdit = (id: string) => {
    if (editContent.trim()) {
      onUpdate(id, editContent.trim());
    }
    setEditingId(null);
    setEditContent('');
  };

  const sortedMemory = [...memory].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-2">
      {/* Memory items */}
      <div ref={scrollRef} className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5">
        {sortedMemory.map((item) => (
          <div
            key={item.id}
            className="bg-white/5 rounded-xl border border-white/[0.06] p-3 group"
          >
            <div className="flex items-start gap-2">
              <span className="text-xs font-mono text-emerald-400/60 bg-emerald-500/10 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                {item.order}
              </span>
              {editingId === item.id ? (
                <div className="flex-1 space-y-1.5">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full bg-white/5 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => saveEdit(item.id)}
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10"
                    >
                      حفظ
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-[10px] text-gray-400 hover:text-gray-300 px-2 py-0.5 rounded bg-white/5"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p
                    className="text-xs text-gray-300 flex-1 leading-relaxed cursor-pointer hover:text-white transition-colors"
                    onClick={() => startEdit(item)}
                    dir="auto"
                  >
                    {item.content}
                  </p>
                  <button
                    onClick={() => onRemove(item.id)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 transition-all flex-shrink-0"
                    title="حذف"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {sortedMemory.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-3">لا توجد عناصر</p>
        )}
      </div>

      {/* Add new item */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="أضف تعليمة جديدة..."
          className="flex-1 bg-white/5 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
        />
        <button
          onClick={handleAdd}
          disabled={!newItem.trim()}
          className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5 text-emerald-400" />
        </button>
      </div>
    </div>
  );
}

// ============ MAIN SETTINGS DIALOG ============

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
    permanentMemory,
    addPermanentMemory,
    removePermanentMemory,
    updatePermanentMemory,
    setPermanentMemory,
    messages,
    activeProvider,
    apiKeys,
  } = useAppStore();

  const [tempLanguage, setTempLanguage] = useState(responseLanguage);
  const [tempBackground, setTempBackground] = useState(selectedBackground);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [showBgPopup, setShowBgPopup] = useState(false);
  const [tempMemory, setTempMemory] = useState<MemoryItem[]>(permanentMemory);

  const hasChanges = (
    tempLanguage !== responseLanguage ||
    tempBackground !== selectedBackground ||
    JSON.stringify(tempMemory) !== JSON.stringify(permanentMemory)
  );

  // Sync temp memory when permanent memory changes externally
  useEffect(() => {
    setTempMemory(permanentMemory);
  }, [permanentMemory]);

  const handleSave = () => {
    // Language change
    if (tempLanguage !== responseLanguage) {
      setResponseLanguage(tempLanguage);
    }

    // Background change
    if (tempBackground !== selectedBackground) {
      setSelectedBackground(tempBackground);
    }

    // Memory change
    if (JSON.stringify(tempMemory) !== JSON.stringify(permanentMemory)) {
      setPermanentMemory(tempMemory);
    }

    onClose();
  };

  const handleReset = () => {
    clearMessages();
    setAppState('setup');
    onClose();
  };

  const handleClearChat = () => {
    clearMessages();
  };

  const handleAddTempMemory = (content: string) => {
    setTempMemory((prev) => {
      const maxOrder = prev.reduce((max, m) => Math.max(max, m.order), 0);
      return [...prev, { id: `mem-${Date.now()}`, content, order: maxOrder + 1 }];
    });
  };

  const handleRemoveTempMemory = (id: string) => {
    setTempMemory((prev) =>
      prev.filter((m) => m.id !== id).map((m, i) => ({ ...m, order: i + 1 }))
    );
  };

  const handleUpdateTempMemory = (id: string, content: string) => {
    setTempMemory((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content } : m))
    );
  };

  const providerInfo = PROVIDER_INFO.find((p) => p.id === activeProvider);

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
          className="bg-gray-900/95 backdrop-blur-xl rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[90vh] overflow-hidden shadow-2xl border border-white/10 sm:border-white/5"
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
          <div className="overflow-y-auto custom-scrollbar max-h-[calc(90vh-140px)]">
            <div className="p-4 space-y-3">

              {/* ===== Provider Info ===== */}
              {providerInfo && (
                <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] px-4 py-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${providerInfo.color} flex items-center justify-center text-lg`}>
                    {providerInfo.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">{providerInfo.name}</p>
                    <p className="text-xs text-gray-500" dir="ltr">{selectedModel}</p>
                  </div>
                  <Key className="w-4 h-4 text-gray-600" />
                </div>
              )}

              {/* ===== Language ===== */}
              <SettingSection icon={<Globe className="w-4 h-4" />} label="لغة الرد">
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
                <p className="text-[10px] text-gray-600 mt-2">
                  الرد سيكون بلغة الإعدادات حتى لو أرسلت بلغة مختلفة
                </p>
              </SettingSection>

              {/* ===== Voice ===== */}
              <SettingSection icon={<Volume2 className="w-4 h-4" />} label="الصوت">
                <div className="bg-white/5 rounded-xl p-3 border border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {tempLanguage === 'ar' ? '🇸🇦' : tempLanguage === 'en' ? '🇺🇸' : '🇯🇵'}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">
                        {tempLanguage === 'ar' ? 'صوت عربي' : tempLanguage === 'en' ? 'English Voice' : '日本語音声'}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Web Speech Synthesis - يتغير تلقائياً مع اللغة
                      </p>
                    </div>
                  </div>
                </div>
              </SettingSection>

              {/* ===== Backgrounds ===== */}
              <SettingSection icon={<Palette className="w-4 h-4" />} label="خلفية الأفاتار" defaultOpen={true}>
                {/* Button to open popup */}
                <button
                  onClick={() => setShowBgPopup(true)}
                  className="w-full flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
                >
                  {tempBackground ? (
                    <div className="w-12 h-8 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={`/backgrounds/${tempBackground}.png`}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-8 rounded-lg bg-gradient-to-br from-gray-950 to-emerald-950 flex items-center justify-center flex-shrink-0">
                      <ImageIcon className="w-4 h-4 text-gray-500" />
                    </div>
                  )}
                  <div className="flex-1 text-right">
                    <p className="text-xs text-white font-medium">
                      {tempBackground
                        ? BACKGROUNDS.find((b) => b.id === tempBackground)?.name || 'مخصصة'
                        : 'افتراضي'}
                    </p>
                    <p className="text-[10px] text-gray-500">اضغط لتغيير الخلفية</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
              </SettingSection>

              {/* ===== Model ===== */}
              <SettingSection icon={<Cpu className="w-4 h-4" />} label="الموديل" defaultOpen={false}>
                {!showModelSelect ? (
                  <div className="bg-white/5 rounded-xl p-3 border border-white/[0.06] mb-2">
                    <p className="text-sm text-white font-mono truncate" dir="ltr">{selectedModel}</p>
                    <button
                      onClick={() => setShowModelSelect(true)}
                      className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      تغيير الموديل
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar bg-white/5 rounded-xl p-2 border border-white/[0.06]">
                      {models.map((model) => (
                        <button
                          key={model}
                          onClick={() => {
                            setSelectedModel(model);
                            setShowModelSelect(false);
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-mono transition-all bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          dir="ltr"
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-amber-400/80">
                      تغيير الموديل سيمسح المحادثة الحالية
                    </p>
                  </div>
                )}
              </SettingSection>

              {/* ===== Permanent Memory ===== */}
              <SettingSection icon={<Brain className="w-4 h-4" />} label="ملف الذاكرة الدائمة" defaultOpen={false}>
                <p className="text-[10px] text-gray-500 mb-2">
                  هذه التعليمات تُقرأ في كل محادثة جديدة ولا تُنسى أبداً
                </p>
                <MemoryEditor
                  memory={tempMemory}
                  onUpdate={(id, content) => handleUpdateTempMemory(id, content)}
                  onAdd={handleAddTempMemory}
                  onRemove={handleRemoveTempMemory}
                  title="ذاكرة دائمة"
                  icon={<Brain className="w-3 h-3" />}
                />
              </SettingSection>

              {/* ===== Temporary Memory (Current Chat) ===== */}
              <SettingSection icon={<Clock className="w-4 h-4" />} label="ذاكرة المحادثة الحالية" defaultOpen={false}>
                <p className="text-[10px] text-gray-500 mb-2">
                  تحتوي على رسائل المحادثة الحالية ({messages.length} رسالة)
                </p>
                <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1 mb-2">
                  {messages.length === 0 ? (
                    <p className="text-xs text-gray-600 text-center py-3">لا توجد رسائل</p>
                  ) : (
                    messages.slice(-10).map((msg) => (
                      <div key={msg.id} className="bg-white/5 rounded-lg px-3 py-2 border border-white/[0.06]">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            msg.role === 'user'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {msg.role === 'user' ? 'أنت' : 'Alisha'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 line-clamp-2" dir="auto">{msg.content}</p>
                      </div>
                    ))
                  )}
                </div>
                {messages.length > 0 && (
                  <button
                    onClick={handleClearChat}
                    className="w-full py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    مسح المحادثة والبدء من جديد
                  </button>
                )}
              </SettingSection>

              {/* ===== API Keys ===== */}
              <SettingSection icon={<Key className="w-4 h-4" />} label="مفاتيح API" defaultOpen={false}>
                <div className="space-y-1.5">
                  {PROVIDER_INFO.map((p) => {
                    const hasKey = apiKeys.some((k) => k.provider === p.id && k.key);
                    const isActive = activeProvider === p.id;
                    return (
                      <div key={p.id} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/[0.06]">
                        <span className="text-base">{p.icon}</span>
                        <span className="text-xs text-gray-300 flex-1">{p.name}</span>
                        {hasKey ? (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">فعّال</span>
                        ) : (
                          <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">غير مضاف</span>
                        )}
                        {isActive && (
                          <span className="text-[10px] text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30">نشط</span>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-gray-600 mt-1">
                    لإضافة أو تغيير المفاتيح، قم بتسجيل الخروج
                  </p>
                </div>
              </SettingSection>

              {/* ===== Logout ===== */}
              <div className="pt-1">
                <button
                  onClick={handleReset}
                  className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  تسجيل الخروج وتغيير المفاتيح
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

        {/* ===== BACKGROUND POPUP ===== */}
        <AnimatePresence>
          {showBgPopup && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
              onClick={() => setShowBgPopup(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 50 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 50 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="bg-gray-900/98 backdrop-blur-xl rounded-3xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl border border-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Popup Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">اختر خلفية</h3>
                      <p className="text-[10px] text-gray-500">{BACKGROUNDS.length} خلفية متاحة</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowBgPopup(false)}
                    className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Popup Content - scrollable grid */}
                <div className="p-4 overflow-y-auto custom-scrollbar max-h-[calc(85vh-80px)]">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {/* Default option */}
                    <button
                      onClick={() => {
                        setTempBackground('');
                        setShowBgPopup(false);
                      }}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 group ${
                        tempBackground === ''
                          ? 'border-emerald-400 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div className="aspect-[16/10] bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950 flex items-center justify-center">
                        <p className="text-lg">⬛</p>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                        <p className="text-[10px] text-white font-medium">افتراضي</p>
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
                        onClick={() => {
                          setTempBackground(bg.id);
                          setShowBgPopup(false);
                        }}
                        className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 group ${
                          tempBackground === bg.id
                            ? 'border-emerald-400 shadow-lg shadow-emerald-500/20 scale-[1.02]'
                            : 'border-white/10 hover:border-white/30 hover:shadow-lg'
                        }`}
                      >
                        <div className="aspect-[16/10] relative">
                          <div className={`absolute inset-0 bg-gradient-to-br ${bg.gradient}`} />
                          <img
                            src={`/backgrounds/${bg.id}.png`}
                            alt={bg.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <span className="text-xs">{bg.emoji}</span>
                            <span className="text-[10px] text-white font-medium truncate">{bg.name}</span>
                          </div>
                        </div>
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
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
