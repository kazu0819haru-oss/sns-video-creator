// 録画のディスパッチャ。WebCodecs 対応なら MP4、非対応なら WebM 録画 → FFmpeg で MP4 変換。
// onStop(blob, format) — format は常に 'mp4'
// onProgress(percent)  — -1: FFmpeg 読み込み中, 0-100: 変換進捗
import { isMP4Supported, MP4Recorder } from '../shared/mp4-recorder.js';

export class Recorder {
  constructor() {
    this.isRecording = false;
    this.onStop = null;
    this.onProgress = null;
    this.format = null;
    this._mp4 = null;
    this._mediaRecorder = null;
    this._chunks = [];
    this._quality = {};
  }

  async start(canvas, audioStream, quality = {}) {
    this._quality = quality;
    console.log('[Recorder] start quality:', quality);

    const canMP4 = await isMP4Supported();
    console.log('[Recorder] isMP4Supported:', canMP4);

    if (canMP4) {
      this.format = 'mp4';
      this._mp4 = new MP4Recorder();
      this._mp4.onStop = (blob) => {
        this.isRecording = false;
        if (this.onStop) this.onStop(blob, 'mp4');
      };
      try {
        await this._mp4.start(canvas, audioStream, quality);
        this.isRecording = true;
        console.log('[Recorder] MP4 recording started');
      } catch (e) {
        console.error('[Recorder] MP4 start failed, falling back to WebM:', e);
        this._mp4 = null;
        this._startWebM(canvas, audioStream);
      }
    } else {
      console.log('[Recorder] WebCodecs unavailable → WebM + FFmpeg path');
      this._startWebM(canvas, audioStream);
    }
  }

  _startWebM(canvas, audioStream) {
    this.format = 'webm';
    const videoStream = canvas.captureStream(60);
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ]);
    this._chunks = [];

    const q = this._quality;
    const videoBps = q.videoBitrate ?? 16_000_000;
    const audioBps = q.audioBitrate ?? 256_000;

    let options = { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: videoBps, audioBitsPerSecond: audioBps };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: videoBps, audioBitsPerSecond: audioBps };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm', videoBitsPerSecond: videoBps };
    }

    this._mediaRecorder = new MediaRecorder(combined, options);
    this._mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) this._chunks.push(e.data);
    };
    this._mediaRecorder.onstop = async () => {
      const webmBlob = new Blob(this._chunks, { type: 'video/webm' });
      this.isRecording = false;
      await this._convertToMP4(webmBlob);
    };
    this._mediaRecorder.start();
    this.isRecording = true;
  }

  async _convertToMP4(webmBlob) {
    try {
      this.onProgress?.(-1); // FFmpeg 読み込み中
      const { convertWebMToMP4 } = await import('../shared/ffmpeg-convert.js');
      const mp4Blob = await convertWebMToMP4(
        webmBlob,
        this._quality.audioBitrate ?? 256_000,
        (pct) => this.onProgress?.(pct),
      );
      if (this.onStop) this.onStop(mp4Blob, 'mp4');
    } catch (e) {
      console.error('FFmpeg conversion failed, providing WebM:', e);
      if (this.onStop) this.onStop(webmBlob, 'webm');
    }
  }

  stop() {
    if (!this.isRecording) return;
    if (this._mp4) {
      this._mp4.stop();
    } else if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      this._mediaRecorder.stop();
    }
  }
}
