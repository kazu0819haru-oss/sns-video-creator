export function formatLRCTime(t) {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(2).padStart(5, '0');
  return `${String(m).padStart(2, '0')}:${s}`;
}

export function parseLRC(text) {
  const re = /\[(\d+):(\d+(?:\.\d+)?)\](.*)/g;
  const lines = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
    lines.push({ text: m[3].trim(), time });
  }
  lines.sort((a, b) => a.time - b.time);
  return lines;
}

export function buildLRC(lines) {
  return lines
    .filter(l => l.time !== null)
    .map(l => `[${formatLRCTime(l.time)}]${l.text}`)
    .join('\n');
}

import { saveBlob } from './session.js';

export async function downloadLRC(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  return await saveBlob(blob, filename);
}
