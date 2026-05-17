// バンドロゴの状態と Canvas 描画を担当
// 画像と各種設定は localStorage に保存され、次回起動時に自動復元される。
const STORAGE_KEY = 'av_logo';

export class Logo {
  constructor() {
    this.img = null;
    this.file = null;
    this.x = 0.85;       // キャンバス幅に対する中心の割合
    this.y = 0.92;
    this.widthScale = 0.18; // キャンバス幅に対する幅の割合
    this.opacity = 0.85;
    this.visible = true;
    this._saveTimer = null;
  }

  loadFile(file) {
    this.file = file;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          this.img = img;
          this.saveToStorage();
          resolve(img);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  clear() {
    this.img = null;
    this.file = null;
    this.clearStorage();
  }

  // 300ms デバウンス付き永続化（drag や slider 中の連続呼び出しに耐える）
  saveToStorage() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._actualSave(), 300);
  }

  _actualSave() {
    if (!this.img) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      return;
    }
    try {
      const data = {
        dataUrl: this.img.src,
        x: this.x, y: this.y,
        widthScale: this.widthScale,
        opacity: this.opacity,
        visible: this.visible,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Logo save failed:', e);
    }
  }

  // 前回保存されたロゴを復元（成功なら true）
  async loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data.dataUrl) return false;
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = data.dataUrl;
      });
      this.img = img;
      if (typeof data.x === 'number') this.x = data.x;
      if (typeof data.y === 'number') this.y = data.y;
      if (typeof data.widthScale === 'number') this.widthScale = data.widthScale;
      if (typeof data.opacity === 'number') this.opacity = data.opacity;
      if (typeof data.visible === 'boolean') this.visible = data.visible;
      return true;
    } catch (e) {
      console.warn('Logo load failed:', e);
      return false;
    }
  }

  clearStorage() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  }

  // 中心 (x*W, y*H)、幅 (widthScale * W) で描画
  // 高さは画像のアスペクト比から自動算出
  draw(ctx, W, H) {
    if (!this.visible || !this.img) return;
    const w = W * this.widthScale;
    const aspect = this.img.naturalHeight / this.img.naturalWidth;
    const h = w * aspect;
    const cx = W * this.x;
    const cy = H * this.y;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.drawImage(this.img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }

  // ヒット判定（ドラッグ配置用）。座標は Canvas ピクセル単位。
  getBounds(W, H) {
    if (!this.img) return null;
    const w = W * this.widthScale;
    const aspect = this.img.naturalHeight / this.img.naturalWidth;
    const h = w * aspect;
    const cx = W * this.x;
    const cy = H * this.y;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }
}
