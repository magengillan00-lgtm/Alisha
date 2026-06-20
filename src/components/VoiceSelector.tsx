'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { AVAILABLE_VOICES, getVoicesForLanguage, getVoiceRate, speakText } from '@/lib/speech'
import { Loader2, Play, Check } from 'lucide-react'

interface VoiceSelectorProps {
  currentLanguage?: string;
  onVoiceChange?: () => void; // ✅ callback عند تغيير الصوت
}

export function VoiceSelector({ currentLanguage, onVoiceChange }: VoiceSelectorProps) {
  const { responseLanguage, selectedVoiceId, setSelectedVoiceId } = useAppStore()
  const [testing, setTesting] = useState<string | null>(null)
  const [tempVoiceId, setTempVoiceId] = useState(selectedVoiceId)

  // ✅ استخدم currentLanguage (tempLanguage) إن وُجد، وإلا responseLanguage
  const langCode = (currentLanguage || responseLanguage || 'ar').split('-')[0]
  const voices = getVoicesForLanguage(langCode)

  // إذا لم يوجد صوت مطابق للغة الحالية، اعرض كل الأصوات
  const displayVoices = voices.length > 0 ? voices : AVAILABLE_VOICES

  const handleSelect = (voiceId: string) => {
    setTempVoiceId(voiceId)
    setSelectedVoiceId(voiceId)
    onVoiceChange?.() // ✅ إخبار SettingsDialog بالتغيير
  }

  const handleTest = async (voiceId: string) => {
    setTesting(voiceId)
    const testText = langCode === 'ar' ? 'مرحبا، هذا اختبار للصوت'
      : langCode === 'ja' ? 'こんにちは、これは音声テストです'
      : 'Hello, this is a voice test'

    try {
      const rate = getVoiceRate(voiceId)
      await speakText(
        testText,
        langCode,
        () => setTesting(null),
        () => {},
        rate
      )
    } catch {
      setTesting(null)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-400 mb-3">
        اختر الصوت المفضل لك. اضغط على زر التشغيل للاستماع لعينة.
      </p>

      {displayVoices.map((voice) => (
        <div
          key={voice.id}
          className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
            tempVoiceId === voice.id
              ? 'bg-pink-500/15 border-pink-500/40'
              : 'bg-white/5 border-white/10 hover:bg-white/10'
          }`}
        >
          <button
            onClick={() => handleSelect(voice.id)}
            className="flex items-center gap-3 flex-1 text-right"
          >
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              tempVoiceId === voice.id
                ? 'bg-pink-500 border-pink-500'
                : 'border-gray-500'
            }`}>
              {tempVoiceId === voice.id && <Check className="w-3 h-3 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${tempVoiceId === voice.id ? 'text-pink-300' : 'text-gray-300'}`}>
                {voice.name}
              </p>
              <p className="text-[10px] text-gray-500 truncate">
                {voice.description}
              </p>
            </div>
            <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
              {voice.gender === 'female' ? '♀' : '♂'}
            </span>
          </button>

          {/* زر الاختبار */}
          <button
            onClick={() => handleTest(voice.id)}
            disabled={testing === voice.id}
            className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 hover:bg-white/15 transition-colors flex items-center justify-center flex-shrink-0"
            title="استمع لعينة"
          >
            {testing === voice.id ? (
              <Loader2 className="w-4 h-4 text-pink-400 animate-spin" />
            ) : (
              <Play className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      ))}

      <p className="text-[10px] text-gray-600 mt-2">
        💡 الأصوات تعتمد على Google Translate TTS عبر proxy.
      </p>
    </div>
  )
}
