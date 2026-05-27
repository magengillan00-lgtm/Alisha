/**
 * STT Provider System
 * Supports: AssemblyAI Streaming (default) + Web Speech API (fallback)
 */

import { AssemblyAISTreamingSTT } from './assemblyai-stt';

export type STTProviderType = 'assemblyai' | 'web-speech';

export interface STTResult {
  text: string;
  isFinal: boolean;
  provider: STTProviderType;
}

export type STTResultCallback = (result: STTResult) => void;
export type STTErrorCallback = (error: Error) => void;
export type STTStatusCallback = (status: string) => void;

// ==========================================
// Web Speech API Provider
// ==========================================
export class WebSpeechSTT {
  private recognition: any = null;
  private isActive = false;
  private shouldBeActive = false; // Track intent for auto-restart
  private onResult: STTResultCallback | null = null;
  private onError: STTErrorCallback | null = null;
  private onStatus: STTStatusCallback | null = null;

  constructor() {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[WebSpeech] Speech Recognition API not available');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'ar-SA'; // Arabic as primary, auto-detects English too
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.onResult?.({
          text: finalTranscript,
          isFinal: true,
          provider: 'web-speech',
        });
      } else if (interimTranscript) {
        this.onResult?.({
          text: interimTranscript,
          isFinal: false,
          provider: 'web-speech',
        });
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('[WebSpeech] Error:', event.error);
      if (event.error === 'not-allowed') {
        this.shouldBeActive = false;
        this.onError?.(new Error('تم رفض إذن الميكروفون'));
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        this.onError?.(new Error(`خطأ في التعرف على الكلام: ${event.error}`));
      }
    };

    this.recognition.onstart = () => {
      this.isActive = true;
      this.onStatus?.('listening');
    };

    this.recognition.onend = () => {
      this.isActive = false;
      // Auto-restart if still supposed to be active
      // Web Speech API stops automatically after silence - we need to restart it
      if (this.shouldBeActive) {
        try {
          this.recognition.start();
        } catch (e: any) {
          if (!e.message?.includes('already started')) {
            console.warn('[WebSpeech] Failed to auto-restart:', e.message);
            this.shouldBeActive = false;
            this.onStatus?.('disconnected');
          }
        }
      } else {
        this.onStatus?.('disconnected');
      }
    };
  }

  setCallbacks(onResult: STTResultCallback, onError: STTErrorCallback, onStatus: STTStatusCallback) {
    this.onResult = onResult;
    this.onError = onError;
    this.onStatus = onStatus;
  }

  async start(): Promise<void> {
    if (!this.recognition) {
      throw new Error('Web Speech API غير متاح في هذا المتصفح');
    }
    if (this.isActive) return;

    this.shouldBeActive = true;
    try {
      this.recognition.start();
    } catch (e: any) {
      // If already started, ignore
      if (!e.message?.includes('already started')) {
        this.shouldBeActive = false;
        throw e;
      }
    }
  }

  async stop(): Promise<void> {
    this.shouldBeActive = false;
    if (!this.recognition) return;

    try {
      this.recognition.stop();
    } catch {}
    this.isActive = false;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  isAvailable(): boolean {
    return !!this.recognition;
  }

  setLanguage(lang: string) {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }
}

// ==========================================
// STT Provider Manager
// ==========================================
export class STTProviderManager {
  private currentProvider: STTProviderType = 'assemblyai';
  private activeProvider: STTProviderType = 'assemblyai'; // Track what's actually running
  private assemblyaiSTT: AssemblyAISTreamingSTT | null = null;
  private webSpeechSTT: WebSpeechSTT | null = null;
  private onResult: STTResultCallback | null = null;
  private onError: STTErrorCallback | null = null;
  private onStatus: STTStatusCallback | null = null;

  constructor() {
    this.webSpeechSTT = new WebSpeechSTT();
  }

  setAssemblyAI(stt: AssemblyAISTreamingSTT) {
    this.assemblyaiSTT = stt;
  }

  setCallbacks(onResult: STTResultCallback, onError: STTErrorCallback, onStatus: STTStatusCallback) {
    this.onResult = onResult;
    this.onError = onError;
    this.onStatus = onStatus;

    // Wire up Web Speech callbacks
    this.webSpeechSTT?.setCallbacks(
      (result) => this.onResult?.(result),
      (error) => this.onError?.(error),
      (status) => this.onStatus?.(`web-speech:${status}`)
    );

    // Wire up AssemblyAI callbacks
    if (this.assemblyaiSTT) {
      this.assemblyaiSTT.setCallbacks(
        (result: any) => this.onResult?.({ ...result, provider: 'assemblyai' }),
        (error: Error) => this.onError?.(error),
        (status: string) => this.onStatus?.(`assemblyai:${status}`)
      );
    }
  }

  setProvider(provider: STTProviderType) {
    this.currentProvider = provider;
  }

  getProvider(): STTProviderType {
    return this.currentProvider;
  }

  getActiveProvider(): STTProviderType {
    return this.activeProvider;
  }

  async start(): Promise<void> {
    if (this.currentProvider === 'assemblyai' && this.assemblyaiSTT) {
      try {
        await this.assemblyaiSTT.start();
        this.activeProvider = 'assemblyai';
      } catch (error: any) {
        console.warn('[STT] AssemblyAI failed, falling back to Web Speech API:', error.message);
        this.activeProvider = 'web-speech';
        await this.webSpeechSTT?.start();
      }
    } else {
      this.activeProvider = 'web-speech';
      await this.webSpeechSTT?.start();
    }
  }

  async stop(): Promise<void> {
    // Stop both to handle fallback scenarios cleanly
    await this.assemblyaiSTT?.stop();
    await this.webSpeechSTT?.stop();
  }

  isRecording(): boolean {
    if (this.activeProvider === 'assemblyai' && this.assemblyaiSTT) {
      return this.assemblyaiSTT.getIsActive();
    }
    return this.webSpeechSTT?.getIsActive() || false;
  }

  isWebSpeechAvailable(): boolean {
    return this.webSpeechSTT?.isAvailable() || false;
  }

  isAssemblyAIAvailable(): boolean {
    return !!this.assemblyaiSTT;
  }
}
