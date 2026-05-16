import { drawLyrics } from '../shared/lyrics-render.js';

export function drawOverlay(ctx, W, H, opts) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';

  const songT = opts.songTitle?.trim() || '';
  const bandN = opts.bandName?.trim() || '';

  if (songT || bandN) {
    ctx.shadowBlur = 14;
    if (songT) {
      ctx.font = `500 ${Math.round(H * 0.026)}px "Shippori Mincho B1", serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fillText(songT, W / 2, H * 0.065);
    }
    if (bandN) {
      ctx.font = `400 ${Math.round(H * 0.018)}px "Shippori Mincho B1", serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(bandN, W / 2, H * (songT ? 0.100 : 0.065));
    }
  }

  drawLyrics(ctx, W, H, opts.lyricsData, opts.currentTime, {
    enabled: opts.showLyrics,
    y: opts.lyricsY ?? 0.5,
  });

  if (opts.showTrackTitle && opts.trackTitle && !songT && !bandN) {
    const hasLyrics = opts.showLyrics && opts.lyricsData.all.some(l => l.time !== null);
    ctx.font = `500 ${Math.round(H * (hasLyrics ? 0.018 : 0.026))}px "Shippori Mincho B1", serif`;
    ctx.shadowBlur = 10;
    ctx.fillStyle = hasLyrics ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(opts.trackTitle, W / 2, H * (hasLyrics ? 0.92 : 0.88));
  }

  ctx.restore();
}
