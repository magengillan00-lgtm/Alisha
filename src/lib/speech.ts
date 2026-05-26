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
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  onspeechend: (() => void) | null;
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
  ar: ['Arabic', 'arabic', 'Microsoft Naayf', 'Google \u0627\u0644\u0639\u0631\u0628\u064a\u0629', 'Majed', 'Laila', 'Hoda', 'Maged'],
  en: ['Google US English', 'Microsoft David', 'Samantha', 'Alex', 'Daniel', 'Google UK English Male'],
  ja: ['Google \u65e5\u672c\u8a9e', 'Kyoko', 'Otoya', 'Microsoft Haruka', 'Microsoft Ayumi'],
};

// ============ PLATFORM DETECTION ============

let isAndroidWebView = false;
let isIOSWebView = false;
let isMobile = false;

function detectPlatform(): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

  const ua = navigator.userAgent || '';
  isAndroidWebView = /Android/.test(ua) && /wv|Capacitor/.test(ua);
  isIOSWebView = /iPhone|iPad|iPod/.test(ua) && /wv|Capacitor/.test(ua);
  isMobile = /Android|iPhone|iPad|iPod|Mobile/.test(ua);

  console.log('[TTS] Platform detected - Android WV:', isAndroidWebView, 'iOS WV:', isIOSWebView, 'Mobile:', isMobile);
}

// Detect platform on load
detectPlatform();

// ============ TTS STATE ============

let currentSpeechGeneration = 0;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
let audioElement: HTMLAudioElement | null = null;

// TTS method priority: 'webspeech' | 'direct-audio' | 'fetch-audio'
let ttsMethod: 'webspeech' | 'direct-audio' | 'fetch-audio' | 'untested' = 'untested';
let speechAPITested = false;

// Audio context for unlocking autoplay on mobile
let audioContext: AudioContext | null = null;
let audioUnlocked = false;

// Blob URLs to clean up
let activeBlobUrls: string[] = [];

// Track if we're currently speaking
let isCurrentlySpeaking = false;

/**
 * Check if TTS is currently speaking
 */
export function isSpeaking(): boolean {
  return isCurrentlySpeaking;
}

/**
 * Unlock audio playback on mobile WebView.
 * Must be called from a user gesture (touch/click).
 * Creates a silent AudioContext to bypass autoplay restrictions.
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
      audioContext.resume().then(() => {
        audioUnlocked = true;
        console.log('[TTS] Audio context unlocked');
      }).catch(() => {
        audioUnlocked = true;
      });
    } else if (audioContext) {
      audioUnlocked = true;
      console.log('[TTS] Audio context already running');
    }

    // Also play a tiny silent audio to fully unlock the audio element
    const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    silentAudio.volume = 0.01;
    const playPromise = silentAudio.play();
    if (playPromise) {
      playPromise.then(() => {
        audioUnlocked = true;
        console.log('[TTS] Audio element unlocked via silent play');
        silentAudio.pause();
        silentAudio.src = '';
      }).catch(() => {
        audioUnlocked = true;
      });
    }
  } catch (_e) {
    audioUnlocked = true;
  }
}

/**
 * Test if Web Speech Synthesis actually produces audio.
 * On Android WebView, speechSynthesis may exist but be silent.
 * We test by attempting to speak and checking if onstart fires.
 */
export async function testSpeechAPI(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;

    // Wait for voices to load
    let voices = synth.getVoices();
    if (voices.length === 0) {
      await new Promise<void>((resolve) => {
        synth.onvoiceschanged = () => {
          voices = synth.getVoices();
          resolve();
        };
        setTimeout(resolve, 2000);
      });
      voices = synth.getVoices();
    }

    // Even on Android WebView, try to actually speak and test
    // The key test: does onstart fire?
    return new Promise((resolve) => {
      // Cancel any ongoing speech first
      synth.cancel();

      const testUtterance = new SpeechSynthesisUtterance('\u0645\u0631\u062d\u0628\u0627'); // "مرحبا"
      testUtterance.lang = 'ar-SA';
      testUtterance.volume = 0.01; // Very quiet test
      testUtterance.rate = 3; // Fast

      let resolved = false;

      testUtterance.onstart = () => {
        if (!resolved) {
          resolved = true;
          synth.cancel(); // Stop the test speech
          console.log('[TTS] Web Speech API WORKS - onstart fired');
          resolve(true);
        }
      };

      testUtterance.onerror = (e) => {
        if (!resolved) {
          resolved = true;
          const err = e as SpeechSynthesisErrorEvent;
          console.log('[TTS] Web Speech API error:', err.error);
          // "canceled" is expected since we cancel after onstart
          if (err.error === 'canceled') {
            resolve(true); // It started, we canceled it
          } else {
            resolve(false);
          }
        }
      };

      try {
        synth.speak(testUtterance);
      } catch (_e) {
        resolve(false);
        return;
      }

      // Timeout: if onstart doesn't fire within 3 seconds, assume it doesn't work
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          synth.cancel();
          console.log('[TTS] Web Speech API test timed out - likely not working');
          resolve(false);
        }
      }, 3000);
    });
  } catch (_e) {
    return false;
  }
}

/**
 * Test if direct audio element playback works (for Google TTS).
 * This bypasses CORS because <audio> elements can load cross-origin resources.
 */
async function testDirectAudioPlayback(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const testAudio = new Audio();
      testAudio.volume = 0.01;
      // DO NOT set crossOrigin - Google TTS doesn't support CORS
      let resolved = false;

      testAudio.oncanplaythrough = () => {
        if (!resolved) {
          resolved = true;
          testAudio.src = '';
          console.log('[TTS] Direct audio playback WORKS');
          resolve(true);
        }
      };

      testAudio.oncanplay = () => {
        if (!resolved && testAudio.readyState >= 3) {
          resolved = true;
          testAudio.src = '';
          console.log('[TTS] Direct audio playback WORKS (canplay)');
          resolve(true);
        }
      };

      testAudio.onerror = () => {
        if (!resolved) {
          resolved = true;
          console.log('[TTS] Direct audio playback test failed');
          resolve(false);
        }
      };

      // Use a very short Google TTS URL for testing
      testAudio.src = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=hi';
      testAudio.preload = 'auto';

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          testAudio.src = '';
          console.log('[TTS] Direct audio playback test timed out');
          resolve(false);
        }
      }, 8000);
    } catch (_e) {
      resolve(false);
    }
  });
}

/**
 * Initialize and determine which TTS method to use.
 * On Android WebView: Direct Audio first (Web Speech API is unreliable)
 * On browsers: Web Speech API > Direct Audio > Fetch Audio
 */
export async function initTTS(): Promise<void> {
  if (speechAPITested) return;
  speechAPITested = true;

  console.log('[TTS] Initializing TTS system...');
  console.log('[TTS] Platform: Android WV:', isAndroidWebView, 'iOS WV:', isIOSWebView, 'Mobile:', isMobile);

  // Make sure audio is unlocked first
  unlockAudio();

  // On Android WebView, Web Speech API is unreliable (may exist but produce no audio)
  // Try Direct Audio first for better reliability
  if (isAndroidWebView || isMobile) {
    console.log('[TTS] Mobile/WebView detected - trying Direct Audio first');
    const directAudioWorks = await testDirectAudioPlayback();
    if (directAudioWorks) {
      ttsMethod = 'direct-audio';
      console.log('[TTS] Selected method: Direct Audio (Google TTS via <audio>)');
      return;
    }

    // Try Web Speech API as fallback
    const webSpeechWorks = await testSpeechAPI();
    if (webSpeechWorks) {
      ttsMethod = 'webspeech';
      console.log('[TTS] Selected method: Web Speech API (fallback)');
      return;
    }

    // Last resort
    ttsMethod = 'direct-audio'; // Still try direct-audio at runtime even if test failed
    console.log('[TTS] Will try Direct Audio at runtime (test failed but may work with real text)');
    return;
  }

  // Desktop browser: Web Speech API first
  const webSpeechWorks = await testSpeechAPI();
  if (webSpeechWorks) {
    ttsMethod = 'webspeech';
    console.log('[TTS] Selected method: Web Speech API');
    return;
  }

  // Step 2: Try direct audio playback (Google TTS via <audio> element)
  const directAudioWorks = await testDirectAudioPlayback();
  if (directAudioWorks) {
    ttsMethod = 'direct-audio';
    console.log('[TTS] Selected method: Direct Audio (Google TTS via <audio>)');
    return;
  }

  // Step 3: Fall back to direct-audio at runtime even if test failed
  ttsMethod = 'direct-audio';
  console.log('[TTS] Will try Direct Audio at runtime (all tests failed)');
}

/**
 * Cancel all ongoing speech immediately.
 */
export function cancelSpeech(): void {
  stopKeepAlive();
  currentSpeechGeneration++; // Invalidate any pending callbacks
  isCurrentlySpeaking = false;

  if (typeof window === 'undefined') return;

  // Cancel Web Speech API
  try {
    window.speechSynthesis.cancel();
  } catch (_e) {
    // ignore
  }

  // Cancel audio element
  if (audioElement) {
    try {
      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement.src = '';
      audioElement.removeAttribute('src');
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
 * Automatically falls back through methods: Web Speech > Direct Audio > Fetch Audio
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

  // Clean up text for TTS - remove markdown and special characters
  const cleanText = text
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/#{1,6}\s/g, '') // Remove headers
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`(.*?)`/g, '$1') // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
    .replace(/[-\u2022*]\s/g, '') // Remove list markers
    .replace(/\d+\.\s/g, '') // Remove numbered lists
    .trim();

  if (!cleanText) {
    onEnd();
    return;
  }

  // Make sure TTS is initialized
  if (!speechAPITested) {
    await initTTS();
  }

  // Make sure audio is unlocked
  if (!audioUnlocked) {
    unlockAudio();
  }

  isCurrentlySpeaking = true;

  console.log('[TTS] Speaking with method:', ttsMethod, 'text length:', cleanText.length);

  switch (ttsMethod) {
    case 'webspeech':
      speakWithWebSpeech(cleanText, lang, onEnd, onStart, rate);
      break;
    case 'direct-audio':
      speakWithDirectAudio(cleanText, lang, onEnd, onStart);
      break;
    case 'fetch-audio':
      speakWithGoogleTTS(cleanText, lang, onEnd, onStart);
      break;
    default:
      // If untested, try direct audio first on mobile, webspeech on desktop
      if (isMobile || isAndroidWebView) {
        speakWithDirectAudio(cleanText, lang, onEnd, onStart);
      } else {
        speakWithFallbackChain(cleanText, lang, onEnd, onStart, rate);
      }
      break;
  }
}

// ============ FALLBACK CHAIN ============

/**
 * Try all TTS methods in order until one works.
 */
function speakWithFallbackChain(
  text: string,
  lang: string,
  onEnd: () => void,
  onStart?: () => void,
  rate: number = 1.0
): void {
  const thisGeneration = ++currentSpeechGeneration;
  let methodIndex = 0;
  const methods: Array<() => void> = [
    // Method 1: Web Speech API
    () => {
      console.log('[TTS] Fallback chain: trying Web Speech API...');
      speakWithWebSpeech(
        text, lang,
        () => {
          if (thisGeneration === currentSpeechGeneration) onEnd();
        },
        () => {
          ttsMethod = 'webspeech';
          if (onStart) onStart();
        },
        rate,
      );
    },
    // Method 2: Direct Audio (Google TTS via <audio>)
    () => {
      console.log('[TTS] Fallback chain: trying Direct Audio...');
      speakWithDirectAudio(
        text, lang,
        () => {
          if (thisGeneration === currentSpeechGeneration) onEnd();
        },
        () => {
          ttsMethod = 'direct-audio';
          if (onStart) onStart();
        },
      );
    },
    // Method 3: Fetch Audio (Google TTS via fetch+blob)
    () => {
      console.log('[TTS] Fallback chain: trying Fetch Audio...');
      speakWithGoogleTTS(
        text, lang,
        () => {
          if (thisGeneration === currentSpeechGeneration) onEnd();
        },
        () => {
          ttsMethod = 'fetch-audio';
          if (onStart) onStart();
        },
      );
    },
  ];

  // Try Web Speech first
  methods[methodIndex]();

  // If it doesn't start within 3 seconds, try next method
  // This is handled by the individual speak functions' timeout logic
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
    isCurrentlySpeaking = false;
    if (generation === currentSpeechGeneration) onEnd();
  };

  utterance.onerror = (e) => {
    if (ended) return;
    const err = e as SpeechSynthesisErrorEvent;
    if (err.error === 'canceled' || err.error === 'interrupted') {
      ended = true;
      stopKeepAlive();
      isCurrentlySpeaking = false;
      if (generation === currentSpeechGeneration) onEnd();
      return;
    }
    console.warn('[TTS] Web Speech API error, falling back to Direct Audio:', err.error);
    ended = true;
    stopKeepAlive();
    if (generation === currentSpeechGeneration) {
      // Try next method
      speakWithDirectAudio(text, lang, onEnd, onStart);
    }
  };

  try {
    synth.speak(utterance);

    // Retry with next method if speech doesn't start within 3 seconds
    setTimeout(() => {
      if (generation !== currentSpeechGeneration) return;
      if (!started && !ended) {
        console.log('[TTS] Web Speech did not start in 3s, falling back to Direct Audio');
        ttsMethod = 'direct-audio';
        ended = true;
        stopKeepAlive();
        synth.cancel();
        if (generation === currentSpeechGeneration) {
          speakWithDirectAudio(text, lang, onEnd, onStart);
        }
      }
    }, 3000);
  } catch (e) {
    console.error('[TTS] Web Speech failed:', e);
    if (generation === currentSpeechGeneration) {
      speakWithDirectAudio(text, lang, onEnd, onStart);
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

  const sentences = text.match(/[^.!?。\uff01\uff1f\n]+[.!?。\uff01\uff1f\n]+/g) || [text];
  let currentIndex = 0;
  let started = false;
  let totalEnded = false;

  function speakNextChunk(): void {
    if (generation !== currentSpeechGeneration || totalEnded) return;

    if (currentIndex >= sentences.length) {
      totalEnded = true;
      stopKeepAlive();
      isCurrentlySpeaking = false;
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
        isCurrentlySpeaking = false;
        onEnd();
        return;
      }
      console.warn('[TTS] Chunk error, falling back to Direct Audio');
      totalEnded = true;
      stopKeepAlive();
      const remainingText = sentences.slice(currentIndex).join('');
      if (generation === currentSpeechGeneration) {
        speakWithDirectAudio(remainingText || text, lang, onEnd, onStart);
      }
    };

    try {
      synth.speak(utterance);
    } catch (e) {
      console.error('[TTS] Chunk speak failed:', e);
      currentIndex++;
      setTimeout(speakNextChunk, 80);
    }
  }

  setTimeout(speakNextChunk, 100);
}

// ============ DIRECT AUDIO TTS (Google TTS via <audio> element) ============

/**
 * Speak text using Google Translate TTS via direct <audio> element.
 * This BYPASSES CORS because <audio> elements can load cross-origin audio
 * without requiring CORS headers (unlike fetch/XMLHttpRequest).
 *
 * This is the PRIMARY fallback for Android WebView where Web Speech API doesn't work.
 */
async function speakWithDirectAudio(
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
    isCurrentlySpeaking = false;
    onEnd();
    return;
  }

  const langCode = GTTS_LANG_MAP[lang.split('-')[0]] || 'en';
  let chunkIndex = 0;
  let started = false;
  let failedChunks = 0;

  async function playNextChunk(): Promise<void> {
    // Check if this generation is still valid
    if (thisGeneration !== currentSpeechGeneration) {
      isCurrentlySpeaking = false;
      return;
    }
    if (chunkIndex >= chunks.length) {
      audioElement = null;
      cleanupBlobUrls();
      isCurrentlySpeaking = false;
      if (thisGeneration === currentSpeechGeneration) {
        onEnd();
      }
      return;
    }

    const chunk = chunks[chunkIndex];
    const encodedText = encodeURIComponent(chunk);

    // Try multiple Google TTS URL variants for maximum compatibility
    const urls = [
      `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodedText}`,
      `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=at&q=${encodedText}`,
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodedText}`,
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${langCode}&client=dict-chrome-ex&q=${encodedText}`,
    ];

    let audioPlayed = false;

    for (const url of urls) {
      if (thisGeneration !== currentSpeechGeneration) {
        isCurrentlySpeaking = false;
        return;
      }

      try {
        console.log('[TTS] Direct audio: trying URL variant', urls.indexOf(url) + 1);

        // Create audio element directly with the URL
        // This bypasses CORS because <audio> elements can load cross-origin resources
        const audio = new Audio();
        audio.preload = 'auto';
        audio.volume = 1.0;
        // DO NOT set crossOrigin - Google TTS doesn't send CORS headers,
        // and <audio> elements can load cross-origin audio WITHOUT CORS when crossOrigin is not set.
        // Setting crossOrigin = 'anonymous' would BLOCK the audio from loading.
        audio.src = url;
        audioElement = audio;

        const playResult = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => {
            console.log('[TTS] Direct audio: timeout for this URL variant');
            resolve(false);
          }, 10000); // 10 second timeout per chunk

          // Try playing as soon as we have enough data
          const tryPlay = () => {
            audio.play().then(() => {
              clearTimeout(timeout);
              resolve(true);
            }).catch((err) => {
              console.warn('[TTS] Direct audio: play() failed:', err);
              // Don't give up yet - wait for more data
            });
          };

          audio.oncanplaythrough = () => {
            tryPlay();
          };

          // Also try on canplay (fires earlier than canplaythrough)
          audio.oncanplay = () => {
            if (audio.readyState >= 3) {
              tryPlay();
            }
          };

          audio.onplaying = () => {
            if (thisGeneration !== currentSpeechGeneration) {
              audio.pause();
              clearTimeout(timeout);
              resolve(false);
              return;
            }
            if (!started) {
              started = true;
              onStart?.();
              console.log('[TTS] Direct audio: started playing');
            }
          };

          audio.onerror = () => {
            console.warn('[TTS] Direct audio: error loading URL');
            clearTimeout(timeout);
            resolve(false);
          };

          audio.onended = () => {
            clearTimeout(timeout);
            resolve(true);
          };

          // Start loading
          audio.load();
        });

        if (playResult) {
          audioPlayed = true;
          // Wait for the audio to actually end
          await new Promise<void>((resolve) => {
            if (audio.ended) {
              resolve();
              return;
            }
            audio.onended = () => resolve();
            // Safety timeout
            setTimeout(() => {
              try { audio.pause(); } catch (_e) { /* ignore */ }
              resolve();
            }, 15000);
          });

          console.log('[TTS] Direct audio: chunk played successfully');
          break; // This URL worked, don't try others
        } else {
          // This URL didn't work, try next
          try { audio.pause(); audio.src = ''; } catch (_e) { /* ignore */ }
        }
      } catch (err) {
        console.warn('[TTS] Direct audio: error with URL variant:', err);
      }
    }

    if (!audioPlayed) {
      failedChunks++;
      console.warn('[TTS] Direct audio: all URL variants failed for chunk', chunkIndex);

      // If too many chunks fail, fall back to fetch method
      if (failedChunks >= 2) {
        console.log('[TTS] Direct audio: too many failures, falling back to Fetch Audio');
        ttsMethod = 'fetch-audio';
        const remainingText = chunks.slice(chunkIndex).join('. ');
        if (thisGeneration === currentSpeechGeneration) {
          speakWithGoogleTTS(remainingText || text, lang, onEnd, onStart);
        }
        return;
      }
    }

    chunkIndex++;
    // Small gap between chunks
    setTimeout(playNextChunk, 100);
  }

  // Start playing first chunk
  playNextChunk();
}

// ============ GOOGLE TRANSLATE TTS FALLBACK (Fetch + Blob) ============

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
 * This is the LAST RESORT fallback - used when both Web Speech and Direct Audio fail.
 */
async function fetchTTSBlob(text: string, langCode: string): Promise<string | null> {
  const encodedText = encodeURIComponent(text);

  // Try multiple Google TTS URL variants for maximum compatibility
  const urls = [
    `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodedText}`,
    `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=at&q=${encodedText}`,
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodedText}`,
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${langCode}&client=dict-chrome-ex&q=${encodedText}`,
  ];

  for (const url of urls) {
    try {
      console.log('[TTS] Fetch audio: trying URL:', url.substring(0, 80) + '...');
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'audio/mpeg,audio/mp3,*/*',
        },
      });

      if (!response.ok) {
        console.warn('[TTS] Fetch failed with status:', response.status);
        continue;
      }

      const blob = await response.blob();
      if (blob.size < 100) {
        console.warn('[TTS] Response too small, likely error:', blob.size);
        continue;
      }

      const blobUrl = URL.createObjectURL(blob);
      activeBlobUrls.push(blobUrl);
      console.log('[TTS] Audio fetched successfully, size:', blob.size);
      return blobUrl;
    } catch (err) {
      console.warn('[TTS] Fetch error for URL variant:', err);
    }
  }

  return null;
}

/**
 * Speak text using Google Translate TTS (fetch+blob fallback).
 * This is the LAST RESORT method.
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
    isCurrentlySpeaking = false;
    onEnd();
    return;
  }

  const langCode = GTTS_LANG_MAP[lang.split('-')[0]] || 'en';
  let chunkIndex = 0;
  let started = false;

  async function playNextChunk(): Promise<void> {
    // Check if this generation is still valid
    if (thisGeneration !== currentSpeechGeneration) {
      isCurrentlySpeaking = false;
      return;
    }
    if (chunkIndex >= chunks.length) {
      audioElement = null;
      cleanupBlobUrls();
      isCurrentlySpeaking = false;
      if (thisGeneration === currentSpeechGeneration) {
        onEnd();
      }
      return;
    }

    const chunk = chunks[chunkIndex];

    // Fetch audio as blob to bypass CORS
    const blobUrl = await fetchTTSBlob(chunk, langCode);

    if (thisGeneration !== currentSpeechGeneration) {
      isCurrentlySpeaking = false;
      return;
    }

    if (!blobUrl) {
      console.warn('[TTS] All fetch attempts failed for chunk', chunkIndex);
      chunkIndex++;
      if (chunkIndex < chunks.length) {
        setTimeout(playNextChunk, 100);
      } else {
        audioElement = null;
        cleanupBlobUrls();
        isCurrentlySpeaking = false;
        onEnd();
      }
      return;
    }

    // Create audio element
    const audio = new Audio(blobUrl);
    audio.preload = 'auto';
    audio.volume = 1.0;
    audioElement = audio;

    audio.onplaying = () => {
      if (thisGeneration !== currentSpeechGeneration) {
        audio.pause();
        return;
      }
      if (!started) {
        started = true;
        onStart?.();
        console.log('[TTS] Fetch audio: started playing');
      }
    };

    audio.onended = () => {
      if (thisGeneration !== currentSpeechGeneration) return;
      console.log('[TTS] Fetch audio: chunk ended');
      chunkIndex++;
      // Clean up the blob URL after use
      try {
        URL.revokeObjectURL(blobUrl);
        const idx = activeBlobUrls.indexOf(blobUrl);
        if (idx !== -1) activeBlobUrls.splice(idx, 1);
      } catch (_e) { /* ignore */ }
      // Small gap between chunks
      setTimeout(playNextChunk, 100);
    };

    audio.onerror = (e) => {
      console.warn('[TTS] Fetch audio: play error:', e);
      if (thisGeneration !== currentSpeechGeneration) return;
      try {
        URL.revokeObjectURL(blobUrl);
        const idx = activeBlobUrls.indexOf(blobUrl);
        if (idx !== -1) activeBlobUrls.splice(idx, 1);
      } catch (_e) { /* ignore */ }
      chunkIndex++;
      if (chunkIndex < chunks.length) {
        setTimeout(playNextChunk, 200);
      } else {
        audioElement = null;
        cleanupBlobUrls();
        isCurrentlySpeaking = false;
        onEnd();
      }
    };

    try {
      await audio.play();
      console.log('[TTS] Fetch audio: play() called successfully');
    } catch (err) {
      console.warn('[TTS] Fetch audio: play() failed:', err);
      if (thisGeneration !== currentSpeechGeneration) return;
      try {
        URL.revokeObjectURL(blobUrl);
        const idx = activeBlobUrls.indexOf(blobUrl);
        if (idx !== -1) activeBlobUrls.splice(idx, 1);
      } catch (_e) { /* ignore */ }
      chunkIndex++;
      if (chunkIndex < chunks.length) {
        setTimeout(playNextChunk, 200);
      } else {
        audioElement = null;
        cleanupBlobUrls();
        isCurrentlySpeaking = false;
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
  const sentences = text.match(/[^.!?。\uff01\uff1f\n]+[.!?。\uff01\uff1f\n]+/g) || [text];

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
      const parts = chunk.split(/[,,\u3001;；]\s*/);
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

/**
 * Create a speech recognition instance for voice input.
 * Uses continuous mode so recording keeps going until manually stopped.
 */
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
    console.error('[STT] Speech recognition not supported');
    return null;
  }

  const recognition = new SpeechRecognitionClass();
  recognition.continuous = true; // Keep listening until explicitly stopped
  recognition.interimResults = true;
  recognition.lang = lang;
  recognition.maxAlternatives = 1;

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
    console.error('[STT] Speech recognition error:', event.error);
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

// ============ PERMISSION HELPER ============

/**
 * Request microphone permission. Returns true if granted.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      console.warn('[Perm] MediaDevices API not available');
      return false;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Stop all tracks immediately - we just needed the permission
    stream.getTracks().forEach(track => track.stop());
    console.log('[Perm] Microphone permission granted');
    return true;
  } catch (err) {
    console.error('[Perm] Microphone permission denied:', err);
    return false;
  }
}
