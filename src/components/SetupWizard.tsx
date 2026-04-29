'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, ArrowLeft, Loader2, Eye, EyeOff, Sparkles, AlertTriangle, Check, Wand2 } from 'lucide-react';
import { useAppStore, type ApiProvider } from '@/store/useAppStore';
import { PROVIDER_INFO, listModels } from '@/lib/gemini-client';

// Auto-detect API provider from key prefix
function detectProvider(key: string): ApiProvider | null {
  const k = key.trim();
  if (k.startsWith('AIza')) return 'gemini';
  if (k.startsWith('hf_')) return 'huggingface';
  if (k.startsWith('nvapi-')) return 'nvidia';
  if (k.startsWith('gsk_')) return 'groq';
  if (k.includes('together.ai') || k.startsWith('Bearer ') && k.includes('together')) return 'together';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('Bearer') && k.length > 20) {
    // Generic bearer token - try Cohere first, then Mistral
    return 'mistral';
  }
  return null;
}

export default function SetupWizard() {
  const { setAppState, setApiKeys, setActiveProvider } = useAppStore();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedProvider, setDetectedProvider] = useState<ApiProvider | null>(null);
  const [verifiedProviders, setVerifiedProviders] = useState<{ provider: ApiProvider; models: string[] }[]>([]);

  const detectedInfo = detectedProvider ? PROVIDER_INFO.find((p) => p.id === detectedProvider) : null;

  // Auto-detect on input change
  const handleInputChange = (value: string) => {
    setApiKeyInput(value);
    setError(null);
    if (value.trim().length > 3) {
      const detected = detectProvider(value);
      setDetectedProvider(detected);
    } else {
      setDetectedProvider(null);
    }
  };

  const handleVerify = async () => {
    const key = apiKeyInput.trim();
    if (!key) {
      setError('يرجى إدخال مفتاح API');
      return;
    }

    // Auto-detect or default to trying all providers
    const provider = detectProvider(key);

    setIsVerifying(true);
    setError(null);

    if (provider) {
      // Try the detected provider first
      try {
        const data = await listModels(provider, key);
        setApiKeys([{ provider, key }]);
        setActiveProvider(provider);
        useAppStore.getState().setModels(data.models);
        useAppStore.getState().setApiKey(key);
        setAppState('selectModel');
        setIsVerifying(false);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        // If detected provider fails, try others
        const otherProviders = PROVIDER_INFO.filter((p) => p.id !== provider).map((p) => p.id);
        let found = false;

        for (const tryProvider of otherProviders) {
          try {
            const data = await listModels(tryProvider, key);
            setApiKeys([{ provider: tryProvider, key }]);
            setActiveProvider(tryProvider);
            useAppStore.getState().setModels(data.models);
            useAppStore.getState().setApiKey(key);
            setAppState('selectModel');
            found = true;
            break;
          } catch {
            continue;
          }
        }

        if (found) {
          setIsVerifying(false);
          return;
        }

        setError(msg || `المفتاح لا يعمل مع أي مزود. تأكد من صحته.`);
        setIsVerifying(false);
        return;
      }
    }

    // No provider detected - try all providers one by one
    setError(null);
    const tryOrder: ApiProvider[] = ['gemini', 'huggingface', 'nvidia', 'groq', 'together', 'openrouter', 'cohere', 'mistral'];
    let found = false;

    for (const tryProvider of tryOrder) {
      try {
        setError(`جاري تجربة ${PROVIDER_INFO.find((p) => p.id === tryProvider)?.nameAr}...`);
        const data = await listModels(tryProvider, key);
        setApiKeys([{ provider: tryProvider, key }]);
        setActiveProvider(tryProvider);
        useAppStore.getState().setModels(data.models);
        useAppStore.getState().setApiKey(key);
        setAppState('selectModel');
        found = true;
        break;
      } catch {
        continue;
      }
    }

    if (!found) {
      setError('لم يتم التعرف على المفتاح أو لا يعمل مع أي مزود مدعوم. تأكد من صحة المفتاح.');
    }
    setIsVerifying(false);
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
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 mb-4">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Alisha - مساعد AI</h1>
          <p className="text-gray-400">أدخل مفتاح API وسيتعرف النظام تلقائياً على المزود</p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Key className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">مفتاح API</h2>
              <p className="text-sm text-gray-400">أدخل أي مفتاح والنظام سيتعرف عليه</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Unified API key input */}
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                placeholder="الصق مفتاح API هنا..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-left text-sm pr-12"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <Wand2 className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400/50 w-4 h-4" />
            </div>

            {/* Auto-detection result */}
            {detectedInfo && !isVerifying && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${detectedInfo.color} flex items-center justify-center text-lg`}>
                  {detectedInfo.icon}
                </div>
                <div>
                  <p className="text-sm text-emerald-300 font-medium">
                    تم التعرف: {detectedInfo.name} ({detectedInfo.nameAr})
                  </p>
                  <p className="text-xs text-emerald-400/60">سيتم التحقق تلقائياً عند الضغط على متابعة</p>
                </div>
                <Check className="w-4 h-4 text-emerald-400 ml-auto" />
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </motion.div>
            )}

            {/* Verify button */}
            <button
              onClick={handleVerify}
              disabled={isVerifying || !apiKeyInput.trim()}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:shadow-none"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري التحقق واكتشاف الموديلات...</span>
                </>
              ) : (
                <>
                  <ArrowLeft className="w-5 h-5" />
                  <span>تحقق ومتابعة</span>
                </>
              )}
            </button>
          </div>

          {/* Supported providers */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-gray-500 text-center mb-3">المزودون المدعومون (يتم التعرف تلقائياً)</p>
            <div className="flex flex-wrap justify-center gap-2">
              {PROVIDER_INFO.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] transition-colors ${
                    detectedProvider === p.id
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-white/[0.02] border-white/[0.06] text-gray-500'
                  }`}
                >
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
