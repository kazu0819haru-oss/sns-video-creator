// スマホフレームプレビュー。メインキャンバスの内容を小型キャンバスにミラーリングし、
// プラットフォーム UI スケルトン（コメント・いいねボタンなど）を半透明で重ねる。
export class PhonePreview {
  constructor(canvasEl, mainCanvas) {
    this.canvas = canvasEl;
    this.mainCanvas = mainCanvas;
    this.ctx = canvasEl.getContext('2d');
    this.presetId = null;
    this.enabled = true;
  }

  setPreset(id) { this.presetId = id; }
  setEnabled(on) { this.enabled = on; }

  draw() {
    if (!this.enabled) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    this.ctx.clearRect(0, 0, W, H);
    const mw = this.mainCanvas.width;
    const mh = this.mainCanvas.height;
    const scale = Math.min(W / mw, H / mh);
    const dw = mw * scale;
    const dh = mh * scale;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, W, H);
    try { this.ctx.drawImage(this.mainCanvas, dx, dy, dw, dh); } catch (_) {}

    if (this.presetId === 'tiktok') this._drawTikTokUI(dx, dy, dw, dh);
    else if (this.presetId === 'reels') this._drawReelsUI(dx, dy, dw, dh);
    else if (this.presetId === 'shorts') this._drawShortsUI(dx, dy, dw, dh);
  }

  _drawIcon(x, y, label) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = '600 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }

  _drawTikTokUI(dx, dy, dw, dh) {
    const ctx = this.ctx;
    ctx.save();
    const rightX = dx + dw - 22;
    [0, 1, 2, 3].forEach(i => this._drawIcon(rightX, dy + dh - 70 - i * 40, '♥'));
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(dx, dy + dh - 50, dw - 50, 50);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('@user_name', dx + 8, dy + dh - 32);
    ctx.fillText('#NiSSHëL #迷彩 #バンド', dx + 8, dy + dh - 18);
    ctx.restore();
  }

  _drawReelsUI(dx, dy, dw, dh) {
    const ctx = this.ctx;
    ctx.save();
    const rightX = dx + dw - 22;
    ['♥', '💬', '➤', '⋯'].forEach((emoji, i) => this._drawIcon(rightX, dy + dh - 100 - i * 40, emoji));
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(dx, dy + dh - 60, dw, 60);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('user_name •  followed', dx + 8, dy + dh - 40);
    ctx.fillText('♪ Original audio · NiSSHëL', dx + 8, dy + dh - 24);
    ctx.restore();
  }

  _drawShortsUI(dx, dy, dw, dh) {
    const ctx = this.ctx;
    ctx.save();
    const rightX = dx + dw - 22;
    ['👍', '👎', '💬', '➤'].forEach((emoji, i) => this._drawIcon(rightX, dy + dh - 110 - i * 40, emoji));
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(dx, dy + dh - 50, dw, 50);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('▶ チャンネル名', dx + 8, dy + dh - 32);
    ctx.fillText('登録', dx + dw - 50, dy + dh - 28);
    ctx.restore();
  }
}
