'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
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
  Check,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Zap,
  Mic,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useAppStore, type ResponseLanguage, type MemoryItem, type ApiProvider, type SttProvider } from '@/store/useAppStore';
import { PROVIDER_INFO, listModels, verifyManualKeyModel } from '@/lib/gemini-client';
import { STT_PROVIDERS } from '@/lib/stt-providers';
import { VoiceSelector } from '@/components/VoiceSelector';

// Auto-detect API provider from key prefix
// Order matters: more specific prefixes first
function detectProvider(key: string): ApiProvider | null {
  const k = key.trim();
  if (k.startsWith('AIza')) return 'gemini';
  if (k.startsWith('hf_')) return 'huggingface';
  if (k.startsWith('nvapi-')) return 'nvidia';
  if (k.startsWith('gsk_')) return 'groq';
  if (k.startsWith('ak_')) return 'abliteration';
  if (k.startsWith('ar-')) return 'agentrouter';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('sk-')) return 'agentrouter';
  if (k.includes('together.ai') || (k.startsWith('Bearer ') && k.includes('together'))) return 'together';
  if (k.startsWith('Bearer') && k.length > 20) return 'mistral';
  return null;
}

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
  { id: 'bg21-cherry-blossom-night', name: 'ساكورا الليل', nameEn: 'Cherry Blossom Night', emoji: '🌺', gradient: 'from-pink-900 via-rose-800 to-indigo-900' },
  { id: 'bg22-ice-palace', name: 'قصر الجليد', nameEn: 'Ice Palace', emoji: '❄️', gradient: 'from-blue-200 via-cyan-200 to-purple-300' },
  { id: 'bg23-firework-festival', name: 'مهرجان الألعاب النارية', nameEn: 'Firework Festival', emoji: '🎆', gradient: 'from-orange-400 via-red-500 to-purple-800' },
  { id: 'bg24-zen-garden', name: 'حديقة الزن', nameEn: 'Zen Garden', emoji: '🍃', gradient: 'from-green-800 via-emerald-700 to-amber-700' },
  { id: 'bg25-starlight-beach', name: 'شاطئ النجوم', nameEn: 'Starlight Beach', emoji: '🏖️', gradient: 'from-blue-900 via-cyan-600 to-indigo-800' },
  { id: 'bg26-ancient-temple', name: 'المعبد القديم', nameEn: 'Ancient Temple', emoji: '⛩️', gradient: 'from-gray-700 via-emerald-800 to-blue-900' },
  { id: 'bg27-flower-field', name: 'حقل الزهور', nameEn: 'Flower Field', emoji: '🌷', gradient: 'from-pink-300 via-rose-300 to-amber-300' },
  { id: 'bg28-cloud-city', name: 'المدينة السحابية', nameEn: 'Cloud City', emoji: '🌆', gradient: 'from-orange-300 via-purple-400 to-blue-600' },
  { id: 'bg29-moonlight-forest', name: 'غابة ضوء القمر', nameEn: 'Moonlight Forest', emoji: '🌙', gradient: 'from-blue-900 via-indigo-800 to-green-900' },
  { id: 'bg30-sakura-river', name: 'نهر الساكورا', nameEn: 'Sakura River', emoji: '🌸', gradient: 'from-pink-300 via-cyan-300 to-blue-400' },
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
}: {
  memory: MemoryItem[];
  onUpdate: (id: string, content: string) => void;
  onAdd: (content: string) => void;
  onRemove: (id: string) => void;
}) {
  const [newItem, setNewItem] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleAdd = () => {
    if (newItem.trim()) {
      onAdd(newItem.trim());
      setNewItem('');
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
}

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
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
    setPermanentMemory,
    messages,
    activeProvider,
    apiKeys,
    setApiKeys,
    setActiveProvider,
    setModels,
    sttProvider,
    setSttProvider,
    autoChangeBackground,
    setAutoChangeBackground,
    backgroundChangeInterval,
    setBackgroundChangeInterval,
  } = useAppStore();

  // Key section state
  const [showKeySection, setShowKeySection] = useState(false);
  const [switchingKeyId, setSwitchingKeyId] = useState<string | null>(null);

  // Manual key entry state
  const [showManualKeyForm, setShowManualKeyForm] = useState(false);
  const [manualKeyInput, setManualKeyInput] = useState('');
  const [detectedProvider, setDetectedProvider] = useState<ApiProvider | null>(null);
  const [showKeyPassword, setShowKeyPassword] = useState(false);
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [addKeyError, setAddKeyError] = useState<string | null>(null);
  const [addKeySuccess, setAddKeySuccess] = useState(false);

  // Model section state
  const [showModelSection, setShowModelSection] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  // Verify state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; error?: string } | null>(null);

  // General settings
  const [tempLanguage, setTempLanguage] = useState(responseLanguage);
  const [tempBackground, setTempBackground] = useState(selectedBackground);
  const [tempAutoChangeBg, setTempAutoChangeBg] = useState(autoChangeBackground);
  const [tempBgInterval, setTempBgInterval] = useState(backgroundChangeInterval);
  const [showBgPopup, setShowBgPopup] = useState(false);
  const [tempMemory, setTempMemory] = useState<MemoryItem[]>(permanentMemory);

  // Track key/model changes for save button
  const [keyChanged, setKeyChanged] = useState(false);
  const [modelChanged, setModelChanged] = useState(false);
  // ✅ تتبع تغيير الصوت
  const [voiceChanged, setVoiceChanged] = useState(false);

  const hasChanges = (
    tempLanguage !== responseLanguage ||
    tempBackground !== selectedBackground ||
    tempAutoChangeBg !== autoChangeBackground ||
    tempBgInterval !== backgroundChangeInterval ||
    JSON.stringify(tempMemory) !== JSON.stringify(permanentMemory) ||
    keyChanged ||
    modelChanged ||
    voiceChanged ||
    false
  );

  // Also track direct key input changes for the save button
  const [manualKeyChanged, setManualKeyChanged] = useState(false);

  const showSaveButton = hasChanges || manualKeyChanged;

  // Sync temp memory when permanent memory changes externally
  useEffect(() => {
    setTempMemory(permanentMemory);
  }, [permanentMemory]);

  // Sync temp values when settings open
  useEffect(() => {
    if (open) {
      setTempLanguage(responseLanguage);
      setTempBackground(selectedBackground);
      setTempAutoChangeBg(autoChangeBackground);
      setTempBgInterval(backgroundChangeInterval);
      setTempMemory(permanentMemory);
      setVerifyResult(null);
      setKeyChanged(false);
      setModelChanged(false);
      setManualKeyChanged(false);
      setManualKeyInput('');
      setDetectedProvider(null);
    }
  }, [open, responseLanguage, selectedBackground, permanentMemory]);

  const handleSave = () => {
    if (tempLanguage !== responseLanguage) {
      setResponseLanguage(tempLanguage);
    }
    if (tempBackground !== selectedBackground) {
      setSelectedBackground(tempBackground);
    }
    if (tempAutoChangeBg !== autoChangeBackground) {
      setAutoChangeBackground(tempAutoChangeBg);
    }
    if (tempBgInterval !== backgroundChangeInterval) {
      setBackgroundChangeInterval(tempBgInterval);
    }
    if (JSON.stringify(tempMemory) !== JSON.stringify(permanentMemory)) {
      setPermanentMemory(tempMemory);
    }
    // Key and model changes are already applied immediately
    setKeyChanged(false);
    setModelChanged(false);
    setManualKeyChanged(false);
    onClose();
  };

  const handleReset = () => {
    clearMessages();
    setAppState('selectModel');
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

  // Handle key input change with auto-detection
  const handleKeyInputChange = (value: string) => {
    setManualKeyInput(value);
    setAddKeyError(null);
    setAddKeySuccess(false);
    setManualKeyChanged(true);
    if (value.trim().length > 3) {
      const detected = detectProvider(value);
      setDetectedProvider(detected);
    } else {
      setDetectedProvider(null);
    }
  };

  // Add manual key with auto-detection
  const handleAddManualKey = async () => {
    const key = manualKeyInput.trim();
    if (!key) { setAddKeyError('يرجى إدخال المفتاح'); return; }
    setIsAddingKey(true);
    setAddKeyError(null);

    const detected = detectProvider(key);

    if (detected) {
      // Auto-detected provider - try it first
      try {
        const data = await listModels(detected, key);
        useAppStore.getState().addApiKey({ provider: detected, key });
        setActiveProvider(detected);
        setModels(data.models);
        if (data.models.length > 0) {
          setSelectedModel(data.models[0]);
        }
        setAddKeySuccess(true);
        setManualKeyInput('');
        setDetectedProvider(null);
        clearMessages();
        setKeyChanged(true);
        setTimeout(() => setAddKeySuccess(false), 2000);
        setIsAddingKey(false);
        return;
      } catch {
        // Detected provider failed, try others
      }
    }

    // Try all providers
    const tryOrder: ApiProvider[] = ['gemini', 'agentrouter', 'openrouter', 'huggingface', 'nvidia', 'groq', 'abliteration', 'together', 'cohere', 'mistral'];
    let found = false;

    for (const tryProvider of tryOrder) {
      if (tryProvider === detected) continue; // Already tried
      try {
        setAddKeyError(`جاري تجربة ${PROVIDER_INFO.find((p) => p.id === tryProvider)?.nameAr || tryProvider}...`);
        const data = await listModels(tryProvider, key);
        useAppStore.getState().addApiKey({ provider: tryProvider, key });
        setActiveProvider(tryProvider);
        setModels(data.models);
        if (data.models.length > 0) {
          setSelectedModel(data.models[0]);
        }
        setAddKeySuccess(true);
        setManualKeyInput('');
        setDetectedProvider(null);
        clearMessages();
        setKeyChanged(true);
        found = true;
        setTimeout(() => setAddKeySuccess(false), 2000);
        break;
      } catch {
        continue;
      }
    }

    if (!found) {
      setAddKeyError('لم يتم التعرف على المفتاح أو لا يعمل مع أي مزود مدعوم.');
    } else {
      setAddKeyError(null);
    }
    setIsAddingKey(false);
  };

  // Switch to manual key
  const handleSwitchToManualKey = async (provider: ApiProvider, key: string) => {
    setSwitchingKeyId(`manual-${provider}`);
    try {
      setActiveProvider(provider);
      clearMessages();
      // Fetch models for this provider/key
      const data = await listModels(provider, key);
      setModels(data.models);
      if (data.models.length > 0) {
        setSelectedModel(data.models[0]);
      }
      setShowKeySection(false);
      setKeyChanged(true); // Mark as changed so Save button appears
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل في جلب الموديلات';
      setAddKeyError(msg);
    } finally {
      setSwitchingKeyId(null);
    }
  };

  // Verify current key+model
  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const currentKey = apiKeys.find((k) => k.provider === activeProvider)?.key || '';
      if (currentKey) {
        const result = await verifyManualKeyModel(activeProvider, currentKey, selectedModel);
        setVerifyResult(result);
      } else {
        setVerifyResult({ success: false, error: 'لا يوجد مفتاح API' });
      }
    } catch {
      setVerifyResult({ success: false, error: 'فشل التحقق' });
    } finally {
      setIsVerifying(false);
    }
  };

  // Change model
  const handleChangeModel = (model: string) => {
    setSelectedModel(model);
    clearMessages();
    setShowModelSection(false);
    setModelChanged(true); // Mark as changed so Save button appears
  };

  const filteredModels = models.filter((m) =>
    m.toLowerCase().includes(modelSearch.toLowerCase())
  );

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

              {/* ===== Current Key Info ===== */}
              <div className="bg-white/[0.03] rounded-2xl border border-white/[0.06] px-4 py-3">
                <div className="flex items-center gap-3">
                  {providerInfo ? (
                    <>
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${providerInfo.color} flex items-center justify-center text-lg flex-shrink-0`}>
                        {providerInfo.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium">{providerInfo.name}</p>
                        <p className="text-xs text-gray-500">{providerInfo.nameAr} - مفتاح يدوي</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-lg flex-shrink-0">
                        🔑
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-400">لا يوجد مفتاح نشط</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ===== Change Key Section ===== */}
              <SettingSection icon={<Key className="w-4 h-4" />} label="تغيير المفتاح" defaultOpen={false}>
                <div className="space-y-2">
                  {/* Toggle manual key form */}
                  <button
                    onClick={() => setShowManualKeyForm(!showManualKeyForm)}
                    className="w-full flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Plus className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-xs text-white font-medium">إدخال مفتاح API</p>
                      <p className="text-[10px] text-gray-500">الصق أي مفتاح والنظام يتعرف تلقائياً</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${showManualKeyForm ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Manual key form with auto-detection */}
                  <AnimatePresence>
                    {showManualKeyForm && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2 bg-white/5 rounded-xl p-3 border border-white/[0.06]">
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                            <p className="text-[10px] text-emerald-400">الصق المفتاح والنظام سيتعرف على المزود تلقائياً</p>
                          </div>

                          <div className="relative">
                            <input
                              type={showKeyPassword ? 'text' : 'password'}
                              value={manualKeyInput}
                              onChange={(e) => handleKeyInputChange(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddManualKey()}
                              placeholder="الصق مفتاح API هنا..."
                              className="w-full bg-white/5 border border-white/[0.06] rounded-lg px-3 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                              dir="ltr"
                            />
                            <button
                              type="button"
                              onClick={() => setShowKeyPassword(!showKeyPassword)}
                              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                            >
                              {showKeyPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>

                          {/* Auto-detection result */}
                          {detectedProvider && !isAddingKey && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
                            >
                              <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${PROVIDER_INFO.find((p) => p.id === detectedProvider)?.color || 'from-gray-500 to-gray-600'} flex items-center justify-center text-xs`}>
                                {PROVIDER_INFO.find((p) => p.id === detectedProvider)?.icon}
                              </div>
                              <div className="flex-1">
                                <p className="text-[10px] text-emerald-300 font-medium">
                                  تم التعرف: {PROVIDER_INFO.find((p) => p.id === detectedProvider)?.name} ({PROVIDER_INFO.find((p) => p.id === detectedProvider)?.nameAr})
                                </p>
                              </div>
                              <Check className="w-3 h-3 text-emerald-400" />
                            </motion.div>
                          )}

                          {addKeyError && !addKeyError.includes('جاري تجربة') && (
                            <div className="flex items-start gap-1.5 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                              <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                              <p className="text-[10px] text-red-400">{addKeyError}</p>
                            </div>
                          )}

                          {addKeyError && addKeyError.includes('جاري تجربة') && (
                            <div className="flex items-center gap-1.5 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                              <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                              <p className="text-[10px] text-amber-400">{addKeyError}</p>
                            </div>
                          )}

                          {addKeySuccess && (
                            <div className="flex items-center gap-1.5 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                              <Check className="w-3 h-3 text-emerald-400" />
                              <p className="text-[10px] text-emerald-400">تمت إضافة المفتاح بنجاح</p>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={() => { setShowManualKeyForm(false); setManualKeyInput(''); setAddKeyError(null); setDetectedProvider(null); }}
                              className="flex-1 py-1.5 rounded-lg bg-white/5 border border-white/[0.06] text-gray-400 text-[10px] hover:bg-white/10 transition-all"
                            >
                              إلغاء
                            </button>
                            <button
                              onClick={handleAddManualKey}
                              disabled={isAddingKey || !manualKeyInput.trim()}
                              className="flex-1 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium hover:bg-emerald-500/30 disabled:opacity-30 transition-all flex items-center justify-center gap-1"
                            >
                              {isAddingKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              {isAddingKey ? 'جاري الاكتشاف...' : 'تحقق وإضافة'}
                            </button>
                          </div>

                          {/* Supported providers hint */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {PROVIDER_INFO.map((p) => (
                              <div
                                key={p.id}
                                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] border ${
                                  detectedProvider === p.id
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                    : 'bg-white/[0.02] border-white/[0.04] text-gray-600'
                                }`}
                              >
                                <span>{p.icon}</span>
                                <span>{p.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Existing manual keys */}
                  {apiKeys.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-500 px-1">المفاتيح اليدوية المحفوظة:</p>
                      {apiKeys.map((entry) => {
                        const pInfo = PROVIDER_INFO.find((p) => p.id === entry.provider);
                        const isActive = activeProvider === entry.provider;
                        return (
                          <button
                            key={entry.provider}
                            onClick={() => handleSwitchToManualKey(entry.provider, entry.key)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                              isActive
                                ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                                : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                            }`}
                          >
                            <span className="text-base">{pInfo?.icon || '🔑'}</span>
                            <span className="flex-1 text-right">{pInfo?.name || entry.provider}</span>
                            <span className="text-[10px] text-gray-500" dir="ltr">{entry.key.slice(0, 6)}...{entry.key.slice(-4)}</span>
                            {isActive && <Check className="w-3 h-3 text-emerald-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </SettingSection>

              {/* ===== Model Section ===== */}
              <SettingSection icon={<Cpu className="w-4 h-4" />} label="الموديل" defaultOpen={false}>
                <div className="space-y-2">
                  {/* Current model */}
                  <div className="bg-white/5 rounded-xl p-3 border border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-white font-mono truncate flex-1" dir="ltr">{selectedModel}</p>
                      <button
                        onClick={handleVerify}
                        disabled={isVerifying}
                        className="text-[10px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1 disabled:opacity-50"
                      >
                        {isVerifying ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Zap className="w-3 h-3" />
                        )}
                        اختبار
                      </button>
                    </div>

                    {/* Verify result */}
                    {verifyResult && (
                      <div className={`flex items-center gap-1.5 mt-2 p-2 rounded-lg ${
                        verifyResult.success
                          ? 'bg-emerald-500/10 border border-emerald-500/20'
                          : 'bg-red-500/10 border border-red-500/20'
                      }`}>
                        {verifyResult.success ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                        )}
                        <p className={`text-[10px] ${verifyResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                          {verifyResult.success ? 'المفتاح والموديل يعملان بنجاح!' : verifyResult.error}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Toggle model list */}
                  <button
                    onClick={() => setShowModelSection(!showModelSection)}
                    className="w-full flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                      <Cpu className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-xs text-white font-medium">تغيير الموديل</p>
                      <p className="text-[10px] text-gray-500">{models.length} موديل متاح</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${showModelSection ? 'rotate-90' : ''}`} />
                  </button>

                  {/* Model list */}
                  <AnimatePresence>
                    {showModelSection && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        {/* Search */}
                        <input
                          type="text"
                          value={modelSearch}
                          onChange={(e) => setModelSearch(e.target.value)}
                          placeholder="ابحث عن موديل..."
                          className="w-full bg-white/5 border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 mb-1"
                          dir="ltr"
                        />

                        <div className="max-h-40 overflow-y-auto space-y-1 custom-scrollbar bg-white/5 rounded-xl p-2 border border-white/[0.06]">
                          {filteredModels.map((model) => (
                            <button
                              key={model}
                              onClick={() => handleChangeModel(model)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all flex items-center gap-2 ${
                                selectedModel === model
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20'
                                  : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-transparent'
                              }`}
                              dir="ltr"
                            >
                              {selectedModel === model ? (
                                <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <div className="w-3 h-3 rounded-full border border-gray-600 flex-shrink-0" />
                              )}
                              <span className="truncate">{model}</span>
                            </button>
                          ))}
                          {filteredModels.length === 0 && (
                            <p className="text-xs text-gray-500 text-center py-3">لا توجد موديلات مطابقة</p>
                          )}
                        </div>
                        <p className="text-[10px] text-amber-400/80 mt-1">
                          تغيير الموديل سيمسح المحادثة الحالية
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </SettingSection>

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

              {/* ===== اختيار الصوت ===== */}
              <SettingSection icon={<Mic className="w-4 h-4" />} label="اختيار الصوت" defaultOpen={true}>
                <VoiceSelector currentLanguage={tempLanguage} onVoiceChange={() => setVoiceChanged(true)} />
              </SettingSection>

              {/* ===== Voice (read-only indicator, voice is always on) ===== */}
              <div className="bg-emerald-500/[0.08] rounded-2xl border border-emerald-500/20 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center text-lg">
                    🔊
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">
                      {tempLanguage === 'ar' ? 'صوت دائم' : tempLanguage === 'en' ? 'Always Voice' : '常に音声'}
                    </p>
                    <p className="text-[10px] text-emerald-400">
                      جميع الردود صوتية - الأفاتار يتحدث دائماً
                    </p>
                  </div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </div>

              {/* ===== Backgrounds ===== */}
              <SettingSection icon={<Palette className="w-4 h-4" />} label="خلفية الأفاتار" defaultOpen={false}>
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

                {/* Auto-change background */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-gray-400">تغيير تلقائي للخلفيات</p>
                    <button
                      onClick={() => setTempAutoChangeBg(!tempAutoChangeBg)}
                      className={`w-9 h-5 rounded-full transition-all flex items-center ${
                        tempAutoChangeBg ? 'bg-emerald-500 justify-end' : 'bg-white/10 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-sm mx-0.5" />
                    </button>
                  </div>
                  {tempAutoChangeBg && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-gray-500">الفترة الزمنية بين التغييرات</p>
                      <div className="flex gap-1.5">
                        {[5, 10, 15, 30, 60].map((mins) => (
                          <button
                            key={mins}
                            onClick={() => setTempBgInterval(mins)}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                              tempBgInterval === mins
                                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                                : 'bg-white/5 border border-white/[0.06] text-gray-400 hover:bg-white/10'
                            }`}
                          >
                            {mins >= 60 ? `${mins / 60}س` : `${mins}د`}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-600">
                        سيتم تدوير الخلفيات تلقائياً كل {tempBgInterval >= 60 ? `${tempBgInterval / 60} ساعة` : `${tempBgInterval} دقيقة`}
                      </p>
                    </div>
                  )}
                </div>
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

              {/* ===== ملاحظة المفاتيح ===== */}
              <SettingSection icon={<Shield className="w-4 h-4" />} label="ملاحظة حول المفاتيح" defaultOpen={false}>
                <div className="space-y-2">
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    🔐 جميع مفاتيح API تُحفظ محلياً في متصفحك فقط (localStorage) ولا تُرسل لأي خادم
                    باستثناء خادم المزود نفسه عند استخدام API.
                  </p>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    💡 للحصول على مفاتيح مجانية:
                  </p>
                  <ul className="text-[10px] text-gray-500 space-y-1 ps-4 list-disc">
                    <li>Google AI Studio: aistudio.google.com (مجاني)</li>
                    <li>Groq: console.groq.com (مجاني)</li>
                    <li>HuggingFace: huggingface.co/settings/tokens</li>
                    <li>OpenRouter: openrouter.ai/keys</li>
                  </ul>
                </div>
              </SettingSection>

              {/* ===== STT Provider ===== */}
              <SettingSection icon={<Mic className="w-4 h-4" />} label="محرك التعرف على الصوت" defaultOpen={false}>
                <div className="space-y-2">
                  <p className="text-[10px] text-gray-500 mb-2">
                    اختر محرك تحويل الصوت إلى نص
                  </p>
                  {STT_PROVIDERS.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => setSttProvider(provider.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-xs ${
                        sttProvider === provider.id
                          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                          : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-base">{provider.icon}</span>
                      <div className="flex-1 text-right">
                        <p className="font-medium">{provider.nameAr}</p>
                        <p className="text-[10px] text-gray-500">{provider.description}</p>
                      </div>
                      {sttProvider === provider.id && <Check className="w-3 h-3 text-emerald-400" />}
                    </button>
                  ))}
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

              <div className="h-2" />
            </div>
          </div>

          {/* Footer - sticky save button */}
          <div className="sticky bottom-0 z-10 bg-gray-900/95 backdrop-blur-xl border-t border-white/10 px-5 py-4">
            <button
              onClick={handleSave}
              disabled={!showSaveButton}
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

                <div className="p-4 overflow-y-auto custom-scrollbar max-h-[calc(85vh-80px)]">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
                        <div className={`aspect-[16/10] bg-gradient-to-br ${bg.gradient} flex items-center justify-center`}>
                          <span className="text-2xl drop-shadow-lg">{bg.emoji}</span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                          <p className="text-[10px] text-white font-medium truncate">{bg.name}</p>
                        </div>
                        {tempBackground === bg.id && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
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
