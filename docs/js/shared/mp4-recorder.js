// WebCodecs + mp4-muxer による MP4 録画。
// 非対応ブラウザでは isMP4Supported() が false を返し、呼び出し側は WebM にフォールバックする想定。

export async function isMP4Supported() {
  if (typeof VideoEncoder === 'undefined') return false;
  if (typeof AudioEncoder === 'undefined') return false;
  if (typeof MediaStreamTrackProcessor === 'undefined') return false;
  try {
    const vs = await VideoEncoder.isConfigSupported({
      codec: 'avc1.42E01F',
      width: 1080, height: 1920,
      framerate: 30,
      bitrate: 8_000_000,
    });
    if (!vs.supported) return false;
    const as = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      numberOfChannels: 2,
      sampleRate: 48000,
      bitrate: 192_000,
    });
    return as.supported === true;
  } catch (_) {
    return false;
  }
}

export class MP4Recorder {
  constructor() {
    this.isRecording = false;
    this.onStop = null;
    this.muxer = null;
    this.videoEncoder = null;
    this.audioEncoder = null;
    this.frameTimer = null;
    this.audioReader = null;
    this.startTimestamp = 0;
    this.frameCount = 0;
  }

  async start(canvas, audioStream) {
    const mux = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5/+esm');
    const { Muxer, ArrayBufferTarget } = mux;

    const W = canvas.width;
    const H = canvas.height;
    const fps = 30;

    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H },
      audio: { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 },
      fastStart: 'in-memory',
    });

    this.videoEncoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
      error: e => console.error('VideoEncoder error:', e),
    });
    this.videoEncoder.configure({
      codec: 'avc1.42E01F',
      width: W, height: H,
      framerate: fps,
      bitrate: 8_000_000,
    });

    this.audioEncoder = new AudioEncoder({
      output: (chunk, meta) => this.muxer.addAudioChunk(chunk, meta),
      error: e => console.error('AudioEncoder error:', e),
    });
    this.audioEncoder.configure({
      codec: 'mp4a.40.2',
      numberOfChannels: 2,
      sampleRate: 48000,
      bitrate: 192_000,
    });

    this.startTimestamp = performance.now();
    this.frameCount = 0;
    this.isRecording = true;

    this._captureFrames(canvas, fps);

    const audioTrack = audioStream.getAudioTracks()[0];
    if (audioTrack) {
      this._processAudio(audioTrack);
    }
  }

  _captureFrames(canvas, fps) {
    if (!this.isRecording) return;
    const elapsed = performance.now() - this.startTimestamp;
    const expectedFrames = Math.floor((elapsed * fps) / 1000);
    while (this.frameCount < expectedFrames) {
      const timestamp = Math.round((this.frameCount * 1_000_000) / fps);
      try {
        const frame = new VideoFrame(canvas, { timestamp });
        const keyFrame = this.frameCount % 60 === 0;
        this.videoEncoder.encode(frame, { keyFrame });
        frame.close();
      } catch (e) {
        console.error('frame encode error:', e);
        break;
      }
      this.frameCount++;
    }
    this.frameTimer = setTimeout(() => this._captureFrames(canvas, fps), 16);
  }

  async _processAudio(audioTrack) {
    const processor = new MediaStreamTrackProcessor({ track: audioTrack });
    this.audioReader = processor.readable.getReader();
    while (this.isRecording) {
      try {
        const { value: audioData, done } = await this.audioReader.read();
        if (done) break;
        if (!audioData) continue;
        try {
          this.audioEncoder.encode(audioData);
        } finally {
          audioData.close();
        }
      } catch (e) {
        console.error('audio read error:', e);
        break;
      }
    }
  }

  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;
    this._finalize().catch(e => {
      console.error('finalize error:', e);
      if (this.onStop) this.onStop(null);
    });
  }

  async _finalize() {
    if (this.frameTimer) {
      clearTimeout(this.frameTimer);
      this.frameTimer = null;
    }
    if (this.audioReader) {
      try { await this.audioReader.cancel(); } catch (_) {}
      this.audioReader = null;
    }
    try { await this.videoEncoder.flush(); } catch (_) {}
    try { await this.audioEncoder.flush(); } catch (_) {}
    this.muxer.finalize();
    const blob = new Blob([this.muxer.target.buffer], { type: 'video/mp4' });
    if (this.onStop) this.onStop(blob);
  }
}
