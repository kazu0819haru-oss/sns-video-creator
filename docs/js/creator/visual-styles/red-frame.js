import { registerStyle } from './registry.js';

function drawRedFrame(ctx, W, H, freq, time, bass, opts = {}) {
  const cx = W / 2;
  const cy = H / 2;
  const baseR = Math.min(W, H) * 0.26;
  const jacketImg = opts.jacketImg;

  if (opts.showJacket && jacketImg && jacketImg.complete && jacketImg.naturalWidth) {
    const r = baseR;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(jacketImg, cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const bars = 160;
  const innerR = baseR + 6;
  const maxLen = Math.min(W, H) * 0.18;
  ctx.save();
  ctx.shadowColor = 'rgba(229, 30, 48, 0.85)';
  ctx.shadowBlur = 18 + bass * 60;
  for (let i = 0; i < bars; i++) {
    const v = (freq[i * 2] || 0) / 255;
    const len = Math.max(2, v * maxLen + 4);
    const ang = (i / bars) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(ang) * innerR;
    const y1 = cy + Math.sin(ang) * innerR;
    const x2 = cx + Math.cos(ang) * (innerR + len);
    const y2 = cy + Math.sin(ang) * (innerR + len);
    ctx.strokeStyle = `rgba(229, 30, 48, ${0.75 + v * 0.25})`;
    ctx.lineWidth = (Math.PI * 2 * innerR / bars) * 0.55;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();

  const yMid = H * 0.78;
  const amp = H * 0.06 * (1 + bass * 0.5);
  ctx.save();
  const N = time.length;
  const layers = [{ a: 0.9, o: 0, m: 1 }, { a: 0.28, o: 18, m: 0.6 }, { a: 0.12, o: 36, m: 0.4 }];
  for (const L of layers) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${L.a})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * W;
      const v = (time[i] - 128) / 128;
      const y = yMid + L.o + (L.o === 0 ? v * amp : -v * amp * L.m);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

registerStyle('red-frame', 'Red Frame + Wave', drawRedFrame);
