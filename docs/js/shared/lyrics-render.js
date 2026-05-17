// Canvas 上に歌詞を描画する関数群。
// opts:
//   enabled, currentLineIdx, lineStartTime, currentTime
//   font: CSS font-family 文字列
//   weight: font-weight
//   color: 文字色 (hex / rgba)
//   sizeScale: 標準比に対するスケール (1.0 がデフォルト)
//   x, y: 位置（0-1 のパーセンテージ）
//   shadow: シャドウ強度 (0-40)
//   background: 'none' | 'bar' | 'blur'
//   effect: 'none' | 'fade' | 'slide' | 'typewriter' | 'glow' | 'colorshift'
//   bass: 0-1 (glow/colorshift で使用)
export function drawLyrics(ctx, W, H, lyricsData, opts = {}) {
  if (!opts.enabled) return;
  const idx = opts.currentLineIdx ?? lyricsData.getCurrentIndex(opts.currentTime || 0);
  if (idx < 0) return;
  const line = lyricsData.all[idx];
  if (!line || !line.text) return; // 間奏マーカー

  const baseSize = Math.round(H * 0.026 * (opts.sizeScale ?? 1));
  const cx = W * (opts.x ?? 0.5);
  const cy = H * (opts.y ?? 0.5);
  const font = opts.font || '"Shippori Mincho B1", serif';
  const weight = opts.weight ?? 400;
  const shadowBlur = opts.shadow ?? 18;

  // エフェクト進行（行の経過時間）
  const lineStart = opts.lineStartTime ?? 0;
  const elapsed = Math.max(0, (opts.currentTime ?? 0) - lineStart);

  // 表示テキストとエフェクトパラメータ
  let displayText = line.text;
  let alpha = 1;
  let yOffset = 0;
  let extraGlow = 0;
  let color = opts.color || 'rgba(255,255,255,0.95)';

  switch (opts.effect) {
    case 'fade': {
      const dur = 0.4;
      alpha = Math.min(1, elapsed / dur);
      break;
    }
    case 'slide': {
      const dur = 0.45;
      const t = Math.min(1, elapsed / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      alpha = ease;
      yOffset = (1 - ease) * baseSize * 0.8;
      break;
    }
    case 'typewriter': {
      const charsPerSec = 24;
      const n = Math.min(displayText.length, Math.floor(elapsed * charsPerSec));
      displayText = displayText.slice(0, n);
      break;
    }
    case 'glow': {
      const bass = opts.bass ?? 0;
      extraGlow = bass * 30;
      break;
    }
    case 'colorshift': {
      const t = (opts.currentTime ?? 0) * 0.3;
      const hue = (Math.sin(t) * 0.5 + 0.5) * 360;
      color = `hsl(${hue.toFixed(0)}, 90%, 80%)`;
      break;
    }
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${baseSize}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // テキスト背景
  if (opts.background && opts.background !== 'none') {
    const metrics = ctx.measureText(displayText);
    const padX = baseSize * 0.6;
    const padY = baseSize * 0.35;
    const w = metrics.width + padX * 2;
    const h = baseSize + padY * 2;
    const bx = cx - w / 2;
    const by = cy + yOffset - h / 2;
    if (opts.background === 'bar') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, bx, by, w, h, baseSize * 0.2);
      ctx.fill();
    } else if (opts.background === 'blur') {
      ctx.save();
      ctx.filter = 'blur(8px)';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(ctx, bx - 8, by - 8, w + 16, h + 16, baseSize * 0.3);
      ctx.fill();
      ctx.restore();
    }
  }

  if (opts.vertical) {
    drawVerticalText(ctx, displayText, cx, cy + yOffset, baseSize, color, shadowBlur + extraGlow, opts.background);
  } else {
    ctx.shadowColor = 'rgba(0,0,0,1)';
    ctx.shadowBlur = shadowBlur + extraGlow;
    ctx.fillStyle = color;
    ctx.fillText(displayText, cx, cy + yOffset);
    ctx.shadowBlur = (shadowBlur + extraGlow) / 3;
    ctx.fillText(displayText, cx, cy + yOffset);
  }
  ctx.restore();
}

// 縦書きヘルパー: 文字を1文字ずつ縦に積む
function drawVerticalText(ctx, text, cx, cyCenter, charSize, color, shadowBlur, bgMode) {
  const chars = [...text];
  if (chars.length === 0) return;
  const lineHeight = charSize * 1.05;
  const startY = cyCenter - ((chars.length - 1) * lineHeight) / 2;

  // 背景帯（縦長）
  if (bgMode === 'bar' || bgMode === 'blur') {
    const padX = charSize * 0.5;
    const padY = charSize * 0.4;
    const w = charSize + padX * 2;
    const h = chars.length * lineHeight + padY * 2 - lineHeight + charSize;
    const bx = cx - w / 2;
    const by = startY - charSize / 2 - padY;
    if (bgMode === 'bar') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, bx, by, w, h, charSize * 0.25);
      ctx.fill();
    } else {
      ctx.save();
      ctx.filter = 'blur(8px)';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(ctx, bx - 8, by - 8, w + 16, h + 16, charSize * 0.3);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.shadowColor = 'rgba(0,0,0,1)';
  ctx.shadowBlur = shadowBlur;
  ctx.fillStyle = color;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, startY + i * lineHeight);
  }
  ctx.shadowBlur = shadowBlur / 3;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, startY + i * lineHeight);
  }
}

// タイトルやバンド名を1行のテキストとして描画する汎用関数
export function drawTextLine(ctx, W, H, text, opts = {}) {
  if (!text) return;
  const baseSize = Math.round(H * 0.026 * (opts.sizeScale ?? 1));
  const cx = W * (opts.x ?? 0.5);
  const cy = H * (opts.y ?? 0.065);
  const font = opts.font || '"Shippori Mincho B1", serif';
  const weight = opts.weight ?? 500;
  const shadowBlur = opts.shadow ?? 14;

  ctx.save();
  ctx.font = `${weight} ${baseSize}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (opts.background && opts.background !== 'none') {
    const metrics = ctx.measureText(text);
    const padX = baseSize * 0.6;
    const padY = baseSize * 0.35;
    const w = metrics.width + padX * 2;
    const h = baseSize + padY * 2;
    const bx = cx - w / 2;
    const by = cy - h / 2;
    if (opts.background === 'bar') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, bx, by, w, h, baseSize * 0.2);
      ctx.fill();
    } else if (opts.background === 'blur') {
      ctx.save();
      ctx.filter = 'blur(8px)';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(ctx, bx - 8, by - 8, w + 16, h + 16, baseSize * 0.3);
      ctx.fill();
      ctx.restore();
    }
  }

  if (opts.vertical) {
    drawVerticalText(ctx, text, cx, cy, baseSize, opts.color || 'rgba(255,255,255,0.92)', shadowBlur, opts.background);
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = shadowBlur;
    ctx.fillStyle = opts.color || 'rgba(255,255,255,0.92)';
    ctx.fillText(text, cx, cy);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
