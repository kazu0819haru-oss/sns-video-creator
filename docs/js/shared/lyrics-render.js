// Canvas 上に歌詞を描画する関数群（既存ロジックを移植）
export function drawLyrics(ctx, W, H, lyricsData, currentTime, opts = {}) {
  if (!opts.enabled) return;
  const idx = lyricsData.getCurrentIndex(currentTime);
  if (idx < 0) return;
  const text = lyricsData.all[idx].text;
  if (!text) return; // 間奏マーカー

  const fontSize = Math.round(H * (opts.fontSize || 0.026));
  const cx = W / 2;
  const cy = H * (opts.y || 0.5);
  ctx.save();
  ctx.font = `400 ${fontSize}px "${opts.font || 'Shippori Mincho B1'}", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 1)';
  ctx.shadowBlur = opts.shadow || 18;
  ctx.fillStyle = opts.color || 'rgba(255, 255, 255, 0.95)';
  ctx.fillText(text, cx, cy);
  ctx.shadowBlur = (opts.shadow || 18) / 3;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}
