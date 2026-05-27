/**
 * TTS Service - Text to Speech
 * Supports: Google TTS (direct audio) + Web Speech API (fallback)
 */

export type TTSProvider = 'google' | 'web-speech';

class TTSService {
  private currentProvider: TTSProvider = 'google';
  private audio: HTMLAudioElement | null = null;
  private isSpeaking = false;
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.synth = window.speechSynthesis || null;
      this.audio = new Audio();
      this.audio.onended = () => { this.clearTimeout(); this.isSpeaking = false; };
      this.audio.onerror = () => { this.clearTimeout(); this.isSpeaking = false; };

      // Pre-load voices (they load asynchronously in Chrome)
      if (this.synth) {
        this.voices = this.synth.getVoices();
        this.synth.onvoiceschanged = () => {
          this.voices = this.synth?.getVoices() || [];
        };
      }
    }
  }

  private clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  setProvider(provider: TTSProvider) {
    this.currentProvider = provider;
  }

  getProvider(): TTSProvider {
    return this.currentProvider;
  }

  async speak(text: string, lang: string = 'ar'): Promise<void> {
    this.stop(); // Stop any current speech

    if (!text.trim()) return;

    if (this.currentProvider === 'google') {
      await this.speakWithGoogle(text, lang);
    } else {
      this.speakWithWebSpeech(text, lang);
    }
  }

  private async speakWithGoogle(text: string, lang: string): Promise<void> {
    try {
      // Use Google TTS direct audio URL
      const encoded = encodeURIComponent(text.substring(0, 200)); // Limit text length for URL
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`;

      if (!this.audio) {
        this.audio = new Audio();
      }

      this.isSpeaking = true;
      this.audio.src = url;

      await new Promise<void>((resolve, reject) => {
        if (!this.audio) { resolve(); return; }

        // Clear any existing timeout
        this.clearTimeout();

        this.audio!.oncanplay = () => {
          this.clearTimeout(); // Clear timeout since audio loaded successfully
          this.audio!.play().then(resolve).catch(reject);
        };

        this.audio!.onended = () => {
          this.isSpeaking = false;
          resolve();
        };

        this.audio!.onerror = () => {
          this.isSpeaking = false;
          // Fallback to Web Speech API
          console.warn('[TTS] Google TTS failed, falling back to Web Speech API');
          this.speakWithWebSpeech(text, lang);
          resolve();
        };

        // Timeout after 10 seconds - clear timeout if audio starts
        this.timeoutId = setTimeout(() => {
          this.isSpeaking = false;
          resolve();
        }, 10000);
      });
    } catch (error) {
      console.error('[TTS] Google TTS error:', error);
      this.speakWithWebSpeech(text, lang);
    }
  }

  private speakWithWebSpeech(text: string, lang: string): void {
    if (!this.synth) {
      console.warn('[TTS] Web Speech API not available');
      return;
    }

    // Cancel any ongoing speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'ar' ? 'ar-SA' : lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to find a voice matching the language
    const targetLang = lang === 'ar' ? 'ar' : lang;
    const matchingVoice = this.voices.find(v => v.lang.startsWith(targetLang));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => { this.isSpeaking = true; };
    utterance.onend = () => { this.isSpeaking = false; };
    utterance.onerror = () => { this.isSpeaking = false; };

    this.synth.speak(utterance);
  }

  stop(): void {
    this.clearTimeout();
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.synth?.cancel();
    this.isSpeaking = false;
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

// Singleton
let ttsInstance: TTSService | null = null;

export function getTTSService(): TTSService {
  if (!ttsInstance) {
    ttsInstance = new TTSService();
  }
  return ttsInstance;
}
