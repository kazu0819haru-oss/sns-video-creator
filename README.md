# Audio Visualizer

ブラウザだけで動くオーディオビジュアライザー。音源にビジュアルや歌詞同期を付けてSNSショート動画を作成できる。

## 機能

- 🎵 **Timing**: 歌詞貼り付け → 再生中にスペースキーでタイミング入力 → LRC書き出し
- 🎬 **Creator**: 音源＋LRCから縦動画（9:16 / 1:1 / 16:9）を作成、録画
- 🎨 4種のビジュアルスタイル（Red Frame / Rainbow Bars / Gold Aura / Mono Lines）
- 📝 歌詞オーバーレイ、間奏マーカー対応

## ローカルで動かす

ES Modulesを使用しているため、ローカルサーバーが必要：

```bash
# Python の場合
cd docs && python -m http.server 8000

# Node.js の場合
npx serve docs/
```

ブラウザで `http://localhost:8000` を開く。

## GitHub Pages で公開する

1. GitHub で新規リポジトリ作成
2. このプロジェクトをプッシュ:
   ```bash
   git remote add origin https://github.com/<USER>/<REPO>.git
   git push -u origin main
   ```
3. リポジトリ Settings → Pages → Source を以下に設定:
   - Branch: `main`
   - Folder: `/docs`
4. 数分後、`https://<USER>.github.io/<REPO>/` で公開される

## 録画した動画を mp4 化（任意）

録画は WebM 形式で出力される（MP4直接出力は v2 計画中）。mp4 が必要な場合は ffmpeg:

```bash
ffmpeg -i input.webm -c:v libx264 -crf 18 -preset slow -c:a aac -b:a 192k -movflags +faststart output.mp4
```

## ライセンス

MIT
