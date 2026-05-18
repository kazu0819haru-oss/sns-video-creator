// audioBitrate は Chrome の AAC エンコーダー上限 192,000 bps に合わせる
export const QUALITY_PRESETS = [
  { id: 'low',    label: '低    (4 Mbps / 30fps)',   videoBitrate:  4_000_000, audioBitrate: 128_000, fps: 30 },
  { id: 'medium', label: '標準  (8 Mbps / 30fps)',   videoBitrate:  8_000_000, audioBitrate: 160_000, fps: 30 },
  { id: 'high',   label: '高   (16 Mbps / 60fps)',   videoBitrate: 16_000_000, audioBitrate: 192_000, fps: 60 },
  { id: 'ultra',  label: '最高 (20 Mbps / 60fps)',   videoBitrate: 20_000_000, audioBitrate: 192_000, fps: 60 },
];

export const DEFAULT_QUALITY_ID = 'high';

export function getQualityById(id) {
  return QUALITY_PRESETS.find(q => q.id === id) ?? QUALITY_PRESETS[2];
}
