import { registerStyle } from './registry.js';

function drawRainbowBars(ctx, W, H, freq, time, bass, opts = {}) {
  const jacketImg = opts.jacketImg;
  if (opts.showJacket && jacketImg && jacketImg.complete && jacketImg.naturalWidth) {
    const size = Math.min(W * 0.7, H * 0.45);
    const x = (W - size) / 2;
    const y = H * 0.13;
    ctx.save();
    ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
    ctx.shadowBlur = 30 + bass * 100;
    const r = 22;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + size, y, x + size, y + size, r);
    ctx.arcTo(x + size, y + size, x, y + size, r);
    ctx.arcTo(x, y + size, x, y, r);
    ctx.arcTo(x, y, x + size, y, r);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(jacketImg, x, y, size, size);
    ctx.restore();
  }

  const bars = 96;
  const margin = W * 0.04;
  const totalW = W - margin * 2;
  const slot = totalW / bars;
  const bw = slot * 0.68;
  const gap = slot - bw;
  const baseY = H * 0.92;
  const maxBarH = H * 0.32;
  ctx.save();
  for (let i = 0; i < bars; i++) {
    const v = (freq[i * 2] || 0) / 255;
    const h = v * maxBarH + 6;
    const x = margin + i * slot + gap / 2;
    const hue = 180 + (i / bars) * 160;
    const grad = ctx.createLinearGradient(0, baseY - h, 0, baseY);
    grad.addColorStop(0, `hsla(${hue}, 90%, 75%, 1)`);
    grad.addColorStop(1, `hsla(${hue}, 85%, 55%, 1)`);
    ctx.fillStyle = grad;
    const rr = Math.min(bw / 2, 6);
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, baseY - h + rr);
    ctx.arcTo(x, baseY - h, x + rr, baseY - h, rr);
    ctx.lineTo(x + bw - rr, baseY - h);
    ctx.arcTo(x + bw, baseY - h, x + bw, baseY - h + rr, rr);
    ctx.lineTo(x + bw, baseY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

registerStyle('rainbow-bars', 'Rainbow Bars', drawRainbowBars);
