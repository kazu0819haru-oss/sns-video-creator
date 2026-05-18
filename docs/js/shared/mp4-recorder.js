// WebCodecs + mp4-muxer による MP4 録画。
// 非対応ブラウザでは isMP4Supported() が false を返し、呼び出し側は WebM にフォールバックする想定。

// 使えるコーデックを検出して返す（最良→互換性優先の順）
export async function detectVideoCodec(width = 1280, height = 720, fps = 30) {
  if (typeof VideoEncoder === 'undefined') return null;
  const candidates = [
    'avc1.640033', // High L5.1
    'avc1.640032', // High L5.0
    'avc1.64002A', // High L4.2
    'avc1.640028', // High L4.0
    'avc1.4D002A', // Main L4.2
    'avc1.42E033', // Baseline L5.1
    'avc1.42E01F', // Baseline L3.1
  ];
  for (const codec of candidates) {
    try {
      const r = await VideoEncoder.isConfigSupported({
        codec, width, height, framerate: fps, bitrate: 4_000_000,
      });
      if (r.supported) {
        console.log('[MP4] video codec OK:', codec);
        return codec;
      }
    } catch (_) {}
  }
  console.warn('[MP4] no H.264 codec supported');
  return null;
}

export async function isMP4Supported() {
  console.log('[MP4] checking support...');

  if (typeof VideoEncoder === 'undefined') {
    console.warn('[MP4] VideoEncoder undefined');
    return false;
  }
  if (typeof AudioEncoder === 'undefined') {
    console.warn('[MP4] AudioEncoder undefined');
    return false;
  }
  if (typeof MediaStreamTrackProcessor === 'undefined') {
    console.warn('[MP4] MediaStreamTrackProcessor undefined');
    return false;
  }

  // ランドスケープで能力チェック（一部環境でポートレートを拒否するハードウェアエンコーダ対策）
  const codec = await detectVideoCodec(1280, 720, 30);
  if (!codec) return false;

  try {
    const as = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      numberOfChannels: 2,
      sampleRate: 48000,
      bitrate: 128_000,
    });
    if (!as.supported) {
      console.warn('[MP4] AudioEncoder AAC not supported');
      return false;
    }
  } catch (e) {
    console.warn('[MP4] AudioEncoder check threw:', e);
    return false;
  }

  console.log('[MP4] supported → using WebCodecs path');
  return true;
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

  // quality: { videoBitrate, audioBitrate, fps }
  async start(canvas, audioStream, quality = {}) {
    const mux = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5/+esm');
    const { Muxer, ArrayBufferTarget } = mux;

    const W = canvas.width;
    const H = canvas.height;
    const fps = quality.fps ?? 60;
    const videoBitrate = quality.videoBitrate ?? 16_000_000;
    // Chrome の AAC エンコーダーは 96k/128k/160k/192k のみ対応
    const AUDIO_BITRATES = [192_000, 160_000, 128_000, 96_000];
    const rawAudio = quality.audioBitrate ?? 192_000;
    const audioBitrate = AUDIO_BITRATES.find(b => b <= rawAudio) ?? 128_000;

    // 実際の解像度・フレームレートで使えるコーデックを選ぶ
    const codec = await detectVideoCodec(W, H, fps);
    if (!codec) throw new Error('No supported H.264 codec for this resolution/fps');
    console.log(`[MP4] configure: ${codec} ${W}x${H} ${fps}fps ${videoBitrate}bps`);

    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H },
      audio: { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset',
    });

    this.videoEncoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
      error: e => console.error('[MP4] VideoEncoder error:', e),
    });
    this.videoEncoder.configure({
      codec,
      width: W, height: H,
      framerate: fps,
      bitrate: videoBitrate,
    });

    this.audioEncoder = new AudioEncoder({
      output: (chunk, meta) => this.muxer.addAudioChunk(chunk, meta),
      error: e => console.error('[MP4] AudioEncoder error:', e),
    });
    this.audioEncoder.configure({
      codec: 'mp4a.40.2',
      numberOfChannels: 2,
      sampleRate: 48000,
      bitrate: audioBitrate,
    });

    this.fps = fps;
    this.startTimestamp = performance.now();
    this.frameCount = 0;
    this.isRecording = true;

    this._captureFrames(canvas, fps);

    const audioTrack = audioStream.getAudioTracks()[0];
    if (audioTrack) {
      this._processAudio(audioTrack);
    } else {
      console.warn('[MP4] no audio track found in stream');
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
        console.error('[MP4] frame encode error:', e);
        break;
      }
      this.frameCount++;
    }
    this.frameTimer = setTimeout(() => this._captureFrames(canvas, fps), Math.floor(1000 / fps / 2));
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
        console.error('[MP4] audio read error:', e);
        break;
      }
    }
  }

  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;
    this._finalize().catch(e => {
      console.error('[MP4] finalize error:', e);
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
    console.log('[MP4] finalized, size:', blob.size);
    if (this.onStop) this.onStop(blob);
  }
}
