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

export function speakText(
  text: string,
  lang: string,
  onEnd: () => void,
  onStart?: () => void,
  rate: number = 1.0
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined') return null;

  const synth = window.speechSynthesis;

  // Chrome bug fix: cancel then wait a tick before speaking
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to find a voice matching the language
  const voices = synth.getVoices();
  const langCode = lang.split('-')[0];
  const preferredVoices = VOICE_NAMES[langCode] || [];

  // First try preferred voices
  for (const voiceName of preferredVoices) {
    const voice = voices.find(
      (v) =>
        v.name.toLowerCase().includes(voiceName.toLowerCase()) ||
        v.lang.toLowerCase().startsWith(langCode)
    );
    if (voice) {
      utterance.voice = voice;
      break;
    }
  }

  // Fallback: find any voice matching the language
  if (!utterance.voice) {
    const fallbackVoice = voices.find((v) =>
      v.lang.toLowerCase().startsWith(langCode)
    );
    if (fallbackVoice) {
      utterance.voice = fallbackVoice;
    }
  }

  utterance.onstart = () => {
    onStart?.();
  };

  utterance.onend = () => {
    onEnd();
  };

  utterance.onerror = (e) => {
    // "interrupted" or "canceled" errors are expected when we call synth.cancel()
    const err = e as SpeechSynthesisErrorEvent;
    if (err.error !== 'canceled' && err.error !== 'interrupted') {
      console.warn('Speech synthesis warning:', err.error);
    }
    // Always call onEnd so the UI returns to idle state
    onEnd();
  };

  // Chrome bug: speechSynthesis can freeze if not resumed periodically on long text
  // Split text into chunks if too long
  if (text.length > 200) {
    speakInChunks(text, lang, onEnd, onStart, rate);
    return utterance;
  }

  // Small timeout to avoid Chrome bug where cancel + speak in same frame fails
  setTimeout(() => {
    synth.speak(utterance);
  }, 50);

  return utterance;
}

// Speak long text in chunks to avoid Chrome freezing
function speakInChunks(
  text: string,
  lang: string,
  onEnd: () => void,
  onStart?: () => void,
  rate: number = 1.0
) {
  const synth = window.speechSynthesis;

  // Split by sentences
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]+/g) || [text];
  let currentIndex = 0;
  let started = false;

  function speakNext() {
    if (currentIndex >= sentences.length) {
      onEnd();
      return;
    }

    const chunk = sentences[currentIndex].trim();
    if (!chunk) {
      currentIndex++;
      speakNext();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = synth.getVoices();
    const langCode = lang.split('-')[0];
    const preferredVoices = VOICE_NAMES[langCode] || [];

    for (const voiceName of preferredVoices) {
      const voice = voices.find(
        (v) =>
          v.name.toLowerCase().includes(voiceName.toLowerCase()) ||
          v.lang.toLowerCase().startsWith(langCode)
      );
      if (voice) {
        utterance.voice = voice;
        break;
      }
    }

    if (!utterance.voice) {
      const fallbackVoice = voices.find((v) =>
        v.lang.toLowerCase().startsWith(langCode)
      );
      if (fallbackVoice) {
        utterance.voice = fallbackVoice;
      }
    }

    utterance.onstart = () => {
      if (!started) {
        started = true;
        onStart?.();
      }
    };

    utterance.onend = () => {
      currentIndex++;
      // Chrome bug fix: resume after pause to prevent freeze
      synth.resume();
      setTimeout(speakNext, 100);
    };

    utterance.onerror = (e) => {
      const err = e as SpeechSynthesisErrorEvent;
      if (err.error !== 'canceled' && err.error !== 'interrupted') {
        console.warn('Speech chunk warning:', err.error);
      }
      currentIndex++;
      setTimeout(speakNext, 100);
    };

    synth.speak(utterance);
  }

  setTimeout(speakNext, 50);
}

// Initialize voices (some browsers load them asynchronously)
export function initVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
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
