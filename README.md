# Audio Visualizer

ブラウザだけで動くオーディオビジュアライザー。音源にビジュアルや歌詞同期を付けてSNSショート動画を作成できる。

## 機能

- 🎵 **Timing**: 歌詞貼り付け → 再生中にスペースキーでタイミング入力 → LRC書き出し
- 🎬 **Creator**: 音源＋LRCから縦動画（9:16 / 1:1 / 16:9）を作成、録画
- 🎨 4種のビジュアルスタイル（Red Frame / Rainbow Bars / Gold Aura / Mono Lines）
- 📝 歌詞オーバーレイ、間奏マーカー対応

## ローカルで動かす

### ワンクリック起動

| OS | やり方 |
|---|---|
| Windows | `start.bat` をダブルクリック |
| Mac / Linux | `./start.sh` を実行（初回のみ `chmod +x start.sh`） |

サーバー起動後、ブラウザが自動で `http://localhost:8000` を開きます。終了するときは黒い画面を閉じる。

### 手動で起動する場合

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

## 録画ファイル形式

ブラウザに応じて自動で最適な形式に書き出します:

- **Chrome / Edge / Safari（最新版）** → `.mp4`（H.264 + AAC、直接 SNS 投稿可能）
- **Firefox など WebCodecs 非対応** → `.webm`（VP9/VP8 + Opus）

### WebM から MP4 に変換したい場合（任意）

ffmpeg をインストールして:

```bash
ffmpeg -i input.webm -c:v libx264 -crf 18 -preset slow -c:a aac -b:a 192k -movflags +faststart output.mp4
```

## ライセンス

MIT
