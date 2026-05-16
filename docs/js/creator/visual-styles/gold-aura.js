import { registerStyle } from './registry.js';

function drawGoldAura(ctx, W, H, freq, time, bass, opts = {}) {
  const cx = W / 2;
  const cy = H / 2;
  const baseR = Math.min(W, H) * 0.22 * (1 + bass * 0.15);
  const jacketImg = opts.jacketImg;

  if (opts.showJacket && jacketImg && jacketImg.complete && jacketImg.naturalWidth) {
    const r = baseR * 0.78;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(jacketImg, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const layers = 5;
  for (let k = 0; k < layers; k++) {
    const t = k / (layers - 1);
    const offset = 0.92 + t * 0.45 + bass * 0.25;
    const r0 = baseR * offset;
    const r1 = baseR * (offset + 0.18);
    const grad = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
    const a = 0.18 * (1 - t) + 0.05 + bass * 0.2;
    grad.addColorStop(0, `rgba(255, 220, 120, 0)`);
    grad.addColorStop(0.5, `rgba(255, 200, 80, ${a})`);
    grad.addColorStop(1, `rgba(255, 160, 40, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  const bars = 200;
  const innerR = baseR + 6;
  const maxLen = Math.min(W, H) * 0.12;
  ctx.save();
  ctx.shadowColor = 'rgba(255, 200, 80, 0.9)';
  ctx.shadowBlur = 22 + bass * 80;
  for (let i = 0; i < bars; i++) {
    const v = (freq[i] || 0) / 255;
    const len = v * maxLen + 2;
    const ang = (i / bars) * Math.PI * 2;
    const x1 = cx + Math.cos(ang) * innerR;
    const y1 = cy + Math.sin(ang) * innerR;
    const x2 = cx + Math.cos(ang) * (innerR + len);
    const y2 = cy + Math.sin(ang) * (innerR + len);
    ctx.strokeStyle = `rgba(255, 220, 120, ${0.55 + v * 0.45})`;
    ctx.lineWidth = (Math.PI * 2 * innerR / bars) * 0.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

registerStyle('gold-aura', 'Gold Aura Ring', drawGoldAura);
