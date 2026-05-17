// SNS プラットフォーム別の推奨設定。
// safeZones は Canvas 上の領域ではなく、プレビュー用 DOM オーバーレイのレイアウト指示（％単位）。
//   { top, bottom, left, right } で「画面端からの干渉ゾーン」を表す。
//   recording に含まれないので Canvas には描画しない。
export const PRESETS = [
  {
    id: 'tiktok',
    label: 'TikTok',
    icon: '🎵',
    aspect: '9:16',
    width: 1080, height: 1920,
    durationLimit: 60,
    safeZones: { top: 8, bottom: 18, left: 0, right: 18 },
    note: '60秒以内推奨。下部UI（ボタン群）と右側UIに干渉しないよう注意。',
  },
  {
    id: 'reels',
    label: 'Instagram Reels',
    icon: '📸',
    aspect: '9:16',
    width: 1080, height: 1920,
    durationLimit: 90,
    safeZones: { top: 10, bottom: 22, left: 0, right: 22 },
    note: '90秒以内推奨。右側UI（いいね・コメント）と下部キャプション領域あり。',
  },
  {
    id: 'shorts',
    label: 'YouTube Shorts',
    icon: '▶️',
    aspect: '9:16',
    width: 1080, height: 1920,
    durationLimit: 60,
    safeZones: { top: 6, bottom: 20, left: 0, right: 14 },
    note: '60秒以内推奨。下部にショート操作UI、右側に拡張UI領域。',
  },
  {
    id: 'ig-feed',
    label: 'Instagram Feed',
    icon: '🖼️',
    aspect: '1:1',
    width: 1080, height: 1080,
    durationLimit: null,
    safeZones: { top: 0, bottom: 0, left: 0, right: 0 },
    note: '正方形フィード投稿。フィード上はUI干渉なし。',
  },
  {
    id: 'youtube',
    label: 'YouTube（通常）',
    icon: '📺',
    aspect: '16:9',
    width: 1920, height: 1080,
    durationLimit: null,
    safeZones: { top: 0, bottom: 12, left: 0, right: 0 },
    note: '横動画。再生バー領域分の下部に注意。',
  },
];

export function getPresetById(id) {
  return PRESETS.find(p => p.id === id) || null;
}
