// 録画のディスパッチャ。WebCodecs 対応なら MP4、非対応なら WebM (MediaRecorder)。
// onStop(blob, format) — format は 'mp4' | 'webm'
import { isMP4Supported, MP4Recorder } from '../shared/mp4-recorder.js';

export class Recorder {
  constructor() {
    this.isRecording = false;
    this.onStop = null;
    this.format = null;
    this._mp4 = null;
    this._mediaRecorder = null;
    this._chunks = [];
  }

  async start(canvas, audioStream) {
    if (await isMP4Supported()) {
      this.format = 'mp4';
      this._mp4 = new MP4Recorder();
      this._mp4.onStop = (blob) => {
        this.isRecording = false;
        if (this.onStop) this.onStop(blob, 'mp4');
      };
      try {
        await this._mp4.start(canvas, audioStream);
        this.isRecording = true;
      } catch (e) {
        console.error('MP4 start failed, falling back to WebM:', e);
        this._mp4 = null;
        this.format = 'webm';
        this._startWebM(canvas, audioStream);
      }
    } else {
      this.format = 'webm';
      this._startWebM(canvas, audioStream);
    }
  }

  _startWebM(canvas, audioStream) {
    const videoStream = canvas.captureStream(60);
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ]);
    this._chunks = [];

    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8,opus' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm' };
    }

    this._mediaRecorder = new MediaRecorder(combined, options);
    this._mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) this._chunks.push(e.data);
    };
    this._mediaRecorder.onstop = () => {
      const blob = new Blob(this._chunks, { type: 'video/webm' });
      this.isRecording = false;
      if (this.onStop) this.onStop(blob, 'webm');
    };
    this._mediaRecorder.start();
    this.isRecording = true;
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
