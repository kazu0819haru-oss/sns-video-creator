// SNS カードのテキストレコメンド集。
// それぞれ複数の選択肢を持ち、UI ではランダムに3件ずつローテーション表示する。

export const SUGGESTIONS = {
  introTitle: [
    '迷彩 — NiSSHëL',
    '▶ Now Playing',
    'NEW SINGLE',
    'LISTEN NOW',
    '◆ TRACK 01 ◆',
    'OUT NOW',
    '迷彩',
    '— 新曲リリース —',
    'PLAY ▶',
    'CHECK THIS',
  ],
  introSubtitle: [
    'NiSSHëL',
    '配信中 on Spotify / Apple Music',
    '2026 New Single',
    '最新曲',
    'バンド名 / Band Name',
    'Out Now on all platforms',
    'デジタル配信中',
    'EP「アルバム名」より',
    'クリックして全部聴く',
    '名古屋発バンド',
  ],
  outroTitle: [
    'Follow @username',
    'フル版はプロフから',
    'Listen Full Version',
    'チャンネル登録お願いします',
    'Subscribe & Like ❤',
    '続きはコチラ',
    'SHARE & FOLLOW',
    'いいね・保存お願いします',
    'もっと聴く →',
    'Stream Now',
  ],
  outroSubtitle: [
    '@your_handle',
    'Spotify · Apple Music · YouTube',
    '各種ストリーミング配信中',
    'DMでお気軽にどうぞ',
    'プロフィールリンクから',
    'Tap the link in bio',
    '次回作もお楽しみに',
    'SNS フォローよろしく',
    '#NiSSHëL #バンド',
    'ライブ情報はTwitterで',
  ],
  outroQRUrl: [
    'https://open.spotify.com/artist/',
    'https://music.apple.com/jp/artist/',
    'https://www.youtube.com/@',
    'https://www.tiktok.com/@',
    'https://www.instagram.com/',
  ],
};

// 配列からランダムに n 件を非重複でピック
export function pickRandom(arr, n) {
  const copy = arr.slice();
  const out = [];
  while (out.length < n && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}
