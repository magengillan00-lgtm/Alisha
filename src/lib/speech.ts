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
  readonly length: number;
  readonly isFinal: boolean;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
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
}

export const AVAILABLE_VOICES: VoiceOption[] = [
  // العربية
  { id: 'ar-default', name: 'صوت عربي ١', gender: 'female', language: 'ar', description: 'صوت أنثوي طبيعي (Google TTS)' },
  { id: 'ar-fast', name: 'صوت عربي ٢ (سريع)', gender: 'female', language: 'ar', description: 'صوت أنثوي سريع' },
  // الإنجليزية
  { id: 'en-default', name: 'Voice 1 (Female)', gender: 'female', language: 'en', description: 'Natural female voice (Google TTS)' },
  { id: 'en-male', name: 'Voice 2 (Male)', gender: 'male', language: 'en', description: 'Male voice via Web Speech API' },
  { id: 'en-fast', name: 'Voice 3 (Fast)', gender: 'female', language: 'en', description: 'Fast female voice' },
  // اليابانية
  { id: 'ja-default', name: '日本語音声 1', gender: 'female', language: 'ja', description: '自然な女性の声 (Google TTS)' },
  { id: 'ja-fast', name: '日本語音声 2 (速い)', gender: 'female', language: 'ja', description: '速い女性の声' },
];

// ✅ الحصول على الأصوات المتاحة للغة معينة
export function getVoicesForLanguage(lang: string): VoiceOption[] {
  const langCode = lang.split('-')[0];
  return AVAILABLE_VOICES.filter(v => v.language === langCode);
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
 * Creates a silent AudioContext AND primes a reusable audio element to bypass autoplay restrictions.
 */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;

  try {
    // Create and resume an AudioContext to unlock audio on mobile
    if (!audioContext) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    // Play a tiny silent audio synchronously from the gesture stack to unlock the audio pipeline.
    // This is critical on Android WebView: play() must be triggered in the user gesture callstack.
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

    // Pre-create a pool of audio elements while in gesture context so they are trusted
    if (unlockedAudioPool.length === 0) {
      for (let i = 0; i < 3; i++) {
        const a = new Audio();
        a.preload = 'none';
        unlockedAudioPool.push(a);
      }
    }

    audioUnlocked = true;
  } catch (_e) {
    audioUnlocked = true; // Don't keep trying
  }
}

/**
 * Get a pre-unlocked audio element from the pool, or create a new one.
 */
function getPooledAudio(): HTMLAudioElement {
  if (unlockedAudioPool.length > 0) {
    return unlockedAudioPool.pop()!;
  }
  return new Audio();
}

/**
 * Return an audio element to the pool for reuse.
 */
function returnToPool(a: HTMLAudioElement): void {
  try {
    a.pause();
    a.src = '';
    a.load();
    if (unlockedAudioPool.length < 5) {
      unlockedAudioPool.push(a);
    }
  } catch (_e) { /* ignore */ }
}

/**
 * Test if Web Speech Synthesis actually produces audio.
 * On Android WebView, speechSynthesis exists but voices list is empty or speak() is silent.
 */
export async function testSpeechAPI(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis;

      // Wait for voices to load
      const voices = synth.getVoices();
      if (voices.length === 0) {
        // Wait for onvoiceschanged with timeout
        synth.onvoiceschanged = () => {
          const v = synth.getVoices();
          resolve(v.length > 0);
        };
        setTimeout(() => {
          const v = synth.getVoices();
          resolve(v.length > 0);
        }, 1500);
        return;
      }

      resolve(true);
    } catch (_e) {
      resolve(false);
    }
  });
}

/**
 * Initialize and determine which TTS method to use.
 */
export async function initTTS(): Promise<void> {
  if (speechAPITested) return;
  speechAPITested = true;

  const works = await testSpeechAPI();
  if (works) {
    speechAPIWorks = true;
    useWebSpeechAPI = true;
    console.log('TTS: Using Web Speech API');
  } else {
    speechAPIWorks = false;
    useWebSpeechAPI = false;
    console.log('TTS: Web Speech API unavailable, using Google Translate TTS');
  }
}

/**
 * Cancel all ongoing speech immediately.
 */
export function cancelSpeech(): void {
  stopKeepAlive();
  currentSpeechGeneration++; // Invalidate any pending callbacks

  if (typeof window === 'undefined') return;

  // Cancel Web Speech API
  try {
    window.speechSynthesis.cancel();
  } catch (_e) {
    // ignore
  }

  // Cancel audio element (Google TTS fallback)
  if (audioElement) {
    try {
      audioElement.pause();
      audioElement.currentTime = 0;
      returnToPool(audioElement);
    } catch (_e) {
      // ignore
    }
    audioElement = null;
  }

  // Clean up blob URLs
  cleanupBlobUrls();
}

/**
 * Clean up blob URLs to free memory.
 */
function cleanupBlobUrls(): void {
  for (const url of activeBlobUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch (_e) {
      // ignore
    }
  }
  activeBlobUrls = [];
}

/**
 * Warm up TTS - prepare for speaking.
 */
export function warmupSpeech(): void {
  if (typeof window === 'undefined') return;

  // Unlock audio on first interaction (critical for Android WebView)
  unlockAudio();

  try {
    window.speechSynthesis.cancel();
  } catch (_e) {
    // ignore
  }
}

// Keep-alive timer to prevent Chrome freeze bug (Chrome pauses TTS after ~15s)
function startKeepAlive(): void {
  stopKeepAlive();
  keepAliveTimer = setInterval(() => {
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis.speaking) {
        window.speechSynthesis.resume();
      }
    } catch (_e) {
      // ignore
    }
  }, 4000);
}

function stopKeepAlive(): void {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

/**
 * Find the best available voice for the given language code.
 * Tries preferred voice names first, then falls back to any voice matching the language.
 * Also handles the case where voices have different locale formats (e.g., ja vs ja-JP).
 */
function findVoice(langCode: string): SpeechSynthesisVoice | null {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  
  if (voices.length === 0) return null;
  
  const preferredVoices = VOICE_NAMES[langCode] || [];

  // First pass: try preferred voice names with exact match
  for (const voiceName of preferredVoices) {
    const voice = voices.find(
      (v) => v.name.toLowerCase().includes(voiceName.toLowerCase())
    );
    if (voice) return voice;
  }

  // Second pass: try any voice that matches the language code
  // Check both "ja" and "ja-JP" style matches
  const matchingVoices = voices.filter((v) => {
    const vLang = v.lang.toLowerCase();
    return vLang === langCode.toLowerCase() || 
           vLang.startsWith(langCode.toLowerCase() + '-') ||
           vLang.startsWith(langCode.toLowerCase() + '_');
  });
  
  if (matchingVoices.length > 0) {
    // Prefer non-remote voices (local voices work more reliably)
    const localVoice = matchingVoices.find(v => !v.localService || v.localService);
    return localVoice || matchingVoices[0];
  }

  return null;
}

// ============ MAIN TTS ENTRY POINT ============

/**
 * Speak text using available TTS method.
 * Automatically falls back to Google Translate TTS if Web Speech API doesn't work.
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

  if (useWebSpeechAPI) {
    speakWithWebSpeech(text, lang, onEnd, onStart, rate);
  } else {
    speakWithGoogleTTS(text, lang, onEnd, onStart);
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

  // Cancel and wait
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
      return;
    }
    // If Web Speech API fails, switch to Google TTS for this and future calls
    console.warn('Web Speech API error, switching to Google TTS:', err.error);
    useWebSpeechAPI = false;
    ended = true;
    stopKeepAlive();
    if (generation === currentSpeechGeneration) {
      speakWithGoogleTTS(text, lang, onEnd, onStart);
    }
  };

  try {
    synth.speak(utterance);

    // Retry if speech doesn't start
    setTimeout(() => {
      if (generation !== currentSpeechGeneration) return;
      if (!started && !ended) {
        console.log('Web Speech did not start, switching to Google TTS fallback');
        useWebSpeechAPI = false;
        ended = true;
        stopKeepAlive();
        if (generation === currentSpeechGeneration) {
          speakWithGoogleTTS(text, lang, onEnd, onStart);
        }
      }
    }, 2000);

    // Safety timeout
    setTimeout(() => {
      if (generation !== currentSpeechGeneration) return;
      if (!started && !ended) {
        console.warn('Web Speech timeout, using Google TTS');
        useWebSpeechAPI = false;
        ended = true;
        stopKeepAlive();
        if (generation === currentSpeechGeneration) {
          speakWithGoogleTTS(text, lang, onEnd, onStart);
        }
      }
    }, 4000);
  } catch (e) {
    console.error('Web Speech failed:', e);
    useWebSpeechAPI = false;
    if (generation === currentSpeechGeneration) {
      speakWithGoogleTTS(text, lang, onEnd, onStart);
    }
  }
}

function speakInChunks(
  text: string,
  lang: string,
  onEnd: () => void,
  onStart?: () => void,
  rate: number = 1.0,
  generation: number = 0
): void {
  if (typeof window === 'undefined') return;
  const synth = window.speechSynthesis;

  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]+/g) || [text];
  let currentIndex = 0;
  let started = false;
  let totalEnded = false;

  function speakNextChunk(): void {
    if (generation !== currentSpeechGeneration || totalEnded) return;

    if (currentIndex >= sentences.length) {
      totalEnded = true;
      stopKeepAlive();
      onEnd();
      return;
    }

    const chunk = sentences[currentIndex].trim();
    if (!chunk) {
      currentIndex++;
      speakNextChunk();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const langCode = lang.split('-')[0];
    const voice = findVoice(langCode);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      if (generation !== currentSpeechGeneration || totalEnded) return;
      if (!started) {
        started = true;
        onStart?.();
        startKeepAlive();
      }
    };

    utterance.onend = () => {
      if (generation !== currentSpeechGeneration || totalEnded) return;
      currentIndex++;
      try { synth.resume(); } catch (_e) { /* ignore */ }
      setTimeout(speakNextChunk, 80);
    };

    utterance.onerror = (e) => {
      if (generation !== currentSpeechGeneration || totalEnded) return;
      const err = e as SpeechSynthesisErrorEvent;
      if (err.error === 'canceled' || err.error === 'interrupted') {
        totalEnded = true;
        stopKeepAlive();
        onEnd();
        return;
      }
      // Switch to Google TTS on error
      console.warn('Chunk error, switching to Google TTS');
      useWebSpeechAPI = false;
      totalEnded = true;
      stopKeepAlive();
      const remainingText = sentences.slice(currentIndex).join('');
      if (generation === currentSpeechGeneration) {
        speakWithGoogleTTS(remainingText || text, lang, onEnd, onStart);
      }
    };

    try {
      synth.speak(utterance);
    } catch (e) {
      console.error('Chunk speak failed:', e);
      currentIndex++;
      setTimeout(speakNextChunk, 80);
    }
  }

  setTimeout(speakNextChunk, 100);
}

// ============ GOOGLE TRANSLATE TTS FALLBACK ============
// Uses Google Translate's text-to-speech endpoint.
// Audio is fetched as a blob to bypass CORS restrictions in Android WebView.
// No API key required. Free for moderate use.

function cancelAndWait(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(); return; }
    try { window.speechSynthesis.cancel(); } catch (_e) { /* ignore */ }
    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      try {
        if (!window.speechSynthesis.speaking || attempts > 30) {
          clearInterval(check);
          resolve();
        }
      } catch (_e) {
        clearInterval(check);
        resolve();
      }
    }, 10);
  });
}

/**
 * ✅ Fetch audio from TTS proxy (Supabase Edge Function).
 * هذا يتجاوز CORS تماماً لأن الـ proxy على نفس domain (supabase.co)
 */
async function fetchTTSBlob(text: string, langCode: string): Promise<string | null> {
  const encodedText = encodeURIComponent(text);

  // ✅ استخدام Supabase Edge Function كـ proxy (يتجاوز CORS)
  const proxyUrl = `${TTS_PROXY_URL}?text=${encodedText}&lang=${langCode}`;

  try {
    console.log('TTS: Fetching via proxy...');
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
        console.log('TTS: Audio fetched via proxy, size:', blob.size);
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
 * Speak text using Google Translate TTS (audio element fallback).
 * This works everywhere including Android WebView where Web Speech API doesn't.
 * Uses fetch+blob approach to bypass CORS restrictions.
 */
async function speakWithGoogleTTS(
  text: string,
  lang: string,
  onEnd: () => void,
  onStart?: () => void
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
  const chunks = splitTextForGoogleTTS(text, 180);
  if (chunks.length === 0) {
    onEnd();
    return;
  }

  const langCode = GTTS_LANG_MAP[lang.split('-')[0]] || 'en';
  let chunkIndex = 0;
  let started = false;

  async function playNextChunk(): Promise<void> {
    // Check if this generation is still valid
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

    // Fetch audio as blob to bypass CORS
    const blobUrl = await fetchTTSBlob(chunk, langCode);

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

    // Create audio element - use pooled (pre-unlocked) element when available
    const isBlobUrl = blobUrl.startsWith('blob:');
    const audio = getPooledAudio();
    audio.src = blobUrl;
    audio.preload = 'auto';
    // NOTE: Do NOT set crossOrigin on blob URLs - it will cause CORS failures
    // For direct URLs, crossOrigin may help with some WebView configurations
    if (!isBlobUrl) {
      audio.crossOrigin = 'anonymous';
    }
    audioElement = audio;

    audio.onplaying = () => {
      if (thisGeneration !== currentSpeechGeneration) {
        audio.pause();
        return;
      }
      if (!started) {
        started = true;
        onStart?.();
        console.log('TTS: Audio started playing');
      }
    };

    const cleanupChunk = () => {
      if (isBlobUrl) {
        try {
          URL.revokeObjectURL(blobUrl);
          const idx = activeBlobUrls.indexOf(blobUrl);
          if (idx !== -1) activeBlobUrls.splice(idx, 1);
        } catch (_e) { /* ignore */ }
      }
      returnToPool(audio);
    };

    audio.onended = () => {
      if (thisGeneration !== currentSpeechGeneration) return;
      console.log('TTS: Audio chunk ended');
      chunkIndex++;
      cleanupChunk();
      // Small gap between chunks
      setTimeout(playNextChunk, 150);
    };

    audio.onerror = (e) => {
      console.warn('TTS: Audio play error:', e);
      if (thisGeneration !== currentSpeechGeneration) return;
      cleanupChunk();
      // Try next chunk or end
      chunkIndex++;
      if (chunkIndex < chunks.length) {
        setTimeout(playNextChunk, 200);
      } else {
        audioElement = null;
        cleanupBlobUrls();
        onEnd();
      }
    };

    try {
      await audio.play();
      console.log('TTS: play() called successfully');
    } catch (err) {
      console.warn('TTS: play() failed:', err);
      if (thisGeneration !== currentSpeechGeneration) return;
      cleanupChunk();
      // Try next chunk
      chunkIndex++;
      if (chunkIndex < chunks.length) {
        setTimeout(playNextChunk, 200);
      } else {
        audioElement = null;
        cleanupBlobUrls();
        onEnd();
      }
    }
  }

  // Start playing first chunk
  playNextChunk();
}

/**
 * Split text into chunks suitable for Google TTS.
 * Respects sentence boundaries when possible.
 */
function splitTextForGoogleTTS(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  // Split by sentence terminators
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]+/g) || [text];

  let current = '';
  for (const sentence of sentences) {
    if ((current + sentence).length > maxLen) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // If any chunk is still too long, split by comma or space
  const finalChunks: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length <= maxLen) {
      finalChunks.push(chunk);
    } else {
      // Split by commas or spaces
      const parts = chunk.split(/[,،、;；]\s*/);
      let sub = '';
      for (const part of parts) {
        if ((sub + part).length > maxLen && sub) {
          finalChunks.push(sub.trim());
          sub = part;
        } else {
          sub += part;
        }
      }
      if (sub.trim()) finalChunks.push(sub.trim());
    }
  }

  return finalChunks.filter(c => c.length > 0);
}

// ============ SPEECH RECOGNITION ============

export function createSpeechRecognition(
  lang: string,
  onResult: (transcript: string, isFinal: boolean) => void,
  onError: (error: string) => void,
  onEnd: () => void
): SpeechRecognition | null {
  if (typeof window === 'undefined') return null;

  const SpeechRecognitionClass =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    console.error('Speech recognition not supported');
    return null;
  }

  const recognition = new SpeechRecognitionClass();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = lang;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    if (finalTranscript) {
      onResult(finalTranscript, true);
    } else if (interimTranscript) {
      onResult(interimTranscript, false);
    }
  };

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    console.error('Speech recognition error:', event.error);
    onError(event.error);
  };

  recognition.onend = () => {
    onEnd();
  };

  return recognition;
}

// ============ VOICE INITIALIZATION ============

export function initVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    synth.onvoiceschanged = () => {
      resolve(synth.getVoices());
    };
    setTimeout(() => {
      resolve(synth.getVoices());
    }, 1500);
  });
}

interface SpeechSynthesisErrorEvent {
  readonly error: string;
  readonly message?: string;
}
