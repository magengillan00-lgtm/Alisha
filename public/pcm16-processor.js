// PCM16 AudioWorklet Processor
// Captures microphone audio and converts to PCM16 16kHz mono
// for AssemblyAI streaming STT

class PCM16Processor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0]; // Mono: first channel
    if (!channelData) return true;

    // Convert Float32 to Int16 (PCM16)
    const pcm16 = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Send PCM16 buffer to main thread
    this.port.postMessage(
      { pcm16: pcm16.buffer },
      { transfer: [pcm16.buffer] }
    );

    return true;
  }
}

registerProcessor('pcm16-processor', PCM16Processor);
