// AssemblyAI Streaming STT service
// Uses WebSocket wss://streaming.assemblyai.com/v3/ws
// Model: u3-rt-pro
// PCM16 16kHz audio input
// Returns real-time transcription

export interface AssemblyAITranscriptionResult {
  text: string;
  isFinal: boolean;
}

type TranscriptCallback = (result: AssemblyAITranscriptionResult) => void;
type ErrorCallback = (error: string) => void;
type EndCallback = () => void;

export class AssemblyAIStreamingSTT {
  private ws: WebSocket | null = null;
  private token: string = '';
  private onTranscript: TranscriptCallback;
  private onError: ErrorCallback;
  private onEnd: EndCallback;
  private isConnected: boolean = false;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;

  constructor(
    onTranscript: TranscriptCallback,
    onError: ErrorCallback,
    onEnd: EndCallback
  ) {
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.onEnd = onEnd;
  }

  /**
   * Start streaming STT session
   * ✅ على static export: نأخذ المفتاح من مدخلات المستخدم (localStorage)
   * بدلاً من process.env (لا يعمل في static export)
   */
  async start(): Promise<void> {
    try {
      // ✅ الحصول على مفتاح AssemblyAI من useAppStore (مدخلات المستخدم)
      const { useAppStore } = await import('@/store/useAppStore');
      const store = useAppStore.getState();
      // ابحث عن مفتاح AssemblyAI في apiKeys (provider = 'agentrouter' أو مفتاح مخصص)
      // AssemblyAI ليس في قائمة ApiProvider، نخزّنه في agentRouterKey كحقل بديل
      // أو يمكن للمستخدم إضافته كـ 'assemblyai' في apiKeys
      const aaiKeyEntry = store.apiKeys.find((k) => (k.provider as string) === 'assemblyai');
      const aaiKey = aaiKeyEntry?.key || '';

      if (!aaiKey) {
        throw new Error('مفتاح AssemblyAI غير متوفر. أضفه في الإعدادات أو استخدم واجهة المتصفح للتعرف على الصوت.');
      }

      // ✅ إنشاء token مؤقت (صالح 8 دقائق) باستخدام مفتاح المستخدم
      const tokenRes = await fetch('https://api.assemblyai.com/v2/realtime/token', {
        method: 'POST',
        headers: {
          'Authorization': aaiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expires_in: 480 }),
      });

      if (!tokenRes.ok) {
        throw new Error('فشل في الحصول على رمز AssemblyAI - تحقق من المفتاح أو استخدم واجهة المتصفح');
      }
      const tokenData = await tokenRes.json();
      this.token = tokenData.token;

      if (!this.token) {
        throw new Error('لم يتم الحصول على رمز صالح');
      }

      // 2. Connect to AssemblyAI WebSocket
      await this.connectWebSocket();

      // 3. Start microphone capture with AudioWorklet
      await this.startMicrophone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل في بدء التعرف على الصوت';
      this.onError(msg);
      this.cleanup();
    }
  }

  /**
   * Connect to AssemblyAI streaming WebSocket
   */
  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(
          `wss://streaming.assemblyai.com/v3/ws?token=${this.token}`
        );

        this.ws.onopen = () => {
          console.log('AssemblyAI: WebSocket connected');
          this.isConnected = true;

          // Configure the session
          this.ws?.send(
            JSON.stringify({
              type: 'Configure',
              data: {
                sample_rate: 16000,
                word_boost: [],
                language_detection: true,
              },
            })
          );

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case 'SessionBegins':
                console.log('AssemblyAI: Session began');
                break;
              case 'PartialTranscript':
                if (msg.data?.text) {
                  this.onTranscript({
                    text: msg.data.text,
                    isFinal: false,
                  });
                }
                break;
              case 'FinalTranscript':
                if (msg.data?.text) {
                  this.onTranscript({
                    text: msg.data.text,
                    isFinal: true,
                  });
                }
                break;
              case 'SessionTerminated':
                console.log('AssemblyAI: Session terminated');
                this.onEnd();
                break;
              default:
                // Handle other message types
                break;
            }
          } catch (parseErr) {
            console.warn('AssemblyAI: Failed to parse message', parseErr);
          }
        };

        this.ws.onerror = () => {
          reject(new Error('فشل اتصال AssemblyAI'));
        };

        this.ws.onclose = (event) => {
          console.log('AssemblyAI: WebSocket closed', event.code, event.reason);
          this.isConnected = false;
          if (event.code !== 1000) {
            this.onError('تم قطع اتصال AssemblyAI');
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Start microphone capture using AudioWorklet for PCM16 16kHz
   */
  private async startMicrophone(): Promise<void> {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.audioContext = new AudioContext({ sampleRate: 16000 });

      // Load AudioWorklet for PCM16 conversion
      await this.audioContext.audioWorklet.addModule('/pcm16-processor.js');

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        'pcm16-processor'
      );

      // Handle PCM16 audio data from the worklet
      this.workletNode.port.onmessage = (event) => {
        if (event.data?.pcm16 && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(event.data.pcm16);
        }
      };

      source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);

      console.log('AssemblyAI: Microphone started');
    } catch (err) {
      throw new Error('فشل في الوصول إلى الميكروفون');
    }
  }

  /**
   * Stop streaming STT session
   */
  stop(): void {
    // Send end of stream to AssemblyAI
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'Terminate' }));
      } catch (_e) {
        // ignore
      }
    }
    this.cleanup();
  }

  /**
   * Clean up all resources
   */
  private cleanup(): void {
    this.isConnected = false;

    // Close WebSocket
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client stopped');
      } catch (_e) {
        // ignore
      }
      this.ws = null;
    }

    // Disconnect AudioWorklet
    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch (_e) {
        // ignore
      }
      this.workletNode = null;
    }

    // Stop media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Close AudioContext
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (_e) {
        // ignore
      }
      this.audioContext = null;
    }
  }

  /**
   * Check if currently streaming
   */
  get isActive(): boolean {
    return this.isConnected;
  }
}
