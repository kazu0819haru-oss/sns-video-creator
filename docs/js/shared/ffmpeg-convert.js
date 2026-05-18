// FFmpeg.wasm (シングルスレッド版) を使った WebM → MP4 変換。
// SharedArrayBuffer 不要のため、サーバー設定なしで動作する。
// 初回ロードは ~31MB の WASM ダウンロードが発生する（ブラウザキャッシュ有効）。

const CDN = 'https://cdn.jsdelivr.net/npm';
let _ffmpegInstance = null;
let _loadPromise = null;

async function _getFFmpeg() {
  if (_ffmpegInstance) return _ffmpegInstance;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    const { FFmpeg } = await import(`${CDN}/@ffmpeg/ffmpeg@0.12.6/dist/esm/index.js`);
    const { toBlobURL } = await import(`${CDN}/@ffmpeg/util@0.12.1/dist/esm/index.js`);

    const ffmpeg = new FFmpeg();
    const base = `${CDN}/@ffmpeg/core@0.12.4/dist/esm`;

    await ffmpeg.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    _ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return _loadPromise;
}

/**
 * WebM blob を MP4 blob に変換する。
 * @param {Blob} webmBlob - MediaRecorder が出力した WebM
 * @param {number} audioBitrate - 音声ビットレート (bps)
 * @param {function(number):void} onProgress - 0–100 の進捗コールバック
 * @returns {Promise<Blob>} MP4 blob
 */
export async function convertWebMToMP4(webmBlob, audioBitrate = 256_000, onProgress) {
  const ffmpeg = await _getFFmpeg();
  const { fetchFile } = await import(`${CDN}/@ffmpeg/util@0.12.1/dist/esm/index.js`);

  const abps = `${Math.round(audioBitrate / 1000)}k`;

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(Math.round(Math.min(1, Math.max(0, progress)) * 100));
  });

  await ffmpeg.writeFile('in.webm', await fetchFile(webmBlob));
  await ffmpeg.exec([
    '-i', 'in.webm',
    '-c:v', 'copy',        // 映像はコピー（再エンコードなし → 高速）
    '-c:a', 'aac',
    '-b:a', abps,
    '-movflags', '+faststart',
    'out.mp4',
  ]);

  const data = await ffmpeg.readFile('out.mp4');

  try { await ffmpeg.deleteFile('in.webm'); } catch (_) {}
  try { await ffmpeg.deleteFile('out.mp4'); } catch (_) {}

  return new Blob([data.buffer], { type: 'video/mp4' });
}
