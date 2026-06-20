// TTS Service - Google Direct Audio + Web Speech API fallback
// Re-exports the existing speech.ts TTS functionality

export {
  speakText,
  cancelSpeech,
  warmupSpeech,
  initTTS,
  unlockAudio,
  initVoices,
  SPEECH_LANGUAGES,
} from '@/lib/speech';

// Additional TTS helpers

/**
 * Get a Google TTS URL for direct audio playback
 */
export function getGoogleTTSUrl(text: string, lang: string): string {
  const langMap: Record<string, string> = { ar: 'ar', en: 'en', ja: 'ja' };
  const langCode = langMap[lang.split('-')[0]] || 'en';
  const encodedText = encodeURIComponent(text);
  return `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodedText}`;
}
