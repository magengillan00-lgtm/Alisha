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

// Voice names for TTS
export const VOICE_NAMES: Record<string, string[]> = {
  ar: ['Arabic', 'arabic', 'Microsoft Naayf', 'Google العربية', 'Majed', 'Laila', 'Hoda'],
  en: ['Google US English', 'Microsoft David', 'Samantha', 'Alex', 'Daniel', 'Google UK English Male'],
  ja: ['Google 日本語', 'Kyoko', 'Otoya', 'Microsoft Haruka', 'Microsoft Ayumi'],
};

// ============ TTS STATE ============

let warmupDone = false;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let currentSpeechGeneration = 0; // Used to cancel stale speech

/**
 * Warm up the speech synthesis engine during a user gesture.
 * MUST be called before any async operation (API call) to keep TTS active on mobile Chrome.
 * Without this, speechSynthesis.speak() will silently fail after async operations on mobile.
 */
export function warmupSpeech(): void {
  if (typeof window === 'undefined') return;
  try {
    const synth = window.speechSynthesis;
    // Cancel any leftover speech
    synth.cancel();
    warmupDone = true;
  } catch (_e) {
    // ignore
  }
}

/**
 * Cancel all ongoing speech immediately.
 * Use this when user explicitly stops or starts a new recording.
 */
export function cancelSpeech(): void {
  stopKeepAlive();
  currentSpeechGeneration++; // Invalidate any pending callbacks
  if (typeof window !== 'undefined') {
    try {
      window.speechSynthesis.cancel();
    } catch (_e) {
      // ignore
    }
  }
}

// Keep-alive timer to prevent Chrome freeze bug on long text (Chrome pauses after ~15s)
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
 * Wait for speechSynthesis to finish canceling, then execute the callback.
 * More reliable than a fixed setTimeout.
 */
function cancelAndWait(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    const synth = window.speechSynthesis;
    try {
      synth.cancel();
    } catch (_e) {
      // ignore
    }

    // Poll until speaking is false (cancel completed)
    let attempts = 0;
    const check = setInterval(() => {
      attempts++;
      try {
        if (!synth.speaking || attempts > 30) {
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
 * Find the best available voice for the given language code.
 */
function findVoice(langCode: string): SpeechSynthesisVoice | null {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  const preferredVoices = VOICE_NAMES[langCode] || [];

  // First try preferred voices
  for (const voiceName of preferredVoices) {
    const voice = voices.find(
      (v) =>
        v.name.toLowerCase().includes(voiceName.toLowerCase()) ||
        v.lang.toLowerCase().startsWith(langCode)
    );
    if (voice) return voice;
  }

  // Fallback: find any voice matching the language prefix
  const fallbackVoice = voices.find((v) =>
    v.lang.toLowerCase().startsWith(langCode)
  );
  return fallbackVoice || null;
}

// ============ MAIN TTS FUNCTION ============

/**
 * Speak text using the browser's speech synthesis API.
 *
 * @param text - The text to speak
 * @param lang - Language code (e.g., 'ar-SA', 'en-US')
 * @param onEnd - Called when speech finishes (or fails)
 * @param onStart - Called when speech actually starts playing audio
 * @param rate - Speech rate (0.1 - 10, default 1.0)
 */
export function speakText(
  text: string,
  lang: string,
  onEnd: () => void,
  onStart?: () => void,
  rate: number = 1.0
): void {
  if (typeof window === 'undefined') {
    onEnd();
    return;
  }

  if (!text || !text.trim()) {
    onEnd();
    return;
  }

  // Increment generation to invalidate any stale callbacks
  const thisGeneration = ++currentSpeechGeneration;
  stopKeepAlive();

  // Cancel any ongoing speech, wait for it to finish, then start new speech
  cancelAndWait().then(() => {
    // If this generation was invalidated (user canceled), do nothing
    if (thisGeneration !== currentSpeechGeneration) return;

    if (text.length > 200) {
      speakInChunks(text, lang, onEnd, onStart, rate, thisGeneration);
    } else {
      speakSingle(text, lang, onEnd, onStart, rate, thisGeneration);
    }
  });
}

/**
 * Speak a single utterance (for short text <= 200 chars).
 */
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

  // Set voice
  const langCode = lang.split('-')[0];
  const voice = findVoice(langCode);
  if (voice) {
    utterance.voice = voice;
  }

  let started = false;
  let ended = false;

  utterance.onstart = () => {
    if (generation !== currentSpeechGeneration) return; // Stale
    if (!started) {
      started = true;
      onStart?.();
      startKeepAlive();
    }
  };

  utterance.onend = () => {
    if (ended) return; // Prevent double call
    ended = true;
    stopKeepAlive();
    if (generation === currentSpeechGeneration) {
      onEnd();
    }
  };

  utterance.onerror = (e) => {
    if (ended) return;
    const err = e as SpeechSynthesisErrorEvent;
    if (err.error === 'canceled' || err.error === 'interrupted') {
      // Speech was canceled - this is expected when user starts new action
      ended = true;
      stopKeepAlive();
      if (generation === currentSpeechGeneration) {
        onEnd();
      }
      return;
    }
    console.warn('Speech synthesis error:', err.error, err.message || '');
    ended = true;
    stopKeepAlive();
    if (generation === currentSpeechGeneration) {
      onEnd();
    }
  };

  try {
    synth.speak(utterance);

    // Retry mechanism: if speech doesn't start within 2 seconds, try again
    setTimeout(() => {
      if (generation !== currentSpeechGeneration) return;
      if (!started && !ended) {
        console.log('Speech did not start, retrying...');
        try {
          synth.cancel();
          setTimeout(() => {
            if (generation !== currentSpeechGeneration) return;
            if (!started && !ended) {
              synth.speak(utterance);
            }
          }, 100);
        } catch (_e) {
          // If retry fails, just end
          if (generation === currentSpeechGeneration) {
            onEnd();
          }
        }
      }
    }, 2000);

    // Safety timeout: if speech doesn't start within 5 seconds, force end
    setTimeout(() => {
      if (generation !== currentSpeechGeneration) return;
      if (!started && !ended) {
        console.warn('Speech synthesis timeout - could not start');
        ended = true;
        stopKeepAlive();
        onEnd();
      }
    }, 5000);
  } catch (e) {
    console.error('Failed to speak:', e);
    onEnd();
  }
}

/**
 * Speak long text in chunks to avoid Chrome freezing bug (Chrome pauses TTS after ~15s).
 */
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

  // Split by sentence terminators
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]+/g) || [text];
  let currentIndex = 0;
  let started = false;
  let totalEnded = false;

  function speakNextChunk(): void {
    // Check if this generation is still valid
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

    // Set voice
    const langCode = lang.split('-')[0];
    const voice = findVoice(langCode);
    if (voice) {
      utterance.voice = voice;
    }

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
      // Chrome bug fix: resume after each chunk to prevent freeze
      try {
        synth.resume();
      } catch (_e) {
        // ignore
      }
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
      console.warn('Speech chunk error:', err.error);
      currentIndex++;
      setTimeout(speakNextChunk, 80);
    };

    try {
      synth.speak(utterance);
    } catch (e) {
      console.error('Failed to speak chunk:', e);
      currentIndex++;
      setTimeout(speakNextChunk, 80);
    }
  }

  // Start first chunk after a small delay
  setTimeout(speakNextChunk, 100);
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

// Initialize voices (some browsers load them asynchronously)
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
    // Timeout fallback
    setTimeout(() => {
      resolve(synth.getVoices());
    }, 1000);
  });
}

interface SpeechSynthesisErrorEvent {
  readonly error: string;
  readonly message?: string;
}
