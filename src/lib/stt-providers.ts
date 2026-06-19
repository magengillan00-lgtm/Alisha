// STT Provider switching
// AssemblyAI (default, with streaming) and Web Speech API (fallback)

import { AssemblyAIStreamingSTT } from '@/lib/assemblyai-stt';
import { createSpeechRecognition } from '@/lib/speech';
import type { SttProvider } from '@/store/useAppStore';

export type { SttProvider };

export interface STTResult {
  text: string;
  isFinal: boolean;
}

export type STTTranscriptCallback = (result: STTResult) => void;
export type STTErrorCallback = (error: string) => void;
export type STTEndCallback = () => void;

// ============ STT SESSION INTERFACE ============

export interface STTSession {
  start: () => Promise<void>;
  stop: () => void;
  isActive: boolean;
}

// ============ ASSEMBLYAI STT SESSION ============

export class AssemblyAISTTSession implements STTSession {
  private engine: AssemblyAIStreamingSTT;
  private _isActive: boolean = false;

  constructor(
    onTranscript: STTTranscriptCallback,
    onError: STTErrorCallback,
    onEnd: STTEndCallback
  ) {
    this.engine = new AssemblyAIStreamingSTT(
      (result) => {
        onTranscript(result);
      },
      (error) => {
        this._isActive = false;
        onError(error);
      },
      () => {
        this._isActive = false;
        onEnd();
      }
    );
  }

  async start(): Promise<void> {
    this._isActive = true;
    await this.engine.start();
  }

  stop(): void {
    this.engine.stop();
    this._isActive = false;
  }

  get isActive(): boolean {
    return this._isActive;
  }
}

// ============ WEB SPEECH API STT SESSION ============

export class WebSpeechSTTSession implements STTSession {
  private recognition: ReturnType<typeof createSpeechRecognition>;
  private _isActive: boolean = false;

  constructor(
    lang: string,
    onTranscript: STTTranscriptCallback,
    onError: STTErrorCallback,
    onEnd: STTEndCallback
  ) {
    const speechLangMap: Record<string, string> = {
      ar: 'ar-SA',
      en: 'en-US',
      ja: 'ja-JP',
    };
    const speechLang = speechLangMap[lang] || 'ar-SA';

    this.recognition = createSpeechRecognition(
      speechLang,
      (transcript, isFinal) => {
        onTranscript({ text: transcript, isFinal });
      },
      (error) => {
        this._isActive = false;
        onError(error);
      },
      () => {
        this._isActive = false;
        onEnd();
      }
    )!;
  }

  async start(): Promise<void> {
    if (!this.recognition) {
      throw new Error('المتصفح لا يدعم التعرف على الصوت');
    }
    this._isActive = true;
    this.recognition.start();
  }

  stop(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (_e) {
        try {
          this.recognition.abort();
        } catch (_e2) {
          // ignore
        }
      }
    }
    this._isActive = false;
  }

  get isActive(): boolean {
    return this._isActive;
  }
}

// ============ FACTORY FUNCTION ============

/**
 * Create an STT session based on the selected provider
 */
export function createSTTSession(
  provider: SttProvider,
  lang: string,
  onTranscript: STTTranscriptCallback,
  onError: STTErrorCallback,
  onEnd: STTEndCallback
): STTSession {
  if (provider === 'assemblyai') {
    return new AssemblyAISTTSession(onTranscript, onError, onEnd);
  } else {
    return new WebSpeechSTTSession(lang, onTranscript, onError, onEnd);
  }
}

/**
 * Get STT provider display info
 */
export const STT_PROVIDERS = [
  {
    id: 'assemblyai' as SttProvider,
    name: 'AssemblyAI',
    nameAr: 'أسمبلي أيه آي',
    icon: '🎙️',
    description: 'بث مباشر عالي الجودة',
    descriptionEn: 'High-quality streaming STT',
  },
  {
    id: 'webspeech' as SttProvider,
    name: 'Web Speech API',
    nameAr: 'واجهة المتصفح',
    icon: '🗣️',
    description: 'مدمج في المتصفح - لا يحتاج مفتاح',
    descriptionEn: 'Browser built-in - no key needed',
  },
];
