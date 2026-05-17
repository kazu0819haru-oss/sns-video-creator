import { drawLyrics, drawTextLine } from '../shared/lyrics-render.js';

// opts は CreatorTab から渡される全状態。
// {
//   title: { text, font, color, sizeScale, shadow, background, x, y, visible },
//   band:  { text, font, color, sizeScale, shadow, background, x, y, visible },
//   lyrics:{ enabled, font, color, sizeScale, shadow, background, x, y, effect,
//            currentLineIdx, lineStartTime },
//   currentTime, lyricsData, bass,
//   logo (オプション・別途 drawLogo で描画されるためここでは扱わない)
// }
export function drawOverlay(ctx, W, H, opts) {
  ctx.save();

  // タイトル
  if (opts.title?.visible !== false && opts.title?.text) {
    drawTextLine(ctx, W, H, opts.title.text, {
      font: opts.title.font,
      color: opts.title.color,
      sizeScale: opts.title.sizeScale,
      shadow: opts.title.shadow,
      background: opts.title.background,
      x: opts.title.x,
      y: opts.title.y,
      weight: 500,
    });
  }

  // バンド名
  if (opts.band?.visible !== false && opts.band?.text) {
    drawTextLine(ctx, W, H, opts.band.text, {
      font: opts.band.font,
      color: opts.band.color,
      sizeScale: opts.band.sizeScale,
      shadow: opts.band.shadow,
      background: opts.band.background,
      x: opts.band.x,
      y: opts.band.y,
      weight: 400,
    });
  }

  // 歌詞
  drawLyrics(ctx, W, H, opts.lyricsData, {
    enabled: opts.lyrics?.enabled,
    font: opts.lyrics?.font,
    color: opts.lyrics?.color,
    sizeScale: opts.lyrics?.sizeScale,
    shadow: opts.lyrics?.shadow,
    background: opts.lyrics?.background,
    x: opts.lyrics?.x,
    y: opts.lyrics?.y,
    effect: opts.lyrics?.effect,
    currentLineIdx: opts.lyrics?.currentLineIdx,
    lineStartTime: opts.lyrics?.lineStartTime,
    currentTime: opts.currentTime,
    bass: opts.bass,
    weight: 400,
  });

  ctx.restore();
}
