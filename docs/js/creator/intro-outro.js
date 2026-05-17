// イントロ/アウトロカードの状態管理と Canvas 描画。
// QRコードは qrcode-generator を CDN ESM で動的 import。

let qrLib = null;
async function loadQRLib() {
  if (qrLib) return qrLib;
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm');
    qrLib = mod.default;
    return qrLib;
  } catch (e) {
    console.error('QR ライブラリの読み込み失敗:', e);
    return null;
  }
}

export class IntroOutro {
  constructor() {
    this.intro = {
      enabled: false,
      duration: 3,
      title: '',
      subtitle: '',
      fadeOut: 0.6,
    };
    this.outro = {
      enabled: false,
      duration: 3,
      title: '',
      subtitle: '',
      qrUrl: '',
      fadeIn: 0.6,
    };
    this._qrCache = { url: '', dataUrl: '' };
  }

  async _renderQR(url) {
    if (!url) return null;
    if (this._qrCache.url === url && this._qrCache.dataUrl) return this._qrCache.dataUrl;
    const lib = await loadQRLib();
    if (!lib) return null;
    try {
      const qr = lib(0, 'M');
      qr.addData(url);
      qr.make();
      const dataUrl = qr.createDataURL(8, 4);
      this._qrCache = { url, dataUrl };
      return dataUrl;
    } catch (e) {
      console.error('QR 生成失敗:', e);
      return null;
    }
  }

  getActiveOverlay(currentTime, totalDuration) {
    if (this.intro.enabled && currentTime < this.intro.duration) {
      const fadeStart = this.intro.duration - this.intro.fadeOut;
      const alpha = currentTime < fadeStart ? 1 : Math.max(0, 1 - (currentTime - fadeStart) / this.intro.fadeOut);
      return { kind: 'intro', alpha, data: this.intro };
    }
    if (this.outro.enabled && totalDuration > 0) {
      const outroStart = totalDuration - this.outro.duration;
      if (currentTime >= outroStart) {
        const fadeEnd = outroStart + this.outro.fadeIn;
        const alpha = currentTime > fadeEnd ? 1 : Math.max(0, (currentTime - outroStart) / this.outro.fadeIn);
        return { kind: 'outro', alpha, data: this.outro };
      }
    }
    return null;
  }

  async draw(ctx, W, H, active) {
    if (!active) return;
    const a = active.alpha;
    const d = active.data;

    ctx.save();
    ctx.globalAlpha = a;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    if (d.title) {
      const fs = Math.round(H * 0.06);
      ctx.font = `700 ${fs}px "Anton", "Shippori Mincho B1", sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 12;
      const titleY = active.kind === 'outro' && d.qrUrl ? H * 0.3 : H * 0.4;
      ctx.fillText(d.title, W / 2, titleY);
    }

    if (d.subtitle) {
      const fs = Math.round(H * 0.025);
      ctx.font = `400 ${fs}px "Shippori Mincho B1", serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 8;
      const subY = active.kind === 'outro' && d.qrUrl ? H * 0.38 : H * 0.5;
      ctx.fillText(d.subtitle, W / 2, subY);
    }

    if (active.kind === 'outro' && d.qrUrl) {
      const dataUrl = await this._renderQR(d.qrUrl);
      if (dataUrl) {
        const img = await this._loadImage(dataUrl);
        if (img) {
          const size = Math.min(W, H) * 0.3;
          const x = W / 2 - size / 2;
          const y = H * 0.55;
          ctx.drawImage(img, x, y, size, size);
          ctx.font = `500 ${Math.round(H * 0.018)}px "Inter", sans-serif`;
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.shadowBlur = 0;
          ctx.fillText(d.qrUrl, W / 2, y + size + Math.round(H * 0.035));
        }
      }
    }

    ctx.restore();
  }

  _loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
}
