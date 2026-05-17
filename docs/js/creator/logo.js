// バンドロゴの状態と Canvas 描画を担当
export class Logo {
  constructor() {
    this.img = null;
    this.file = null;
    this.x = 0.85;       // キャンバス幅に対する中心の割合
    this.y = 0.92;
    this.widthScale = 0.18; // キャンバス幅に対する幅の割合
    this.opacity = 0.85;
    this.visible = true;
  }

  loadFile(file) {
    this.file = file;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => { this.img = img; resolve(img); };
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
