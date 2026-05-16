// 音声ファイルの読み込みと AudioContext グラフの管理を担当
export class AudioGraph {
  constructor() {
    this.audio = null;
    this.audioCtx = null;
    this.sourceNode = null;
    this.analyser = null;
    this.gainNode = null;
    this.destNode = null;
  }

  loadFile(file) {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    this.audio = new Audio();
    this.audio.src = URL.createObjectURL(file);
    this.audio.crossOrigin = 'anonymous';
    return this.audio;
  }

  setupGraph() {
    if (!this.audio) throw new Error('No audio loaded');
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (_) {}
    }
    this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.82;
    this.gainNode = this.audioCtx.createGain();
    this.destNode = this.audioCtx.createMediaStreamDestination();
    this.sourceNode.connect(this.analyser);
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.audioCtx.destination);
    this.gainNode.connect(this.destNode);
  }

  async resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  getFreqData() {
    if (!this.analyser) return new Uint8Array(1024);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  getTimeData() {
    if (!this.analyser) return new Uint8Array(1024);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  getBass() {
    const freq = this.getFreqData();
    let sum = 0;
    for (let i = 0; i < 16; i++) sum += freq[i];
    return sum / (16 * 255);
  }
}
