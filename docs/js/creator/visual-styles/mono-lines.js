import { registerStyle } from './registry.js';

function drawMonoLines(ctx, W, H, freq, time, bass, opts = {}) {
  const cx = W / 2;
  const cy = H / 2;
  const baseR = Math.min(W, H) * 0.24;
  const jacketImg = opts.jacketImg;

  if (opts.showJacket && jacketImg && jacketImg.complete && jacketImg.naturalWidth) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 0.92, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(jacketImg, cx - baseR, cy - baseR, baseR * 2, baseR * 2);
    ctx.restore();
  }

  const bars = 180;
  const innerR = baseR;
  const maxLen = Math.min(W, H) * 0.16;
  ctx.save();
  for (let i = 0; i < bars; i++) {
    const v = (freq[i * 2] || 0) / 255;
    const len = v * maxLen + 2;
    const ang = (i / bars) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(ang) * innerR;
    const y1 = cy + Math.sin(ang) * innerR;
    const x2 = cx + Math.cos(ang) * (innerR + len);
    const y2 = cy + Math.sin(ang) * (innerR + len);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 + v * 0.45})`;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

registerStyle('mono-lines', 'Mono Lines', drawMonoLines);
