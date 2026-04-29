'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, ArrowLeft, Loader2, Eye, EyeOff, Sparkles, AlertTriangle, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppStore, type ApiProvider } from '@/store/useAppStore';
import { PROVIDER_INFO, listModels } from '@/lib/gemini-client';

export default function SetupWizard() {
  const { setAppState, setApiKeys, setActiveProvider } = useAppStore();
  const [selectedProvider, setSelectedProvider] = useState<ApiProvider>('gemini');
  const [apiKeysInput, setApiKeysInput] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set(['gemini']));
  const [lastVerifiedProvider, setLastVerifiedProvider] = useState<string | null>(null);

  const providerInfo = PROVIDER_INFO.find((p) => p.id === selectedProvider)!;

  const toggleProvider = (id: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleVerify = async () => {
    const key = apiKeysInput[selectedProvider]?.trim();
    if (!key) {
      setError('يرجى إدخال مفتاح API');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setLastVerifiedProvider(selectedProvider);

    try {
      const data = await listModels(selectedProvider, key);

      // Save all entered keys
      const allKeys = useAppStore.getState().apiKeys.filter((k) => !apiKeysInput[k.provider]);
      const newKeys = Object.entries(apiKeysInput)
        .filter(([, v]) => v.trim())
        .map(([provider, key]) => ({ provider: provider as ApiProvider, key: key.trim() }));
      
      setApiKeys([...allKeys, ...newKeys]);
      setActiveProvider(selectedProvider);
      useAppStore.getState().setModels(data.models);
      
      // Legacy support
      useAppStore.getState().setApiKey(key);
      setAppState('selectModel');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyProvider = async (providerId: ApiProvider) => {
    const key = apiKeysInput[providerId]?.trim();
    if (!key) return;

    setLastVerifiedProvider(providerId);
    setIsVerifying(true);
    setError(null);

    try {
      await listModels(providerId, key);
      
      // Save the key
      const existing = useAppStore.getState().apiKeys.filter((k) => k.provider !== providerId);
      const newKeys = Object.entries(apiKeysInput)
        .filter(([p, v]) => v.trim())
        .map(([p, k]) => ({ provider: p as ApiProvider, key: k.trim() }));
      setApiKeys([...existing, ...newKeys]);

      setLastVerifiedProvider(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطأ في التحقق';
      setError(`${PROVIDER_INFO.find((p) => p.id === providerId)?.nameAr}: ${msg}`);
      setLastVerifiedProvider(null);
    } finally {
      setIsVerifying(false);
    }
  };

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
        className="w-full max-w-md relative"
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
          <h1 className="text-3xl font-bold text-white mb-2">مساعد AI الذكي</h1>
          <p className="text-gray-400">محادثة ذكية مع أفاتار Live2D تفاعلي</p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Key className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">إدخال مفاتيح API</h2>
                <p className="text-sm text-gray-400">أدخل مفتاح واحد على الأقل للبدء</p>
              </div>
            </div>
          </div>

          {/* Scrollable providers */}
          <div className="max-h-[50vh] overflow-y-auto custom-scrollbar px-6 pb-4 space-y-2">
            {PROVIDER_INFO.map((provider) => {
              const isExpanded = expandedProviders.has(provider.id);
              const isVerifyingThis = isVerifying && lastVerifiedProvider === provider.id;
              const key = apiKeysInput[provider.id] || '';

              return (
                <div key={provider.id} className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
                  {/* Provider header */}
                  <button
                    onClick={() => toggleProvider(provider.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${provider.color} flex items-center justify-center text-lg flex-shrink-0`}>
                      {provider.icon}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-white">{provider.name}</p>
                      <p className="text-xs text-gray-500">{provider.nameAr}</p>
                    </div>
                    {key && (
                      <div className="w-5 h-5 bg-emerald-500/20 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-emerald-400" />
                      </div>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    )}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1">
                      <div className="relative">
                        <input
                          type={showKeys[provider.id] ? 'text' : 'password'}
                          value={key}
                          onChange={(e) => {
                            setApiKeysInput((prev) => ({ ...prev, [provider.id]: e.target.value }));
                            setError(null);
                          }}
                          placeholder={`أدخل مفتاح ${provider.name}...`}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-sm"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKeys((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                        >
                          {showKeys[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {isVerifyingThis && (
                        <div className="flex items-center gap-2 mt-2">
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                          <span className="text-xs text-emerald-400">جاري التحقق...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-6 mb-4"
            >
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Actions */}
          <div className="px-6 pb-6 pt-2 space-y-3">
            <button
              onClick={handleVerify}
              disabled={isVerifying || !apiKeysInput[selectedProvider]?.trim()}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:shadow-none"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري التحقق من {providerInfo.nameAr}...</span>
                </>
              ) : (
                <>
                  <ArrowLeft className="w-5 h-5" />
                  <span>تحقق ومتابعة ({providerInfo.nameAr})</span>
                </>
              )}
            </button>

            <p className="text-xs text-gray-500 text-center">
              اختر مزوداً وأدخل مفتاحه. يتم التحقق من الموديلات تلقائياً.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
