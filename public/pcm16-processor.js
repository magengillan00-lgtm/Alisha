// AudioWorklet Processor for capturing PCM16 16kHz mono audio from microphone

class PCM16Processor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    // Convert Float32 to Int16 (PCM16)
    const pcm16Data = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      pcm16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    this.port.postMessage({
      type: 'audio-data',
      audio: pcm16Data.buffer,
    }, [pcm16Data.buffer]);

    return true;
  }
}

registerProcessor('pcm16-processor', PCM16Processor);
