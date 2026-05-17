# Plan 5: MP4 直接出力（WebCodecs + mp4-muxer）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development

**Goal:** Chrome / Edge / Safari の **WebCodecs API** と `mp4-muxer` ライブラリを使い、録画ファイルを直接 **MP4（H.264 + AAC）** で書き出す。非対応ブラウザ（Firefox 等）は従来通り WebM にフォールバック。

**Architecture:**
- `shared/mp4-recorder.js` — `MP4Recorder` クラス。Canvas からフレームを 30fps で取得 → `VideoEncoder` で H.264 へエンコード。`MediaStreamTrackProcessor` で音声 `AudioData` を取得 → `AudioEncoder` で AAC へ。両方を `mp4-muxer` で結合 → MP4 Blob。
- `creator/recorder.js` — 既存の `Recorder` クラスを内部ディスパッチャに変更。`isMP4Supported()` で WebCodecs 可用性を判定し、可能なら `MP4Recorder` に委譲、不可なら従来の `MediaRecorder`（WebM）。
- `creator/creator-tab.js` — `onStop(blob, format)` の `format` を見てファイル名拡張子を切り替え。

**Tech Stack:** Vanilla JS / WebCodecs API (`VideoEncoder` / `AudioEncoder` / `MediaStreamTrackProcessor` / `VideoFrame`) / `mp4-muxer` (CDN ESM import) / 既存 `MediaRecorder` API

---

## Task 1: `shared/mp4-recorder.js` を作成

**File:** `docs/js/shared/mp4-recorder.js`

- [ ] **Step 1:** ファイル作成

```js
// WebCodecs + mp4-muxer による MP4 録画。
// 非対応ブラウザでは isMP4Supported() が false を返し、呼び出し側は WebM にフォールバックする想定。

export async function isMP4Supported() {
  if (typeof VideoEncoder === 'undefined') return false;
  if (typeof AudioEncoder === 'undefined') return false;
  if (typeof MediaStreamTrackProcessor === 'undefined') return false;
  try {
    const vs = await VideoEncoder.isConfigSupported({
      codec: 'avc1.42E01F',
      width: 1080, height: 1920,
      framerate: 30,
      bitrate: 8_000_000,
    });
    if (!vs.supported) return false;
    const as = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      numberOfChannels: 2,
      sampleRate: 48000,
      bitrate: 192_000,
    });
    return as.supported === true;
  } catch (_) {
    return false;
  }
}

export class MP4Recorder {
  constructor() {
    this.isRecording = false;
    this.onStop = null;
    this.muxer = null;
    this.videoEncoder = null;
    this.audioEncoder = null;
    this.frameTimer = null;
    this.audioReader = null;
    this.startTimestamp = 0;
    this.frameCount = 0;
  }

  async start(canvas, audioStream) {
    const mux = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5/+esm');
    const { Muxer, ArrayBufferTarget } = mux;

    const W = canvas.width;
    const H = canvas.height;
    const fps = 30;

    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H },
      audio: { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 },
      fastStart: 'in-memory',
    });

    this.videoEncoder = new VideoEncoder({
      output: (chunk, meta) => this.muxer.addVideoChunk(chunk, meta),
      error: e => console.error('VideoEncoder error:', e),
    });
    this.videoEncoder.configure({
      codec: 'avc1.42E01F',
      width: W, height: H,
      framerate: fps,
      bitrate: 8_000_000,
    });

    this.audioEncoder = new AudioEncoder({
      output: (chunk, meta) => this.muxer.addAudioChunk(chunk, meta),
      error: e => console.error('AudioEncoder error:', e),
    });
    this.audioEncoder.configure({
      codec: 'mp4a.40.2',
      numberOfChannels: 2,
      sampleRate: 48000,
      bitrate: 192_000,
    });

    this.startTimestamp = performance.now();
    this.frameCount = 0;
    this.isRecording = true;

    this._captureFrames(canvas, fps);

    const audioTrack = audioStream.getAudioTracks()[0];
    if (audioTrack) {
      this._processAudio(audioTrack);
    }
  }

  _captureFrames(canvas, fps) {
    if (!this.isRecording) return;
    const elapsed = performance.now() - this.startTimestamp;
    const expectedFrames = Math.floor((elapsed * fps) / 1000);
    while (this.frameCount < expectedFrames) {
      const timestamp = Math.round((this.frameCount * 1_000_000) / fps);
      try {
        const frame = new VideoFrame(canvas, { timestamp });
        const keyFrame = this.frameCount % 60 === 0;
        this.videoEncoder.encode(frame, { keyFrame });
        frame.close();
      } catch (e) {
        console.error('frame encode error:', e);
        break;
      }
      this.frameCount++;
    }
    this.frameTimer = setTimeout(() => this._captureFrames(canvas, fps), 16);
  }

  async _processAudio(audioTrack) {
    const processor = new MediaStreamTrackProcessor({ track: audioTrack });
    this.audioReader = processor.readable.getReader();
    while (this.isRecording) {
      try {
        const { value: audioData, done } = await this.audioReader.read();
        if (done) break;
        if (!audioData) continue;
        try {
          this.audioEncoder.encode(audioData);
        } finally {
          audioData.close();
        }
      } catch (e) {
        console.error('audio read error:', e);
        break;
      }
    }
  }

  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;
    this._finalize().catch(e => {
      console.error('finalize error:', e);
      if (this.onStop) this.onStop(null);
    });
  }

  async _finalize() {
    if (this.frameTimer) {
      clearTimeout(this.frameTimer);
      this.frameTimer = null;
    }
    if (this.audioReader) {
      try { await this.audioReader.cancel(); } catch (_) {}
      this.audioReader = null;
    }
    try { await this.videoEncoder.flush(); } catch (_) {}
    try { await this.audioEncoder.flush(); } catch (_) {}
    this.muxer.finalize();
    const blob = new Blob([this.muxer.target.buffer], { type: 'video/mp4' });
    if (this.onStop) this.onStop(blob);
  }
}
```

- [ ] **Step 2:** コミット

```bash
cd "C:\Users\kazu0\Claude\Visualizer作成"
git add docs/js/shared/mp4-recorder.js
git commit -m "feat: add MP4Recorder using WebCodecs + mp4-muxer"
```

---

## Task 2: `creator/recorder.js` をディスパッチャに変更

**File:** `docs/js/creator/recorder.js`

- [ ] **Step 1:** ファイル全体を以下に置換

```js
// 録画のディスパッチャ。WebCodecs 対応なら MP4、非対応なら WebM (MediaRecorder)。
// onStop(blob, format) — format は 'mp4' | 'webm'
import { isMP4Supported, MP4Recorder } from '../shared/mp4-recorder.js';

export class Recorder {
  constructor() {
    this.isRecording = false;
    this.onStop = null;
    this.format = null;
    this._mp4 = null;
    this._mediaRecorder = null;
    this._chunks = [];
  }

  async start(canvas, audioStream) {
    if (await isMP4Supported()) {
      this.format = 'mp4';
      this._mp4 = new MP4Recorder();
      this._mp4.onStop = (blob) => {
        this.isRecording = false;
        if (this.onStop) this.onStop(blob, 'mp4');
      };
      try {
        await this._mp4.start(canvas, audioStream);
        this.isRecording = true;
      } catch (e) {
        console.error('MP4 start failed, falling back to WebM:', e);
        this._mp4 = null;
        this.format = 'webm';
        this._startWebM(canvas, audioStream);
      }
    } else {
      this.format = 'webm';
      this._startWebM(canvas, audioStream);
    }
  }

  _startWebM(canvas, audioStream) {
    const videoStream = canvas.captureStream(60);
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ]);
    this._chunks = [];

    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8,opus' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm' };
    }

    this._mediaRecorder = new MediaRecorder(combined, options);
    this._mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) this._chunks.push(e.data);
    };
    this._mediaRecorder.onstop = () => {
      const blob = new Blob(this._chunks, { type: 'video/webm' });
      this.isRecording = false;
      if (this.onStop) this.onStop(blob, 'webm');
    };
    this._mediaRecorder.start();
    this.isRecording = true;
  }

  stop() {
    if (!this.isRecording) return;
    if (this._mp4) {
      this._mp4.stop();
    } else if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      this._mediaRecorder.stop();
    }
  }
}
```

- [ ] **Step 2:** コミット

```bash
git add docs/js/creator/recorder.js
git commit -m "refactor: recorder dispatches to MP4 or WebM based on WebCodecs support"
```

---

## Task 3: `creator-tab.js` で format 対応

**File:** `docs/js/creator/creator-tab.js`

- [ ] **Step 1:** `recorder.onStop` の signature を変更

ファイルを Read して、現在の `recorder.onStop = async (blob) => { ... }` を見つける。次のように変更：

`async (blob) => {` を `async (blob, format) => {`

そして既存の：
```js
        const filename = `${state.trackTitle || 'visualizer'}-${formatStamp()}.webm`;
```
を以下に変更：
```js
        const ext = format || 'webm';
        const filename = `${state.trackTitle || 'visualizer'}-${formatStamp()}.${ext}`;
```

- [ ] **Step 2:** `recorder.start(...)` の呼び出しは同期のままで OK（内部で await されている）

確認のみ：
```js
recorder.start(canvas, audioGraph.destNode.stream);
```
このまま変更なし（新しい `start` は async だが await しなくても進行する）。

- [ ] **Step 3:** コミット

```bash
git add docs/js/creator/creator-tab.js
git commit -m "feat: use recording format (mp4/webm) for output filename extension"
```

---

## Task 4: README 更新

**File:** `README.md`

- [ ] **Step 1:** 「録画した動画を mp4 化」セクションを更新

既存：
```markdown
## 録画した動画を mp4 化（任意）

録画は WebM 形式で出力される（MP4直接出力は v2 計画中）。mp4 が必要な場合は ffmpeg:
```

以下に置換：
```markdown
## 録画ファイル形式

ブラウザに応じて自動で最適な形式に書き出します:

- **Chrome / Edge / Safari（最新版）** → `.mp4`（H.264 + AAC、直接 SNS 投稿可能）
- **Firefox など WebCodecs 非対応** → `.webm`（VP9/VP8 + Opus）

### WebM から MP4 へ変換（必要なら）

```
- [ ] **Step 2:** コミット

```bash
git add README.md
git commit -m "docs: update README for native MP4 output"
```

---

## Task 5: スモークテスト

- [ ] **Step 1:** 構文チェック

```bash
cd "C:\Users\kazu0\Claude\Visualizer作成"
node --check docs/js/shared/mp4-recorder.js
node --check docs/js/creator/recorder.js
node --check docs/js/creator/creator-tab.js
```

- [ ] **Step 2:** HTTP 確認

```bash
cd docs && python -m http.server 8765 &
sleep 2
curl -s -o /dev/null -w "%{http_code} mp4-recorder\n" http://localhost:8765/js/shared/mp4-recorder.js
curl -s -o /dev/null -w "%{http_code} recorder\n" http://localhost:8765/js/creator/recorder.js
curl -s -o /dev/null -w "%{http_code} index\n" http://localhost:8765/
for pid in $(netstat -ano | grep ':8765' | grep LISTEN | awk '{print $5}' | sort -u); do taskkill /F /PID $pid 2>/dev/null; done
```

- [ ] **Step 3:** 目視確認（Chrome/Edge）

- [ ] 音源を読み込み → 「● 録画」を押す → 数秒後に停止
- [ ] ダウンロード（またはセッションフォルダ）に **`.mp4`** が保存される
- [ ] DevTools コンソールでエラーが出ていない
- [ ] 保存された MP4 ファイルをプレイヤーで開き、音声と映像が同期している
- [ ] Firefox など対応してないブラウザでは `.webm` で保存される

---

## 完了基準

- [x] WebCodecs 対応ブラウザで MP4 直接出力
- [x] 非対応ブラウザは WebM フォールバック
- [x] ファイル名拡張子が自動切替
- [x] 構文 OK・HTTP 200

Plan 5 完了で **全 5 プラン完了**。全機能まとめてブラウザで動作確認する段階に入る。
