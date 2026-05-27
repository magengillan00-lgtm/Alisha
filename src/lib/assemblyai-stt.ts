/**
 * AssemblyAI Streaming STT Service
 * Uses WebSocket v3 with u3-rt-pro model for real-time speech-to-text
 * Supports Arabic language detection
 */

export interface AssemblyAIConfig {
  tokenEndpoint: string;
  sampleRate?: number;
  speechModel?: string;
  languagePrompt?: string;
}

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence: number;
}

type TranscriptionCallback = (result: TranscriptionResult) => void;
type ErrorCallback = (error: Error) => void;
type StatusCallback = (status: 'connecting' | 'connected' | 'listening' | 'processing' | 'disconnected' | 'error') => void;

export class AssemblyAISTreamingSTT {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  private config: AssemblyAIConfig;
  private onTranscription: TranscriptionCallback | null = null;
  private onError: ErrorCallback | null = null;
  private onStatus: StatusCallback | null = null;
  private isActive = false;
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  constructor(config: AssemblyAIConfig) {
    this.config = {
      sampleRate: 16000,
      speechModel: 'u3-rt-pro',
      languagePrompt: 'Transcribe Arabic and English',
      ...config,
    };
  }

  setCallbacks(
    onTranscription: TranscriptionCallback,
    onError: ErrorCallback,
    onStatus: StatusCallback
  ) {
    this.onTranscription = onTranscription;
    this.onError = onError;
    this.onStatus = onStatus;
  }

  private updateStatus(status: Parameters<StatusCallback>[0]) {
    this.onStatus?.(status);
  }

  async start(): Promise<void> {
    if (this.isActive) {
      console.warn('[AssemblyAI] Already active');
      return;
    }

    try {
      this.updateStatus('connecting');

      // 1. Get temporary token from server
      const tokenResponse = await fetch(this.config.tokenEndpoint);
      if (!tokenResponse.ok) {
        throw new Error(`Failed to get AssemblyAI token: ${tokenResponse.status}`);
      }
      const { token } = await tokenResponse.json();

      if (!token) {
        throw new Error('No token received from server');
      }

      // 2. Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: this.config.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 3. Create AudioContext and worklet
      this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });
      await this.audioContext.audioWorklet.addModule('/pcm16-processor.js');

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm16-processor');

      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'audio-data' && this.ws?.readyState === WebSocket.OPEN) {
          // Send PCM16 audio chunk as binary frame
          this.ws.send(event.data.audio);
        }
      };

      // 4. Connect WebSocket to AssemblyAI
      const wsUrl = `wss://streaming.assemblyai.com/v3/ws?sample_rate=${this.config.sampleRate}&speech_model=${this.config.speechModel}&token=${token}`;

      if (this.config.languagePrompt) {
        // For U3 Pro Streaming, use prompt query param for language steering
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[AssemblyAI] WebSocket connected');
        this.isActive = true;
        this.reconnectAttempts = 0;
        this.updateStatus('connected');

        // Connect audio pipeline
        this.sourceNode?.connect(this.workletNode!);
        this.workletNode?.connect(this.audioContext!.destination);

        this.updateStatus('listening');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[AssemblyAI] Failed to parse message:', e);
        }
      };

      this.ws.onerror = (event) => {
        console.error('[AssemblyAI] WebSocket error:', event);
        this.onError?.(new Error('WebSocket connection error'));
        this.updateStatus('error');
      };

      this.ws.onclose = (event) => {
        console.log(`[AssemblyAI] WebSocket closed: code=${event.code} reason=${event.reason}`);
        this.isActive = false;
        this.updateStatus('disconnected');

        // Attempt reconnect for unexpected closures
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`[AssemblyAI] Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
          setTimeout(() => this.start(), 2000 * this.reconnectAttempts);
        }
      };

    } catch (error: any) {
      console.error('[AssemblyAI] Start error:', error);
      this.onError?.(error);
      this.updateStatus('error');
      this.cleanup();
    }
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'Begin':
        this.sessionId = msg.id;
        console.log('[AssemblyAI] Session started:', msg.id);
        break;

      case 'SpeechStarted':
        this.updateStatus('processing');
        break;

      case 'Turn':
        if (this.onTranscription) {
          this.onTranscription({
            text: msg.transcript || '',
            isFinal: msg.end_of_turn || false,
            confidence: msg.end_of_turn_confidence || 0,
          });
        }
        if (msg.end_of_turn) {
          this.updateStatus('listening');
        }
        break;

      case 'Termination':
        console.log('[AssemblyAI] Session terminated:', {
          audioDuration: msg.audio_duration_seconds,
          sessionDuration: msg.session_duration_seconds,
        });
        this.isActive = false;
        this.updateStatus('disconnected');
        break;

      default:
        // Ignore unknown message types
        break;
    }
  }

  async stop(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Send Terminate message (required by AssemblyAI)
      this.ws.send(JSON.stringify({ type: 'Terminate' }));
      
      // Wait briefly for Termination message
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.ws.close(1000, 'User stopped recording');
    }

    this.cleanup();
  }

  private cleanup() {
    this.isActive = false;
    this.sessionId = null;

    try {
      this.workletNode?.disconnect();
      this.sourceNode?.disconnect();
    } catch {}

    if (this.audioContext?.state !== 'closed') {
      this.audioContext?.close().catch(() => {});
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }

    this.workletNode = null;
    this.sourceNode = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.ws = null;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }
}
