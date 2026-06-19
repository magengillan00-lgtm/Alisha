// Web Speech API types for TypeScript
interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// Language codes for Web Speech API
export const SPEECH_LANGUAGES: Record<string, string> = {
  ar: 'ar-SA',
  en: 'en-US',
  ja: 'ja-JP',
};

// ✅ TTS proxy URL (Supabase Edge Function - يتجاوز CORS)
const SUPABASE_URL = 'https://khgvmatuqqgpctimzcoi.supabase.co';
const TTS_PROXY_URL = `${SUPABASE_URL}/functions/v1/tts-proxy`;

// ✅ خيارات الأصوات المتاحة لكل لغة
export interface VoiceOption {
  id: string;
  name: string;
  gender: 'male' | 'female';
  language: 'ar' | 'en' | 'ja';
  description: string;
  rate: number; // سرعة التشغيل (1.0 = عادي، 1.3 = سريع)
}

export const AVAILABLE_VOICES: VoiceOption[] = [
  // العربية
  { id: 'ar-1', name: 'صوت عربي (أنثوي)', gender: 'female', language: 'ar', description: 'صوت أنثوي طبيعي', rate: 1.0 },
  { id: 'ar-2', name: 'صوت عربي (سريع)', gender: 'female', language: 'ar', description: 'صوت أنثوي سريع', rate: 1.4 },
  // الإنجليزية
  { id: 'en-1', name: 'English (Female)', gender: 'female', language: 'en', description: 'Natural female voice', rate: 1.0 },
  { id: 'en-2', name: 'English (Male)', gender: 'male', language: 'en', description: 'Male voice via Web Speech API', rate: 1.0 },
  { id: 'en-3', name: 'English (Fast)', gender: 'female', language: 'en', description: 'Fast female voice', rate: 1.4 },
  // اليابانية
  { id: 'ja-1', name: '日本語音声 (女性)', gender: 'female', language: 'ja', description: '自然な女性の声', rate: 1.0 },
  { id: 'ja-2', name: '日本語音声 (速い)', gender: 'female', language: 'ja', description: '速い女性の声', rate: 1.4 },
];

// ✅ الحصول على الأصوات المتاحة للغة معينة
export function getVoicesForLanguage(lang: string): VoiceOption[] {
  const langCode = lang.split('-')[0];
  return AVAILABLE_VOICES.filter(v => v.language === langCode);
}

// ✅ الحصول على rate للصوت المختار
export function getVoiceRate(voiceId: string): number {
  const voice = AVAILABLE_VOICES.find(v => v.id === voiceId);
  return voice?.rate ?? 1.0;
}

// TTS language codes for Google Translate
const GTTS_LANG_MAP: Record<string, string> = {
  ar: 'ar',
  en: 'en',
  ja: 'ja',
};

// Voice names for TTS (Web Speech API)
const VOICE_NAMES: Record<string, string[]> = {
  ar: ['Google العربية', 'Arabic', 'arabic', 'Microsoft Naayf', 'Majed', 'Laila', 'Hoda', 'Maged', 'Tarik'],
  en: ['Google US English', 'Microsoft David', 'Samantha', 'Alex', 'Daniel', 'Google UK English Male', 'Zira', 'Mark', 'James'],
  ja: ['Google 日本語', 'Kyoko', 'Otoya', 'Microsoft Haruka', 'Microsoft Ayumi', 'Siri', 'Japanese', 'ja-JP', 'Noto'],
};

// ============ TTS STATE ============

let currentSpeechGeneration = 0;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let audioElement: HTMLAudioElement | null = null;
let useWebSpeechAPI = true; // Try Web Speech API first, fall back to Google TTS

// Detect if Web Speech API actually works (Android WebView reports it exists but doesn't work)
let speechAPITested = false;
let speechAPIWorks = false;

// Audio context for unlocking autoplay on mobile
let audioContext: AudioContext | null = null;
let audioUnlocked = false;

// Blob URLs to clean up
let activeBlobUrls: string[] = [];

// Keep a persistent unlocked Audio element to bypass WebView autoplay restrictions
let unlockedAudioPool: HTMLAudioElement[] = [];

/**
 * Unlock audio playback on mobile WebView.
 * MUST be called synchronously from a user gesture (touch/click) - before any await.
 */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;

  try {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    silentAudio.volume = 0.001;
    silentAudio.play().then(() => {
      audioUnlocked = true;
      console.log('TTS: Audio element unlocked via silent play');
      silentAudio.pause();
      silentAudio.src = '';
    }).catch(() => {
      audioUnlocked = true;
    });

    if (unlockedAudioPool.length === 0) {
      for (let i = 0; i < 3; i++) {
        const a = new Audio();
        a.preload = 'none';
        unlockedAudioPool.push(a);
      }
    }

    audioUnlocked = true;
  } catch (_e) {
    audioUnlocked = true;
  }
}

function getPooledAudio(): HTMLAudioElement {
  if (unlockedAudioPool.length > 0) {
    return unlockedAudioPool.pop()!;
  }
  return new Audio();
}

/**
 * Test if Web Speech Synthesis actually produces audio.
 */
export async function testSpeechAPI(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;

  return new Promise((resolve) => {
    try {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        // Wait for voiceschanged
        const timeout = setTimeout(() => resolve(false), 2000);
        window.speechSynthesis.onvoiceschanged = () => {
          clearTimeout(timeout);
          const v = window.speechSynthesis.getVoices();
          resolve(v.length > 0);
        };
      } else {
        resolve(true);
      }
    } catch {
      resolve(false);
    }
  });
}

export async function initTTS(): Promise<void> {
  if (speechAPITested) return;
  speechAPITested = true;

  if (typeof window === 'undefined' || !window.speechSynthesis) {
    useWebSpeechAPI = false;
    console.log('TTS: Web Speech API unavailable, using Google TTS proxy');
    return;
  }

  // Test if Web Speech API works
  const works = await testSpeechAPI();
  speechAPIWorks = works;
  useWebSpeechAPI = works;

  if (!works) {
    console.log('TTS: Web Speech API unavailable, using Google TTS proxy');
  }
}

export function cancelSpeech(): void {
  currentSpeechGeneration++;
  stopKeepAlive();

  if (audioElement) {
    try {
      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement.src = '';
    } catch (_e) { /* ignore */ }
    audioElement = null;
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch (_e) { /* ignore */ }
  }

  cleanupBlobUrls();
}

export function warmupSpeech(): void {
  if (typeof window === 'undefined') return;
  if (!window.speechSynthesis) return;
  // Just trigger voices to load
  window.speechSynthesis.getVoices();
}

// ============ MAIN speakText FUNCTION ============

/**
 * ✅ Speak text with the selected voice.
 * voiceId: معرف الصوت من AVAILABLE_VOICES (يحدد rate و Web Speech voice)
 * rate: سرعة التشغيل (1.0 = عادي)
 */
export async function speakText(
  text: string,
  lang: string,
  onEnd: () => void,
  onStart?: () => void,
  rate: number = 1.0
): Promise<void> {
  if (typeof window === 'undefined') {
    onEnd();
    return;
  }

  if (!text || !text.trim()) {
    onEnd();
    return;
  }

  // Make sure TTS is initialized
  if (!speechAPITested) {
    await initTTS();
  }

  if (useWebSpeechAPI && speechAPIWorks) {
    speakWithWebSpeech(text, lang, onEnd, onStart, rate);
  } else {
    speakWithGoogleTTS(text, lang, onEnd, onStart, rate);
  }
}

// ============ WEB SPEECH API TTS ============

function speakWithWebSpeech(
  text: string,
  lang: string,
  onEnd: () => void,
  onStart?: () => void,
  rate: number = 1.0
): void {
  const thisGeneration = ++currentSpeechGeneration;
  stopKeepAlive();

  cancelAndWait().then(() => {
    if (thisGeneration !== currentSpeechGeneration) return;

    if (text.length > 200) {
      speakInChunks(text, lang, onEnd, onStart, rate, thisGeneration);
    } else {
      speakSingle(text, lang, onEnd, onStart, rate, thisGeneration);
    }
  });
}

function speakSingle(
  text: string,
  lang: string,
  onEnd: () => void,
  onStart?: () => void,
  rate: number = 1.0,
  generation: number = 0
): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  const langCode = lang.split('-')[0];
  const voice = findVoice(langCode);
  if (voice) utterance.voice = voice;

  let started = false;
  let ended = false;

  utterance.onstart = () => {
    if (generation !== currentSpeechGeneration) return;
    if (!started) {
      started = true;
      onStart?.();
      startKeepAlive();
    }
  };

  utterance.onend = () => {
    if (ended) return;
    ended = true;
    stopKeepAlive();
    if (generation === currentSpeechGeneration) onEnd();
  };

  utterance.onerror = (e) => {
    if (ended) return;
    const err = e as SpeechSynthesisErrorEvent;
    if (err.error === 'canceled' || err.error === 'interrupted') {
      ended = true;
      stopKeepAlive();
      if (generation === currentSpeechGeneration) onEnd();
    } else {
      // Fall back to Google TTS
      console.warn('TTS: Web Speech error, falling back to Google TTS:', err.error);
      ended = true;
      stopKeepAlive();
      speakWithGoogleTTS(text, lang, onEnd, onStart, rate);
    }
  };

  synth.speak(utterance);
}

function speakInChunks(
  text: string,
  lang: string,
  onEnd: () => void,
  onStart?: () => void,
  rate: number = 1.0,
  generation: number = 0
): void {
  const chunks = splitTextIntoChunks(text, 180);
  let chunkIndex = 0;
  let started = false;
  let ended = false;

  function speakNext() {
    if (generation !== currentSpeechGeneration) return;
    if (chunkIndex >= chunks.length) {
      if (!ended) {
        ended = true;
        stopKeepAlive();
        onEnd();
      }
      return;
    }

    const chunk = chunks[chunkIndex];
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const langCode = lang.split('-')[0];
    const voice = findVoice(langCode);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      if (generation !== currentSpeechGeneration) return;
      if (!started) {
        started = true;
        onStart?.();
        startKeepAlive();
      }
    };

    utterance.onend = () => {
      if (generation !== currentSpeechGeneration) return;
      chunkIndex++;
      speakNext();
    };

    utterance.onerror = (e) => {
      if (ended) return;
      const err = e as SpeechSynthesisErrorEvent;
      if (err.error === 'canceled' || err.error === 'interrupted') {
        ended = true;
        stopKeepAlive();
        onEnd();
      } else {
        // Fall back to Google TTS for remaining text
        ended = true;
        stopKeepAlive();
        const remainingText = chunks.slice(chunkIndex).join(' ');
        speakWithGoogleTTS(remainingText || text, lang, onEnd, onStart, rate);
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  speakNext();
}

function findVoice(langCode: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const names = VOICE_NAMES[langCode] || [];
  for (const name of names) {
    const voice = voices.find(v => v.name.includes(name));
    if (voice) return voice;
  }

  const langVoice = voices.find(v => v.lang.startsWith(langCode));
  return langVoice || null;
}

function splitTextIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let current = '';

  const sentences = text.split(/([.!?。！？\n]+)/);

  for (const part of sentences) {
    if (current.length + part.length > maxLen && current.length > 0) {
      chunks.push(current);
      current = '';
    }
    current += part;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

// ============ HELPERS ============

function stopKeepAlive(): void {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function startKeepAlive(): void {
  stopKeepAlive();
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  keepAliveTimer = setInterval(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    } else {
      stopKeepAlive();
    }
  }, 5000);
}

function cancelAndWait(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve();
      return;
    }

    window.speechSynthesis.cancel();

    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      if (!window.speechSynthesis.speaking || attempts > 30) {
        clearInterval(check);
        resolve();
      }
    }, 10);
  });
}

function cleanupBlobUrls(): void {
  for (const url of activeBlobUrls) {
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }
  activeBlobUrls = [];
}

/**
 * ✅ Fetch audio from TTS proxy (Supabase Edge Function).
 * يمرر rate للـ proxy لتغيير سرعة الصوت.
 */
async function fetchTTSBlob(text: string, langCode: string, rate: number = 1.0): Promise<string | null> {
  const encodedText = encodeURIComponent(text);

  // ✅ استخدام Supabase Edge Function كـ proxy مع rate
  const proxyUrl = `${TTS_PROXY_URL}?text=${encodedText}&lang=${langCode}&rate=${rate}`;

  try {
    console.log('TTS: Fetching via proxy (rate=' + rate + ')...');
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'audio/mpeg',
      },
    });

    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 100) {
        const blobUrl = URL.createObjectURL(blob);
        activeBlobUrls.push(blobUrl);
        console.log('TTS: Audio fetched via proxy, size:', blob.size, 'rate:', rate);
        return blobUrl;
      }
    }
    console.warn('TTS: Proxy returned status:', response.status);
  } catch (err) {
    console.warn('TTS: Proxy fetch error:', err);
  }

  // Fallback: محاولة مباشرة (قد تعمل في بعض المتصفحات)
  console.log('TTS: Trying direct Google TTS...');
  const urls = [
    `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodedText}`,
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodedText}`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'audio/mpeg' },
      });
      if (response.ok) {
        const blob = await response.blob();
        if (blob.size > 100) {
          const blobUrl = URL.createObjectURL(blob);
          activeBlobUrls.push(blobUrl);
          console.log('TTS: Audio fetched directly, size:', blob.size);
          return blobUrl;
        }
      }
    } catch {
      // continue
    }
  }

  return null;
}

/**
 * ✅ Speak text using Google Translate TTS proxy.
 * يدعم rate parameter لتغيير سرعة الصوت.
 */
async function speakWithGoogleTTS(
  text: string,
  lang: string,
  onEnd: () => void,
  onStart?: () => void,
  rate: number = 1.0
): Promise<void> {
  const thisGeneration = currentSpeechGeneration;

  // Cancel any existing audio
  if (audioElement) {
    try {
      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement.src = '';
    } catch (_e) { /* ignore */ }
    audioElement = null;
  }
  cleanupBlobUrls();

  // Split text into chunks (Google TTS has ~200 char limit)
  const chunks = splitTextIntoChunks(text, 180);
  if (chunks.length === 0) {
    onEnd();
    return;
  }

  const langCode = GTTS_LANG_MAP[lang.split('-')[0]] || 'en';
  let chunkIndex = 0;
  let started = false;

  async function playNextChunk(): Promise<void> {
    if (thisGeneration !== currentSpeechGeneration) return;
    if (chunkIndex >= chunks.length) {
      audioElement = null;
      cleanupBlobUrls();
      if (thisGeneration === currentSpeechGeneration) {
        onEnd();
      }
      return;
    }

    const chunk = chunks[chunkIndex];

    // ✅ تمرير rate للـ proxy
    const blobUrl = await fetchTTSBlob(chunk, langCode, rate);

    if (thisGeneration !== currentSpeechGeneration) return;

    if (!blobUrl) {
      console.warn('TTS: All fetch attempts failed for chunk', chunkIndex);
      chunkIndex++;
      if (chunkIndex < chunks.length) {
        setTimeout(playNextChunk, 100);
      } else {
        audioElement = null;
        cleanupBlobUrls();
        onEnd();
      }
      return;
    }

    const isBlobUrl = blobUrl.startsWith('blob:');
    const audio = getPooledAudio();
    audio.src = blobUrl;
    audio.preload = 'auto';
    if (!isBlobUrl) {
      audio.crossOrigin = 'anonymous';
    }
    audioElement = audio;

    // ✅ تطبيق rate على عنصر الصوت (يتحكم في سرعة التشغيل)
    audio.playbackRate = rate;

    audio.onplaying = () => {
      if (thisGeneration !== currentSpeechGeneration) {
        audio.pause();
        return;
      }
      if (!started) {
        started = true;
        onStart?.();
        console.log('TTS: Audio started playing (rate:', rate + ')');
      }
    };

    const cleanupChunk = () => {
      if (isBlobUrl) {
        try {
          URL.revokeObjectURL(blobUrl);
          const idx = activeBlobUrls.indexOf(blobUrl);
          if (idx >= 0) activeBlobUrls.splice(idx, 1);
        } catch { /* ignore */ }
      }
    };

    audio.onended = () => {
      cleanupChunk();
      if (thisGeneration !== currentSpeechGeneration) return;
      chunkIndex++;
      playNextChunk();
    };

    audio.onerror = () => {
      console.warn('TTS: Audio playback error');
      cleanupChunk();
      if (thisGeneration !== currentSpeechGeneration) return;
      chunkIndex++;
      if (chunkIndex < chunks.length) {
        setTimeout(playNextChunk, 100);
      } else {
        audioElement = null;
        cleanupBlobUrls();
        onEnd();
      }
    };

    try {
      await audio.play();
    } catch (err) {
      console.warn('TTS: Audio play() failed:', err);
      cleanupChunk();
      if (thisGeneration !== currentSpeechGeneration) return;
      chunkIndex++;
      if (chunkIndex < chunks.length) {
        setTimeout(playNextChunk, 100);
      } else {
        audioElement = null;
        cleanupBlobUrls();
        onEnd();
      }
    }
  }

  playNextChunk();
}

// ============ SPEECH RECOGNITION (STT) ============

export function createSpeechRecognition(
  lang: string,
  onResult: (text: string, isFinal: boolean) => void,
  onError: (error: string) => void,
  onEnd: () => void
): SpeechRecognition | null {
  if (typeof window === 'undefined') return null;

  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionClass) return null;

  const recognition = new SpeechRecognitionClass();
  recognition.lang = SPEECH_LANGUAGES[lang] || lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      onResult(transcript, result.isFinal);
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    onError(event.error);
  };

  recognition.onend = () => {
    onEnd();
  };

  return recognition;
}

export function initVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      resolve([]);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve([]);
      }
    }, 3000);

    window.speechSynthesis.onvoiceschanged = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(window.speechSynthesis.getVoices());
      }
    };
  });
}
