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

// TTS language codes for Google Translate
const GTTS_LANG_MAP: Record<string, string> = {
  ar: 'ar',
  en: 'en',
  ja: 'ja',
};

// Voice names for TTS (Web Speech API)
const VOICE_NAMES: Record<string, string[]> = {
  ar: ['Arabic', 'arabic', 'Microsoft Naayf', 'Google العربية', 'Majed', 'Laila', 'Hoda'],
  en: ['Google US English', 'Microsoft David', 'Samantha', 'Alex', 'Daniel', 'Google UK English Male'],
  ja: ['Google 日本語', 'Kyoko', 'Otoya', 'Microsoft Haruka', 'Microsoft Ayumi'],
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

/**
 * Unlock audio playback on mobile WebView.
 * Must be called from a user gesture (touch/click).
 * Creates a silent AudioContext to bypass autoplay restrictions.
 */
export function unlockAudio(): void {
  if (audioUnlocked || typeof window === 'undefined') return;

  try {
    // Create and resume an AudioContext to unlock audio on mobile
    if (!audioContext) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
      }
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        audioUnlocked = true;
        console.log('TTS: Audio context unlocked');
      }).catch(() => {
        // Fallback: still try to play
        audioUnlocked = true;
      });
    } else if (audioContext) {
      audioUnlocked = true;
      console.log('TTS: Audio context already running');
    }

    // Also play a tiny silent audio to fully unlock the audio element
    const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    silentAudio.volume = 0.01;
    silentAudio.play().then(() => {
      audioUnlocked = true;
      console.log('TTS: Audio element unlocked via silent play');
      silentAudio.pause();
      silentAudio.src = '';
    }).catch(() => {
      // Still mark as attempted
      audioUnlocked = true;
    });
  } catch (_e) {
    audioUnlocked = true; // Don't keep trying
  }
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
      audioElement.src = '';
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
 */
function findVoice(langCode: string): SpeechSynthesisVoice | null {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  const preferredVoices = VOICE_NAMES[langCode] || [];

  for (const voiceName of preferredVoices) {
    const voice = voices.find(
      (v) =>
        v.name.toLowerCase().includes(voiceName.toLowerCase()) ||
        v.lang.toLowerCase().startsWith(langCode)
    );
    if (voice) return voice;
  }

  return voices.find((v) => v.lang.toLowerCase().startsWith(langCode)) || null;
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
 * Fetch audio from Google TTS as a blob, then play via local blob URL.
 * This bypasses CORS restrictions in Android WebView.
 */
async function fetchTTSBlob(text: string, langCode: string): Promise<string | null> {
  const encodedText = encodeURIComponent(text);

  // Try multiple Google TTS URL variants for maximum compatibility
  const urls = [
    `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=at&q=${encodedText}`,
    `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=ob&q=${encodedText}`,
    `https://translate.googleapis.com/g_tts?ie=UTF-8&tl=${langCode}&client=at&q=${encodedText}`,
  ];

  for (const url of urls) {
    try {
      console.log('TTS: Fetching audio from:', url.substring(0, 80) + '...');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'audio/mpeg,audio/mp3,*/*',
        },
      });

      if (!response.ok) {
        console.warn('TTS: Fetch failed with status:', response.status);
        continue;
      }

      const blob = await response.blob();
      if (blob.size < 100) {
        console.warn('TTS: Response too small, likely error:', blob.size);
        continue;
      }

      const blobUrl = URL.createObjectURL(blob);
      activeBlobUrls.push(blobUrl);
      console.log('TTS: Audio fetched successfully, size:', blob.size);
      return blobUrl;
    } catch (err) {
      console.warn('TTS: Fetch error for URL variant:', err);
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

    // Create audio element from blob URL (no CORS issues since it's a local blob)
    const audio = new Audio(blobUrl);
    audio.preload = 'auto';
    // NOTE: Do NOT set crossOrigin on blob URLs - it will cause CORS failures
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

    audio.onended = () => {
      if (thisGeneration !== currentSpeechGeneration) return;
      console.log('TTS: Audio chunk ended');
      chunkIndex++;
      // Clean up the blob URL after use
      try {
        URL.revokeObjectURL(blobUrl);
        const idx = activeBlobUrls.indexOf(blobUrl);
        if (idx !== -1) activeBlobUrls.splice(idx, 1);
      } catch (_e) { /* ignore */ }
      // Small gap between chunks
      setTimeout(playNextChunk, 150);
    };

    audio.onerror = (e) => {
      console.warn('TTS: Audio play error:', e);
      if (thisGeneration !== currentSpeechGeneration) return;
      // Clean up
      try {
        URL.revokeObjectURL(blobUrl);
        const idx = activeBlobUrls.indexOf(blobUrl);
        if (idx !== -1) activeBlobUrls.splice(idx, 1);
      } catch (_e) { /* ignore */ }
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
      // Clean up
      try {
        URL.revokeObjectURL(blobUrl);
        const idx = activeBlobUrls.indexOf(blobUrl);
        if (idx !== -1) activeBlobUrls.splice(idx, 1);
      } catch (_e) { /* ignore */ }
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
