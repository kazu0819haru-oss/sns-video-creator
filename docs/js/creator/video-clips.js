// 動画クリップ＋画像クリップの管理と Canvas 描画。
// 音源のトリム後再生位置から、現在再生すべきクリップとそのローカル時刻を算出する。
//
// 各クリップ:
//   { id, kind:'video', file, video, name, duration, trimStart, trimEnd, clipMin, clipMax }
//   { id, kind:'image', file, img, name, duration, trimStart, trimEnd, clipMin, clipMax }
//
// image clip の duration は表示時間で、ユーザが右ハンドルで自由に伸縮可能。
export class VideoClips {
  constructor() {
    this.clips = [];
    this.activeIdx = -1;
    this.onChange = null;
    this._lastFrameCanvas = null; // readyState < 2 の間に表示する直前フレームのキャッシュ
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
      kind: 'video',
      file,
      video,
      name: file.name,
      duration: video.duration,
      trimStart: 0,
      trimEnd: video.duration,
      clipMin: 0,
      clipMax: video.duration,
    };
    this.clips.push(clip);
    this._notify();
    return clip;
  }

  async addImageClip(file, defaultDuration = 3) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('画像読み込み失敗: ' + file.name));
    });
    const clip = {
      id: Date.now() + Math.random(),
      kind: 'image',
      file,
      img,
      name: file.name,
      duration: defaultDuration,
      trimStart: 0,
      trimEnd: defaultDuration,
      clipMin: 0,
      clipMax: defaultDuration,
    };
    this.clips.push(clip);
    this._notify();
    return clip;
  }

  // 画像クリップの表示時間を自由に変更（右ハンドルから）
  setImageDuration(idx, newDuration, suppressNotify = false) {
    const c = this.clips[idx];
    if (!c || c.kind !== 'image') return;
    const d = Math.max(0.1, newDuration);
    c.duration = d;
    c.trimStart = 0;
    c.trimEnd = d;
    c.clipMin = 0;
    c.clipMax = d;
    if (!suppressNotify) this._notify();
  }

  removeClip(idx) {
    const c = this.clips[idx];
    if (!c) return;
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

  moveClipTo(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    if (fromIdx < 0 || fromIdx >= this.clips.length) return;
    if (toIdx < 0 || toIdx >= this.clips.length) return;
    const [moved] = this.clips.splice(fromIdx, 1);
    this.clips.splice(toIdx, 0, moved);
    this._notify();
  }

  splitClip(idx, localTime) {
    const c = this.clips[idx];
    if (!c) return;
    if (c.kind === 'image') {
      // 画像は localTime で2つに分割（両方とも同じ画像）
      if (localTime <= 0.05 || localTime >= c.duration - 0.05) return;
      const restDur = c.duration - localTime;
      const newClip = {
        id: Date.now() + Math.random(),
        kind: 'image',
        file: c.file,
        img: c.img,
        name: c.name,
        duration: restDur,
        trimStart: 0,
        trimEnd: restDur,
        clipMin: 0,
        clipMax: restDur,
      };
      c.duration = localTime;
      c.trimEnd = localTime;
      c.clipMax = localTime;
      this.clips.splice(idx + 1, 0, newClip);
      this._notify();
      return;
    }
    if (localTime <= c.trimStart + 0.05 || localTime >= c.trimEnd - 0.05) return;
    const newClip = {
      id: Date.now() + Math.random(),
      kind: 'video',
      file: c.file,
      video: c.video,
      name: c.name,
      duration: c.duration,
      trimStart: localTime,
      trimEnd: c.trimEnd,
      clipMin: c.clipMin ?? 0,
      clipMax: c.clipMax ?? c.duration,
    };
    c.trimEnd = localTime;
    this.clips.splice(idx + 1, 0, newClip);
    this._notify();
  }

  setTrim(idx, trimStart, trimEnd, suppressNotify = false) {
    const c = this.clips[idx];
    if (!c) return;
    const min = c.clipMin ?? 0;
    const max = c.clipMax ?? c.duration;
    c.trimStart = Math.max(min, Math.min(trimStart, max));
    c.trimEnd = Math.max(c.trimStart, Math.min(trimEnd, max));
    if (!suppressNotify) this._notify();
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

    // 切り替わり 1 秒前に次クリップを trimStart へプリシーク
    if (target) {
      const ci = this.clips[target.idx];
      const remaining = ci.trimEnd - target.localTime;
      if (remaining < 1.0) {
        const next = this.clips[target.idx + 1];
        if (next && (next.kind || 'video') === 'video') {
          if (Math.abs(next.video.currentTime - next.trimStart) > 0.05) {
            next.video.currentTime = next.trimStart;
          }
        }
      }
    }

    if (!target) {
      if (this.activeIdx >= 0) {
        const prev = this.clips[this.activeIdx];
        if (prev && (prev.kind || 'video') === 'video') prev.video.pause();
        this.activeIdx = -1;
      }
      return;
    }

    const switched = target.idx !== this.activeIdx;
    if (switched) {
      if (this.activeIdx >= 0) {
        const prev = this.clips[this.activeIdx];
        if (prev && (prev.kind || 'video') === 'video') prev.video.pause();
      }
      this.activeIdx = target.idx;
    }

    const active = this.clips[this.activeIdx];
    if (!active) return;
    if ((active.kind || 'video') === 'video') {
      const drift = Math.abs(active.video.currentTime - target.localTime);
      // 切り替え時は必ずシーク（プリシークで済んでいれば drift ≈ 0 で即座）
      if (switched || drift > 0.25) {
        active.video.currentTime = target.localTime;
      }
      if (isPlaying) {
        if (active.video.paused) active.video.play().catch(() => {});
      } else {
        if (!active.video.paused) active.video.pause();
      }
    }
    // image: 静止画なので再生制御不要
  }

  pauseAll() {
    for (const c of this.clips) {
      if ((c.kind || 'video') === 'video' && !c.video.paused) c.video.pause();
    }
  }

  draw(ctx, W, H) {
    if (this.activeIdx < 0) {
      this._drawCached(ctx);
      return;
    }
    const c = this.clips[this.activeIdx];
    if (!c) return;
    const kind = c.kind || 'video';
    if (kind === 'video') {
      if (c.video.readyState < 2) {
        // シーク中は直前フレームを維持してブラックフラッシュを防ぐ
        this._drawCached(ctx);
        return;
      }
      const vw = c.video.videoWidth;
      const vh = c.video.videoHeight;
      if (!vw || !vh) return;
      const sc = Math.max(W / vw, H / vh);
      const dw = vw * sc, dh = vh * sc;
      ctx.drawImage(c.video, (W - dw) / 2, (H - dh) / 2, dw, dh);
      this._cacheFrame(c.video, vw, vh, W, H);
    } else if (kind === 'image') {
      if (!c.img.complete) return;
      const iw = c.img.naturalWidth;
      const ih = c.img.naturalHeight;
      if (!iw || !ih) return;
      const sc = Math.max(W / iw, H / ih);
      const dw = iw * sc, dh = ih * sc;
      ctx.drawImage(c.img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
  }

  // 直前の動画フレームを OffscreenCanvas にキャッシュ
  _cacheFrame(video, vw, vh, W, H) {
    if (!this._lastFrameCanvas || this._lastFrameCanvas.width !== W || this._lastFrameCanvas.height !== H) {
      this._lastFrameCanvas = new OffscreenCanvas(W, H);
    }
    const fc = this._lastFrameCanvas.getContext('2d');
    fc.clearRect(0, 0, W, H);
    const sc = Math.max(W / vw, H / vh);
    const dw = vw * sc, dh = vh * sc;
    fc.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  }

  // キャッシュがあればそれを描画
  _drawCached(ctx) {
    if (this._lastFrameCanvas) {
      ctx.drawImage(this._lastFrameCanvas, 0, 0);
    }
  }
}
