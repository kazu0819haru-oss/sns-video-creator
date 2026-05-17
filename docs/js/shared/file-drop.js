// ファイル種別を拡張子と MIME タイプから判定
const AUDIO_EXT = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
const LRC_EXT = ['.lrc', '.txt'];
const VIDEO_EXT = ['.mp4', '.mov', '.webm', '.mkv', '.avi'];

export function getFileKind(file) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('video/') || VIDEO_EXT.some(ext => name.endsWith(ext))) return 'video';
  if (file.type.startsWith('audio/') || AUDIO_EXT.some(ext => name.endsWith(ext))) return 'audio';
  if (LRC_EXT.some(ext => name.endsWith(ext))) return 'lrc';
  if (file.type.startsWith('image/')) return 'image';
  return 'unknown';
}

// 指定要素にドラッグ&ドロップを設定する。
// opts: { onAudio?, onLRC?, onImage?, overlay? (要素) }
// overlay は dragenter で .is-visible が付き、leave/drop で外れる。
export function attachFileDrop(targetEl, opts = {}) {
  let dragCounter = 0;

  targetEl.addEventListener('dragenter', e => {
    e.preventDefault();
    dragCounter++;
    if (opts.overlay) opts.overlay.classList.add('is-visible');
  });

  targetEl.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  targetEl.addEventListener('dragleave', e => {
    e.preventDefault();
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0 && opts.overlay) opts.overlay.classList.remove('is-visible');
  });

  targetEl.addEventListener('drop', e => {
    e.preventDefault();
    dragCounter = 0;
    if (opts.overlay) opts.overlay.classList.remove('is-visible');
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    for (const f of files) {
      const kind = getFileKind(f);
      if (kind === 'audio' && opts.onAudio) opts.onAudio(f);
      else if (kind === 'lrc' && opts.onLRC) opts.onLRC(f);
      else if (kind === 'image' && opts.onImage) opts.onImage(f);
      else if (kind === 'video' && opts.onVideo) opts.onVideo(f);
    }
  });
}

// ウィンドウ全体で「ドロップ先以外」の領域に落とした時にブラウザがファイルを開くのを防ぐ
export function installGlobalDropGuard() {
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => e.preventDefault());
}
