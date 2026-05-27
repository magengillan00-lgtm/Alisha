// AudioWorklet Processor for capturing PCM16 16kHz mono audio from microphone
// This file must be in public/ directory as it runs in a separate AudioWorklet context

class PCM16Processor extends AudioWorkletProcessor {
  private bufferSize = 0;
  private targetSampleRate = 16000;

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0]; // Mono - first channel
    if (!channelData || channelData.length === 0) return true;

    // Convert Float32 to Int16 (PCM16)
    const pcm16Data = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      pcm16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Send PCM16 data to main thread
    this.port.postMessage({
      type: 'audio-data',
      audio: pcm16Data.buffer,
    }, [pcm16Data.buffer]);

    return true;
  }
}

registerProcessor('pcm16-processor', PCM16Processor);
