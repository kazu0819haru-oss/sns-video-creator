// 動画クリップの管理と Canvas 描画。
// 音源のトリム後再生位置から、現在再生すべきクリップとそのローカル時刻を算出する。
//
// 各クリップ: { id, file, video (HTMLVideoElement), name, duration, trimStart, trimEnd }
//   trimStart, trimEnd は秒。trimEnd === null は「最後まで」。
export class VideoClips {
  constructor() {
    this.clips = [];
    this.activeIdx = -1;
    this.onChange = null; // タイムライン UI 再描画用
  }

  _notify() { if (this.onChange) this.onChange(); }

  async addClip(file) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('動画読み込み失敗: ' + file.name));
    });
    const clip = {
      id: Date.now() + Math.random(),
      file,
      video,
      name: file.name,
      duration: video.duration,
      trimStart: 0,
      trimEnd: video.duration,
    };
    this.clips.push(clip);
    this._notify();
    return clip;
  }

  removeClip(idx) {
    const c = this.clips[idx];
    if (!c) return;
    // 同じ video 要素を共有する分割クリップが他にないなら URL を revoke
    const shared = this.clips.filter(cc => cc.video === c.video).length;
    if (shared === 1) {
      try { URL.revokeObjectURL(c.video.src); } catch (_) {}
    }
    this.clips.splice(idx, 1);
    if (this.activeIdx >= this.clips.length) this.activeIdx = -1;
    this._notify();
  }

  moveClip(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= this.clips.length) return;
    [this.clips[idx], this.clips[j]] = [this.clips[j], this.clips[idx]];
    this._notify();
  }

  // クリップを任意の位置 toIdx に移動（ドラッグ並べ替え用）
  moveClipTo(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    if (fromIdx < 0 || fromIdx >= this.clips.length) return;
    if (toIdx < 0 || toIdx >= this.clips.length) return;
    const [moved] = this.clips.splice(fromIdx, 1);
    this.clips.splice(toIdx, 0, moved);
    this._notify();
  }

  // localTime（オリジナル動画内の秒）でクリップを2つに分割（カット）
  splitClip(idx, localTime) {
    const c = this.clips[idx];
    if (!c) return;
    if (localTime <= c.trimStart + 0.05 || localTime >= c.trimEnd - 0.05) return;
    // 同じ <video> 要素を共有する新クリップを作成。drawImage は同一要素を参照できる。
    const newClip = {
      id: Date.now() + Math.random(),
      file: c.file,
      video: c.video,
      name: c.name,
      duration: c.duration,
      trimStart: localTime,
      trimEnd: c.trimEnd,
    };
    c.trimEnd = localTime;
    this.clips.splice(idx + 1, 0, newClip);
    this._notify();
  }

  setTrim(idx, trimStart, trimEnd) {
    const c = this.clips[idx];
    if (!c) return;
    c.trimStart = Math.max(0, Math.min(trimStart, c.duration));
    c.trimEnd = Math.max(c.trimStart, Math.min(trimEnd, c.duration));
    this._notify();
  }

  totalDuration() {
    return this.clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0);
  }

  getActiveAt(elapsed) {
    let acc = 0;
    for (let i = 0; i < this.clips.length; i++) {
      const c = this.clips[i];
      const dur = c.trimEnd - c.trimStart;
      if (elapsed < acc + dur) {
        return { idx: i, localTime: c.trimStart + (elapsed - acc) };
      }
      acc += dur;
    }
    return null;
  }

  sync(elapsed, isPlaying) {
    const target = this.getActiveAt(elapsed);
    if (!target) {
      if (this.activeIdx >= 0) {
        const prev = this.clips[this.activeIdx];
        if (prev) prev.video.pause();
        this.activeIdx = -1;
      }
      return;
    }
    if (target.idx !== this.activeIdx) {
      if (this.activeIdx >= 0) {
        const prev = this.clips[this.activeIdx];
        if (prev) prev.video.pause();
      }
      this.activeIdx = target.idx;
    }
    const active = this.clips[this.activeIdx];
    if (!active) return;
    const drift = Math.abs(active.video.currentTime - target.localTime);
    if (drift > 0.25) {
      active.video.currentTime = target.localTime;
    }
    if (isPlaying) {
      if (active.video.paused) active.video.play().catch(() => {});
    } else {
      if (!active.video.paused) active.video.pause();
    }
  }

  pauseAll() {
    for (const c of this.clips) {
      if (!c.video.paused) c.video.pause();
    }
  }

  draw(ctx, W, H) {
    if (this.activeIdx < 0) return;
    const c = this.clips[this.activeIdx];
    if (!c || c.video.readyState < 2) return;
    const vw = c.video.videoWidth;
    const vh = c.video.videoHeight;
    if (!vw || !vh) return;
    const scale = Math.max(W / vw, H / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    ctx.drawImage(c.video, dx, dy, dw, dh);
  }
}
