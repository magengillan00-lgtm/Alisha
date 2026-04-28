'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, ArrowLeft, Loader2, Check, Sparkles, RotateCcw } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

export default function ModelSelector() {
  const {
    models,
    selectedModel,
    setSelectedModel,
    setAppState,
    setApiKey,
    clearMessages,
  } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');

  const filteredModels = models.filter((m) =>
    m.toLowerCase().includes(search.toLowerCase())
  );

  const sortedModels = [...filteredModels].sort((a, b) => {
    // Prioritize gemini-2.5 and gemini-2.0 models
    const priority = (name: string) => {
      if (name.includes('2.5')) return 0;
      if (name.includes('2.0')) return 1;
      if (name.includes('1.5')) return 2;
      return 3;
    };
    return priority(a) - priority(b);
  });

  const handleSelect = (model: string) => {
    setSelectedModel(model);
  };

  const handleContinue = () => {
    if (!selectedModel) return;
    setIsLoading(true);
    clearMessages();
    // Small delay for animation
    setTimeout(() => {
      setAppState('chat');
      setIsLoading(false);
    }, 500);
  };

  const handleBack = () => {
    setApiKey('');
    setSelectedModel('');
    setAppState('setup');
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const apiKey = useAppStore.getState().apiKey;
      const res = await fetch('/api/gemini/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      if (res.ok) {
        useAppStore.getState().setModels(data.models);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 right-1/3 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/3 left-1/3 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg relative"
      >
        {/* Header */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-6"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 mb-3">
            <Cpu className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">اختر الموديل</h1>
          <p className="text-gray-400 text-sm">اختر موديل Gemini للمحادثة</p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl"
        >
          {/* Search */}
          <div className="relative mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن موديل..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
              dir="ltr"
            />
          </div>

          {/* Models list */}
          <div className="max-h-72 overflow-y-auto space-y-2 mb-4 custom-scrollbar">
            <AnimatePresence>
              {sortedModels.map((model, index) => (
                <motion.button
                  key={model}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleSelect(model)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 flex items-center gap-3 group ${
                    selectedModel === model
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:border-white/20'
                  }`}
                  dir="ltr"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    selectedModel === model
                      ? 'bg-emerald-500/30'
                      : 'bg-white/10 group-hover:bg-white/20'
                  }`}>
                    {selectedModel === model ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-gray-500 group-hover:text-gray-400" />
                    )}
                  </div>
                  <span className="text-sm font-mono truncate">{model}</span>
                </motion.button>
              ))}
            </AnimatePresence>

            {sortedModels.length === 0 && (
              <p className="text-center text-gray-500 text-sm py-8">
                لا توجد موديلات مطابقة
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all flex items-center gap-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              رجوع
            </button>

            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all flex items-center gap-2 text-sm"
            >
              <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              تحديث
            </button>

            <button
              onClick={handleContinue}
              disabled={!selectedModel || isLoading}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:shadow-none"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  ابدأ المحادثة
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
