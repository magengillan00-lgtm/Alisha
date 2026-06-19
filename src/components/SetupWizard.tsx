'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, Loader2, Eye, EyeOff, Sparkles, AlertTriangle, Check, Wand2, ArrowLeft } from 'lucide-react';
import { useAppStore, type ApiProvider } from '@/store/useAppStore';
import { PROVIDER_INFO, listModels } from '@/lib/gemini-client';

// ✅ التعرف على المزود من بادئة المفتاح
function detectProvider(key: string): ApiProvider | null {
  const k = key.trim();
  if (k.startsWith('AIza')) return 'gemini';
  if (k.startsWith('hf_')) return 'huggingface';
  if (k.startsWith('nvapi-')) return 'nvidia';
  if (k.startsWith('gsk_')) return 'groq';
  if (k.startsWith('ak_')) return 'abliteration';
  if (k.startsWith('ar-')) return 'agentrouter';
  if (k.startsWith('sk-or-')) return 'openrouter';
  if (k.startsWith('sk-')) return 'openrouter'; // معظم مفاتيح sk- تكون OpenRouter
  return null;
}

interface SetupWizardProps {
  onBack?: () => void;
}

export default function SetupWizard({ onBack }: SetupWizardProps) {
  const { setAppState, setApiKeys, setActiveProvider, addApiKey } = useAppStore();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedProvider, setDetectedProvider] = useState<ApiProvider | null>(null);
  const [success, setSuccess] = useState(false);

  const detectedInfo = detectedProvider ? PROVIDER_INFO.find((p) => p.id === detectedProvider) : null;

  // ✅ التعرف التلقائي أثناء الكتابة
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

    const provider = detectProvider(key);

    if (!provider) {
      setError('لم يتم التعرف على المزود. تأكد من صحة المفتاح. البادئات المدعومة: AIza, hf_, nvapi-, gsk_, ak_, ar-, sk-or-, sk-');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      // ✅ جلب الموديلات المتاحة
      const data = await listModels(provider, key);

      // حفظ المفتاح
      addApiKey({ provider, key });
      setActiveProvider(provider);
      useAppStore.getState().setModels(data.models);

      // ✅ عرض رسالة نجاح ثم الانتقال لاختيار الموديل
      setSuccess(true);
      setTimeout(() => {
        setAppState('selectModel');
      }, 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل التحقق من المفتاح';
      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-950 via-pink-950 to-indigo-950">
      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-indigo-400/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md relative"
      >
        {/* Back button */}
        {onBack && (
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={onBack}
            className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            العودة
          </motion.button>
        )}

        {/* Logo / Title */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/25 mb-4">
            <Key className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">إدخال مفتاح API</h1>
          <p className="text-purple-200/70">أدخل مفتاح API الخاص بك للبدء</p>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">مفتاح API</h2>
              <p className="text-sm text-purple-200/60">النظام سيتعرف على المزود تلقائياً</p>
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
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all text-left text-sm pr-12"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400/50 w-4 h-4" />
            </div>

            {/* Auto-detection result */}
            {detectedInfo && !isVerifying && !success && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 bg-pink-500/10 border border-pink-500/20 rounded-xl"
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${detectedInfo.color} flex items-center justify-center text-lg`}>
                  {detectedInfo.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-pink-300 font-medium">
                    تم التعرف: {detectedInfo.name}
                  </p>
                  <p className="text-xs text-pink-400/60">سيتم جلب الموديلات المتاحة</p>
                </div>
                <Check className="w-4 h-4 text-pink-400" />
              </motion.div>
            )}

            {/* Success message */}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl"
              >
                <Check className="w-5 h-5 text-emerald-400" />
                <p className="text-sm text-emerald-300 font-medium">
                  تم التحقق بنجاح! جاري تحميل الموديلات...
                </p>
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
              disabled={isVerifying || !apiKeyInput.trim() || success}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 disabled:shadow-none"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري التحقق وجلب الموديلات...</span>
                </>
              ) : success ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>تم بنجاح</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  <span>تحقق ومتابعة</span>
                </>
              )}
            </button>
          </div>

          {/* Supported providers */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-purple-200/50 text-center mb-3">المزودون المدعومون (يتم التعرف تلقائياً)</p>
            <div className="flex flex-wrap justify-center gap-2">
              {PROVIDER_INFO.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] transition-colors ${
                    detectedProvider === p.id
                      ? 'bg-pink-500/10 border-pink-500/30 text-pink-300'
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

        {/* Help text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-xs text-purple-200/40 mt-6"
        >
          🔐 مفتاحك محفوظ محلياً في متصفحك فقط ولا يُرسل لأي خادم آخر
        </motion.p>
      </motion.div>
    </div>
  );
}
