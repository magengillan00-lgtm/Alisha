'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Key, Loader2, AlertTriangle, RefreshCw, ArrowLeft, Settings, ChevronDown } from 'lucide-react';
import { useAppStore, type FreeKey } from '@/store/useAppStore';
import { fetchFreeKeys, fetchFreeKeyModels, getCategoryIcon, getCategoryColor } from '@/lib/free-keys';
import SetupWizard from '@/components/SetupWizard';

export default function FreeKeysSelector() {
  const {
    setAppState,
    setFreeKeys,
    setSelectedFreeKey,
    setModels,
    freeKeys,
    setError,
    setIsUsingFreeKey,
  } = useAppStore();

  const [isLoading, setIsLoading] = useState(true);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setErrorLocal] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Fetch free keys on mount
  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = async () => {
    setIsLoading(true);
    setErrorLocal(null);
    try {
      const keys = await fetchFreeKeys();
      if (keys.length === 0) {
        setErrorLocal('لم يتم العثور على مفاتيح مجانية. حاول مرة أخرى أو أدخل مفتاحك يدوياً.');
      }
      setFreeKeys(keys);
    } catch {
      setErrorLocal('فشل في جلب المفاتيح المجانية. تحقق من اتصالك بالإنترنت.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectKey = async (key: FreeKey) => {
    setSelectedKeyId(key.id);
    setIsVerifying(true);
    setErrorLocal(null);

    try {
      const models = await fetchFreeKeyModels(key);
      
      setSelectedFreeKey(key);
      setIsUsingFreeKey(true);
      setModels(models);
      setAppState('selectModel');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل في جلب الموديلات';
      setErrorLocal(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRefresh = () => {
    setSelectedKeyId(null);
    loadKeys();
  };

  if (showManualEntry) {
    return <SetupWizard onBack={() => setShowManualEntry(false)} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950">
      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-emerald-400/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-lg relative"
      >
        {/* Logo / Title */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 mb-4">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Alisha - مساعد AI</h1>
          <p className="text-gray-400">اختر مفتاحاً مجانياً وابدأ المحادثة فوراً</p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Key className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">المفاتيح المتاحة</h2>
              <p className="text-sm text-gray-400">
                {isLoading ? 'جاري التحميل...' : `${freeKeys.length} مفتاح مجاني متاح`}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              title="تحديث"
            >
              <RefreshCw className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-4"
            >
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </motion.div>
          )}

          {/* Keys list */}
          <div className="max-h-80 overflow-y-auto space-y-2 mb-4 custom-scrollbar">
            <AnimatePresence>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                  <p className="text-sm text-gray-400">جاري جلب المفاتيح المجانية...</p>
                </div>
              ) : (
                freeKeys.map((key, index) => (
                  <motion.button
                    key={key.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleSelectKey(key)}
                    disabled={isVerifying}
                    className={`w-full text-right px-4 py-3 rounded-xl border transition-all duration-200 flex items-center gap-3 group ${
                      selectedKeyId === key.id
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:border-white/20'
                    } ${isVerifying && selectedKeyId !== key.id ? 'opacity-50' : ''}`}
                  >
                    {/* Category icon */}
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getCategoryColor(key.category)} flex items-center justify-center text-lg flex-shrink-0`}>
                      {getCategoryIcon(key.category)}
                    </div>
                    
                    {/* Key info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{key.category}</p>
                        {key.status === 'new' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">جديد</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate" dir="ltr">{key.model}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-600">{key.budget}</span>
                        <span className="text-[10px] text-gray-700">|</span>
                        <span className="text-[10px] text-gray-600">{key.rateLimit}</span>
                        <span className="text-[10px] text-gray-700">|</span>
                        <span className="text-[10px] text-gray-600">ينتهي: {key.expires}</span>
                      </div>
                    </div>

                    {/* Selection indicator */}
                    {isVerifying && selectedKeyId === key.id ? (
                      <Loader2 className="w-5 h-5 text-emerald-400 animate-spin flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-600 group-hover:text-gray-400 flex-shrink-0 rotate-[-90deg]" />
                    )}
                  </motion.button>
                ))
              )}
            </AnimatePresence>

            {!isLoading && freeKeys.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Key className="w-8 h-8 text-gray-600" />
                <p className="text-sm text-gray-500">لا توجد مفاتيح متاحة حالياً</p>
              </div>
            )}
          </div>

          {/* Manual entry button */}
          <div className="border-t border-white/10 pt-4">
            <button
              onClick={() => setShowManualEntry(true)}
              className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              إدخال مفتاح API يدوياً
            </button>
            <p className="text-[10px] text-gray-600 text-center mt-2">
              المفاتيح المجانية تُحدّث تلقائياً من GitHub
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
