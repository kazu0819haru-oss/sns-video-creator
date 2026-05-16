# Plan 1: 基盤リファクタ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の単一HTML/JSファイルをモジュール構造へ再編成し、Timing/Creatorの2タブUIとステップガイドを実装し、GitHub Pages公開可能な状態にする。

**Architecture:** ES Modules ベースでロジックを分割。`docs/` を公開ルートとし、`shared/`（共有モジュール）、`creator/`（動画作成系）、`timing/`（タイミング設定系）、`creator/visual-styles/`（スタイルレジストリ）に分類。既存機能（4スタイル・LRC・録画）は機能を変えずに移植する。

**Tech Stack:** Vanilla JS + ES Modules、Canvas API、Web Audio API、MediaRecorder API（WebM録画は維持。MP4化はPlan 4で対応）

---

## File Structure

完成後の構造：

```
Visualizer作成/
├── .gitignore
├── README.md
├── docs/                         # GitHub Pages 公開ルート
│   ├── index.html                # アプリ本体（タブUI）
│   ├── css/
│   │   ├── theme.css             # CSS変数・ベース・タイポグラフィ
│   │   └── ui.css                # UIコンポーネント
│   ├── js/
│   │   ├── app.js                # エントリポイント・タブ切り替え
│   │   ├── shared/
│   │   │   ├── audio.js          # AudioContext生成・グラフ管理
│   │   │   ├── lyrics-data.js    # 歌詞配列のCRUD（パース・タイミング操作）
│   │   │   ├── lyrics-render.js  # キャンバスへの歌詞描画
│   │   │   └── lrc.js            # LRC import/export
│   │   ├── timing/
│   │   │   └── timing-tab.js     # Timingタブのロジック
│   │   ├── creator/
│   │   │   ├── creator-tab.js    # Creatorタブのロジック
│   │   │   ├── recorder.js       # 録画ロジック（WebMのまま）
│   │   │   ├── particles.js      # 粒子エフェクト
│   │   │   ├── overlay.js        # タイトル・歌詞のオーバーレイ描画
│   │   │   └── visual-styles/
│   │   │       ├── registry.js   # スタイルレジストリ
│   │   │       ├── red-frame.js
│   │   │       ├── rainbow-bars.js
│   │   │       ├── gold-aura.js
│   │   │       └── mono-lines.js
│   │   └── ui/
│   │       └── step-guide.js     # ステップガイドバー
│   └── assets/                   # （将来用、空でOK）
└── docs/superpowers/             # 設計・計画書（公開対象外、リポジトリには残す）
```

**重要：** ES Modules は `file://` プロトコルでは動作しない（CORS制限）。ローカル動作確認には `npx serve docs/` または `python -m http.server` を `docs/` 内で起動する。

---

## Phase 1: Git 初期化と基盤セットアップ

### Task 1: Git初期化と .gitignore

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: 現在のディレクトリ状態を確認**

Run: `cd "C:\Users\kazu0\Claude\Visualizer作成" && git status 2>&1 || echo "not a git repo"`
Expected: "not a git repo" もしくは既存git管理状態

- [ ] **Step 2: Git初期化**

Run: `cd "C:\Users\kazu0\Claude\Visualizer作成" && git init -b main`
Expected: "Initialized empty Git repository"

- [ ] **Step 3: .gitignore を作成**

ファイル: `.gitignore`
```
.superpowers/
node_modules/
*.log
.DS_Store
Thumbs.db
*.webm
*.mp4
*.wav
*.mp3
```

- [ ] **Step 4: 初回コミット（既存ファイル）**

Run:
```bash
git add .gitignore README.md visualizer.html visualizer.js
git commit -m "chore: initial commit with existing visualizer files"
```
Expected: コミット成功

---

### Task 2: docs/ ディレクトリ骨格作成

**Files:**
- Create: `docs/css/theme.css`
- Create: `docs/css/ui.css`
- Create: `docs/index.html` (最小骨格)
- Create: `docs/js/app.js` (最小骨格)

- [ ] **Step 1: ディレクトリ作成**

Run:
```bash
mkdir -p docs/css docs/js/shared docs/js/timing docs/js/creator/visual-styles docs/js/ui docs/assets
```

- [ ] **Step 2: theme.css を作成（CSS変数・ベース）**

ファイル: `docs/css/theme.css`
```css
:root {
  /* Palette */
  --bg-0: #0a0a0a;
  --bg-1: #141414;
  --bg-2: rgba(255, 255, 255, 0.04);
  --bg-3: rgba(255, 255, 255, 0.07);
  --border: rgba(255, 255, 255, 0.1);
  --border-strong: rgba(255, 255, 255, 0.2);
  --fg: #ffffff;
  --fg-muted: rgba(255, 255, 255, 0.6);
  --fg-faint: rgba(255, 255, 255, 0.35);
  --accent: #1a9d52;
  --accent-soft: #4ec07d;
  --danger: #e53e3e;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-pill: 999px;
  --shadow-lg: 0 10px 40px rgba(0, 0, 0, 0.5);
  /* Fonts */
  --font-ui: 'Inter', 'Noto Sans JP', system-ui, sans-serif;
  --font-display: 'Anton', sans-serif;
  --font-serif: 'Shippori Mincho B1', serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100%;
  background: var(--bg-0);
  color: var(--fg);
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 3: ui.css を作成（UIコンポーネント、既存スタイルから抜粋して整形）**

ファイル: `docs/css/ui.css`
```css
body {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 20px;
  gap: 14px;
}

/* Tab Bar */
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  align-self: flex-start;
}
.tab {
  padding: 8px 18px;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.18s, color 0.18s;
}
.tab:hover { color: var(--fg); }
.tab.is-active {
  background: var(--bg-3);
  color: var(--fg);
}

/* Tab Panels */
.tab-panel { display: none; flex-direction: column; gap: 14px; flex: 1; min-height: 0; }
.tab-panel.is-active { display: flex; }

/* Toolbar */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(8px);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--bg-3);
  color: var(--fg);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.18s, transform 0.05s;
}
.btn:hover { background: rgba(255, 255, 255, 0.14); }
.btn:active { transform: translateY(1px); }
.btn:disabled { opacity: 0.35; cursor: not-allowed; }
.btn--primary { background: var(--accent); border-color: var(--accent); }
.btn--primary:hover { background: var(--accent-soft); }
.btn--rec { background: var(--danger); border-color: var(--danger); }
.btn--rec.is-recording { animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

/* Selects, inputs */
.select, .text-input {
  padding: 8px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--bg-3);
  color: var(--fg);
  font-size: 13px;
  outline: none;
}
.text-input:focus { border-color: var(--accent); }

/* Stage / Canvas */
.stage { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
.canvas-wrap {
  position: relative;
  background: #000;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  aspect-ratio: 9/16;
  height: 100%;
  max-height: calc(100vh - 280px);
}
.canvas-wrap[data-aspect="1:1"] { aspect-ratio: 1/1; }
.canvas-wrap[data-aspect="16:9"] { aspect-ratio: 16/9; }
canvas { display: block; width: 100%; height: 100%; }

/* Drop overlay */
.drop {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 14px;
  padding: 24px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  pointer-events: none;
  transition: opacity 0.3s;
}
.drop.is-hidden { opacity: 0; }
.drop h2 { font-family: var(--font-display); font-size: 36px; letter-spacing: 0.06em; }
.drop p { color: var(--fg-muted); font-size: 14px; line-height: 1.6; }
.drop .pill { padding: 8px 16px; background: var(--accent); border-radius: var(--radius-pill); font-weight: 700; font-size: 13px; }

/* Seek bar */
.seekrow { display: flex; align-items: center; gap: 10px; padding: 0 4px; }
.seek-bar {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  border-radius: 2px;
  background: var(--border-strong);
  cursor: pointer;
  accent-color: var(--accent);
  outline: none;
}
.seek-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}
.seek-bar:disabled { opacity: 0.3; cursor: not-allowed; }
.meta { font-size: 12px; color: var(--fg-muted); }

/* Step guide */
.step-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  font-size: 13px;
}
.step-item { display: flex; align-items: center; gap: 6px; opacity: 0.35; }
.step-item.is-active { opacity: 1; color: var(--accent-soft); font-weight: 600; }
.step-item.is-done { opacity: 0.65; }
.step-item.is-done .step-num { background: var(--accent); }
.step-num {
  background: var(--border-strong);
  color: var(--fg);
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
}
.step-item.is-active .step-num { background: var(--accent); }
.step-sep { color: var(--fg-faint); }

/* Lyrics panel (再利用) */
.panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--bg-2);
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
}
.panel-header h3 { font-size: 13px; font-weight: 600; color: var(--fg-muted); letter-spacing: 0.04em; }
.panel-body { display: none; flex-direction: column; gap: 10px; padding: 14px 16px; border-top: 1px solid var(--border); }
.panel-body.is-open { display: flex; }
```

- [ ] **Step 4: index.html を作成（最小骨格）**

ファイル: `docs/index.html`
```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Audio Visualizer</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;900&family=Noto+Sans+JP:wght@400;500;700;900&family=Shippori+Mincho+B1:wght@400;500;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="css/theme.css" />
<link rel="stylesheet" href="css/ui.css" />
</head>
<body>

<nav class="tab-bar">
  <button class="tab is-active" data-tab="timing">🎵 Timing</button>
  <button class="tab" data-tab="creator">🎬 Creator</button>
</nav>

<section class="tab-panel is-active" id="panel-timing">
  <div class="step-bar" id="step-bar-timing"></div>
  <p class="meta">Timing モードは別タスクで実装します。</p>
</section>

<section class="tab-panel" id="panel-creator">
  <div class="step-bar" id="step-bar-creator"></div>
  <p class="meta">Creator モードは別タスクで実装します。</p>
</section>

<script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 5: app.js を作成（タブ切替のみ）**

ファイル: `docs/js/app.js`
```js
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabs.forEach(b => b.classList.toggle('is-active', b === btn));
    panels.forEach(p => p.classList.toggle('is-active', p.id === `panel-${target}`));
  });
});
```

- [ ] **Step 6: ローカルサーバーで動作確認**

Run: `cd docs && python -m http.server 8000`
ブラウザで `http://localhost:8000` を開く。
Expected: タブが表示され、クリックで切り替わる。コンソールエラーなし。

- [ ] **Step 7: コミット**

```bash
git add docs/
git commit -m "feat: scaffold docs/ structure with tab UI"
```

---

## Phase 2: 共有モジュールの抽出

### Task 3: shared/audio.js — AudioContext管理

**Files:**
- Create: `docs/js/shared/audio.js`

- [ ] **Step 1: audio.js を作成**

ファイル: `docs/js/shared/audio.js`
```js
// 音声ファイルの読み込みと AudioContext グラフの管理を担当
export class AudioGraph {
  constructor() {
    this.audio = null;
    this.audioCtx = null;
    this.sourceNode = null;
    this.analyser = null;
    this.gainNode = null;
    this.destNode = null;
  }

  loadFile(file) {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    this.audio = new Audio();
    this.audio.src = URL.createObjectURL(file);
    this.audio.crossOrigin = 'anonymous';
    return this.audio;
  }

  setupGraph() {
    if (!this.audio) throw new Error('No audio loaded');
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (_) {}
    }
    this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.82;
    this.gainNode = this.audioCtx.createGain();
    this.destNode = this.audioCtx.createMediaStreamDestination();
    this.sourceNode.connect(this.analyser);
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.audioCtx.destination);
    this.gainNode.connect(this.destNode);
  }

  async resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  getFreqData() {
    if (!this.analyser) return new Uint8Array(1024);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  getTimeData() {
    if (!this.analyser) return new Uint8Array(1024);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  getBass() {
    const freq = this.getFreqData();
    let sum = 0;
    for (let i = 0; i < 16; i++) sum += freq[i];
    return sum / (16 * 255);
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/shared/audio.js
git commit -m "feat: extract AudioGraph shared module"
```

---

### Task 4: shared/lyrics-data.js — 歌詞配列管理

**Files:**
- Create: `docs/js/shared/lyrics-data.js`

- [ ] **Step 1: lyrics-data.js を作成**

ファイル: `docs/js/shared/lyrics-data.js`
```js
// 歌詞配列の CRUD。各エントリは { text, time }。
// text === '' のものは間奏マーカー（描画スキップ）。
export class LyricsData {
  constructor() {
    this.lines = [];
  }

  parseFromText(text) {
    const arr = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    this.lines = arr.map(t => ({ text: t, time: null }));
  }

  clearTimes() {
    this.lines.forEach(l => { l.time = null; });
  }

  setTime(idx, time) {
    if (idx >= 0 && idx < this.lines.length) {
      this.lines[idx].time = time;
    }
  }

  insertBlank(idx, time) {
    this.lines.splice(idx, 0, { text: '', time });
  }

  removeAt(idx) {
    this.lines.splice(idx, 1);
  }

  removeBlanksFrom(idx) {
    this.lines = this.lines.slice(0, idx).concat(
      this.lines.slice(idx).filter(l => l.text !== '')
    );
  }

  getCurrentIndex(currentTime) {
    let idx = -1;
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].time !== null && this.lines[i].time <= currentTime) {
        idx = i;
      }
    }
    return idx;
  }

  get length() { return this.lines.length; }
  get all() { return this.lines; }
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/shared/lyrics-data.js
git commit -m "feat: extract LyricsData shared module"
```

---

### Task 5: shared/lrc.js — LRC import/export

**Files:**
- Create: `docs/js/shared/lrc.js`

- [ ] **Step 1: lrc.js を作成**

ファイル: `docs/js/shared/lrc.js`
```js
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

export function downloadLRC(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/shared/lrc.js
git commit -m "feat: extract LRC import/export utility"
```

---

### Task 6: shared/lyrics-render.js — Canvas歌詞描画

**Files:**
- Create: `docs/js/shared/lyrics-render.js`

- [ ] **Step 1: lyrics-render.js を作成**

ファイル: `docs/js/shared/lyrics-render.js`
```js
// Canvas 上に歌詞を描画する関数群（既存ロジックを移植）
export function drawLyrics(ctx, W, H, lyricsData, currentTime, opts = {}) {
  if (!opts.enabled) return;
  const idx = lyricsData.getCurrentIndex(currentTime);
  if (idx < 0) return;
  const text = lyricsData.all[idx].text;
  if (!text) return; // 間奏マーカー

  const fontSize = Math.round(H * (opts.fontSize || 0.026));
  const cx = W / 2;
  const cy = H * (opts.y || 0.5);
  ctx.save();
  ctx.font = `400 ${fontSize}px "${opts.font || 'Shippori Mincho B1'}", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 1)';
  ctx.shadowBlur = opts.shadow || 18;
  ctx.fillStyle = opts.color || 'rgba(255, 255, 255, 0.95)';
  ctx.fillText(text, cx, cy);
  ctx.shadowBlur = (opts.shadow || 18) / 3;
  ctx.fillText(text, cx, cy);
  ctx.restore();
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/shared/lyrics-render.js
git commit -m "feat: extract lyrics-render shared module"
```

---

## Phase 3: スタイルレジストリと既存スタイル移植

### Task 7: visual-styles/registry.js

**Files:**
- Create: `docs/js/creator/visual-styles/registry.js`

- [ ] **Step 1: registry.js を作成**

ファイル: `docs/js/creator/visual-styles/registry.js`
```js
const REGISTRY = [];

export function registerStyle(id, label, drawFn) {
  REGISTRY.push({ id, label, drawFn });
}

export function getStyles() {
  return REGISTRY.slice();
}

export function getStyleById(id) {
  return REGISTRY.find(s => s.id === id);
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/creator/visual-styles/registry.js
git commit -m "feat: add visual style registry"
```

---

### Task 8: 4スタイルを個別ファイルに移植

**Files:**
- Create: `docs/js/creator/visual-styles/red-frame.js`
- Create: `docs/js/creator/visual-styles/rainbow-bars.js`
- Create: `docs/js/creator/visual-styles/gold-aura.js`
- Create: `docs/js/creator/visual-styles/mono-lines.js`

- [ ] **Step 1: red-frame.js を作成**

ファイル: `docs/js/creator/visual-styles/red-frame.js`
```js
import { registerStyle } from './registry.js';

// 引数: ctx, W, H, freqData, timeData, bass, opts (jacketImg等)
function drawRedFrame(ctx, W, H, freq, time, bass, opts = {}) {
  const cx = W / 2;
  const cy = H / 2;
  const baseR = Math.min(W, H) * 0.26;
  const jacketImg = opts.jacketImg;

  if (opts.showJacket && jacketImg && jacketImg.complete && jacketImg.naturalWidth) {
    const r = baseR;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(jacketImg, cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const bars = 160;
  const innerR = baseR + 6;
  const maxLen = Math.min(W, H) * 0.18;
  ctx.save();
  ctx.shadowColor = 'rgba(229, 30, 48, 0.85)';
  ctx.shadowBlur = 18 + bass * 60;
  for (let i = 0; i < bars; i++) {
    const v = (freq[i * 2] || 0) / 255;
    const len = Math.max(2, v * maxLen + 4);
    const ang = (i / bars) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(ang) * innerR;
    const y1 = cy + Math.sin(ang) * innerR;
    const x2 = cx + Math.cos(ang) * (innerR + len);
    const y2 = cy + Math.sin(ang) * (innerR + len);
    ctx.strokeStyle = `rgba(229, 30, 48, ${0.75 + v * 0.25})`;
    ctx.lineWidth = (Math.PI * 2 * innerR / bars) * 0.55;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();

  const yMid = H * 0.78;
  const amp = H * 0.06 * (1 + bass * 0.5);
  ctx.save();
  const N = time.length;
  const layers = [{ a: 0.9, o: 0, m: 1 }, { a: 0.28, o: 18, m: 0.6 }, { a: 0.12, o: 36, m: 0.4 }];
  for (const L of layers) {
    ctx.strokeStyle = `rgba(255, 255, 255, ${L.a})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * W;
      const v = (time[i] - 128) / 128;
      const y = yMid + L.o + (L.o === 0 ? v * amp : -v * amp * L.m);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

registerStyle('red-frame', 'Red Frame + Wave', drawRedFrame);
```

- [ ] **Step 2: rainbow-bars.js を作成**

ファイル: `docs/js/creator/visual-styles/rainbow-bars.js`
```js
import { registerStyle } from './registry.js';

function drawRainbowBars(ctx, W, H, freq, time, bass, opts = {}) {
  const jacketImg = opts.jacketImg;
  if (opts.showJacket && jacketImg && jacketImg.complete && jacketImg.naturalWidth) {
    const size = Math.min(W * 0.7, H * 0.45);
    const x = (W - size) / 2;
    const y = H * 0.13;
    ctx.save();
    ctx.shadowColor = 'rgba(255, 255, 255, 0.35)';
    ctx.shadowBlur = 30 + bass * 100;
    const r = 22;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + size, y, x + size, y + size, r);
    ctx.arcTo(x + size, y + size, x, y + size, r);
    ctx.arcTo(x, y + size, x, y, r);
    ctx.arcTo(x, y, x + size, y, r);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(jacketImg, x, y, size, size);
    ctx.restore();
  }

  const bars = 96;
  const margin = W * 0.04;
  const totalW = W - margin * 2;
  const slot = totalW / bars;
  const bw = slot * 0.68;
  const gap = slot - bw;
  const baseY = H * 0.92;
  const maxBarH = H * 0.32;
  ctx.save();
  for (let i = 0; i < bars; i++) {
    const v = (freq[i * 2] || 0) / 255;
    const h = v * maxBarH + 6;
    const x = margin + i * slot + gap / 2;
    const hue = 180 + (i / bars) * 160;
    const grad = ctx.createLinearGradient(0, baseY - h, 0, baseY);
    grad.addColorStop(0, `hsla(${hue}, 90%, 75%, 1)`);
    grad.addColorStop(1, `hsla(${hue}, 85%, 55%, 1)`);
    ctx.fillStyle = grad;
    const rr = Math.min(bw / 2, 6);
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x, baseY - h + rr);
    ctx.arcTo(x, baseY - h, x + rr, baseY - h, rr);
    ctx.lineTo(x + bw - rr, baseY - h);
    ctx.arcTo(x + bw, baseY - h, x + bw, baseY - h + rr, rr);
    ctx.lineTo(x + bw, baseY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

registerStyle('rainbow-bars', 'Rainbow Bars', drawRainbowBars);
```

- [ ] **Step 3: gold-aura.js を作成**

ファイル: `docs/js/creator/visual-styles/gold-aura.js`
```js
import { registerStyle } from './registry.js';

function drawGoldAura(ctx, W, H, freq, time, bass, opts = {}) {
  const cx = W / 2;
  const cy = H / 2;
  const baseR = Math.min(W, H) * 0.22 * (1 + bass * 0.15);
  const jacketImg = opts.jacketImg;

  if (opts.showJacket && jacketImg && jacketImg.complete && jacketImg.naturalWidth) {
    const r = baseR * 0.78;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(jacketImg, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const layers = 5;
  for (let k = 0; k < layers; k++) {
    const t = k / (layers - 1);
    const offset = 0.92 + t * 0.45 + bass * 0.25;
    const r0 = baseR * offset;
    const r1 = baseR * (offset + 0.18);
    const grad = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
    const a = 0.18 * (1 - t) + 0.05 + bass * 0.2;
    grad.addColorStop(0, `rgba(255, 220, 120, 0)`);
    grad.addColorStop(0.5, `rgba(255, 200, 80, ${a})`);
    grad.addColorStop(1, `rgba(255, 160, 40, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();

  const bars = 200;
  const innerR = baseR + 6;
  const maxLen = Math.min(W, H) * 0.12;
  ctx.save();
  ctx.shadowColor = 'rgba(255, 200, 80, 0.9)';
  ctx.shadowBlur = 22 + bass * 80;
  for (let i = 0; i < bars; i++) {
    const v = (freq[i] || 0) / 255;
    const len = v * maxLen + 2;
    const ang = (i / bars) * Math.PI * 2;
    const x1 = cx + Math.cos(ang) * innerR;
    const y1 = cy + Math.sin(ang) * innerR;
    const x2 = cx + Math.cos(ang) * (innerR + len);
    const y2 = cy + Math.sin(ang) * (innerR + len);
    ctx.strokeStyle = `rgba(255, 220, 120, ${0.55 + v * 0.45})`;
    ctx.lineWidth = (Math.PI * 2 * innerR / bars) * 0.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

registerStyle('gold-aura', 'Gold Aura Ring', drawGoldAura);
```

- [ ] **Step 4: mono-lines.js を作成**

ファイル: `docs/js/creator/visual-styles/mono-lines.js`
```js
import { registerStyle } from './registry.js';

function drawMonoLines(ctx, W, H, freq, time, bass, opts = {}) {
  const cx = W / 2;
  const cy = H / 2;
  const baseR = Math.min(W, H) * 0.24;
  const jacketImg = opts.jacketImg;

  if (opts.showJacket && jacketImg && jacketImg.complete && jacketImg.naturalWidth) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR * 0.92, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(jacketImg, cx - baseR, cy - baseR, baseR * 2, baseR * 2);
    ctx.restore();
  }

  const bars = 180;
  const innerR = baseR;
  const maxLen = Math.min(W, H) * 0.16;
  ctx.save();
  for (let i = 0; i < bars; i++) {
    const v = (freq[i * 2] || 0) / 255;
    const len = v * maxLen + 2;
    const ang = (i / bars) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(ang) * innerR;
    const y1 = cy + Math.sin(ang) * innerR;
    const x2 = cx + Math.cos(ang) * (innerR + len);
    const y2 = cy + Math.sin(ang) * (innerR + len);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 + v * 0.45})`;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

registerStyle('mono-lines', 'Mono Lines', drawMonoLines);
```

- [ ] **Step 5: コミット**

```bash
git add docs/js/creator/visual-styles/
git commit -m "feat: migrate 4 visual styles to registry pattern"
```

---

### Task 9: creator/particles.js — 粒子モジュール

**Files:**
- Create: `docs/js/creator/particles.js`

- [ ] **Step 1: particles.js を作成**

ファイル: `docs/js/creator/particles.js`
```js
export class Particles {
  constructor() {
    this.particles = [];
  }

  init(W, H) {
    const n = Math.round((W * H) / 14000);
    this.particles = [];
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.3,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        a: Math.random() * 0.6 + 0.2,
        tw: Math.random() * Math.PI * 2,
      });
    }
  }

  draw(ctx, W, H, bass) {
    ctx.save();
    for (const p of this.particles) {
      p.x += p.vx + bass * 0.4;
      p.y += p.vy;
      p.tw += 0.02;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
      const alpha = p.a * (0.6 + 0.4 * Math.sin(p.tw)) * (0.6 + bass * 0.8);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 + bass * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/creator/particles.js
git commit -m "feat: extract particles module"
```

---

### Task 10: creator/overlay.js — タイトル・歌詞オーバーレイ

**Files:**
- Create: `docs/js/creator/overlay.js`

- [ ] **Step 1: overlay.js を作成**

ファイル: `docs/js/creator/overlay.js`
```js
import { drawLyrics } from '../shared/lyrics-render.js';

export function drawOverlay(ctx, W, H, opts) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';

  const songT = opts.songTitle?.trim() || '';
  const bandN = opts.bandName?.trim() || '';

  if (songT || bandN) {
    ctx.shadowBlur = 14;
    if (songT) {
      ctx.font = `500 ${Math.round(H * 0.026)}px "Shippori Mincho B1", serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fillText(songT, W / 2, H * 0.065);
    }
    if (bandN) {
      ctx.font = `400 ${Math.round(H * 0.018)}px "Shippori Mincho B1", serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(bandN, W / 2, H * (songT ? 0.100 : 0.065));
    }
  }

  drawLyrics(ctx, W, H, opts.lyricsData, opts.currentTime, {
    enabled: opts.showLyrics,
    y: opts.lyricsY ?? 0.5,
  });

  if (opts.showTrackTitle && opts.trackTitle && !songT && !bandN) {
    const hasLyrics = opts.showLyrics && opts.lyricsData.all.some(l => l.time !== null);
    ctx.font = `500 ${Math.round(H * (hasLyrics ? 0.018 : 0.026))}px "Shippori Mincho B1", serif`;
    ctx.shadowBlur = 10;
    ctx.fillStyle = hasLyrics ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.85)';
    ctx.fillText(opts.trackTitle, W / 2, H * (hasLyrics ? 0.92 : 0.88));
  }

  ctx.restore();
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/creator/overlay.js
git commit -m "feat: extract overlay module"
```

---

### Task 11: creator/recorder.js — 録画ロジック

**Files:**
- Create: `docs/js/creator/recorder.js`

- [ ] **Step 1: recorder.js を作成**

ファイル: `docs/js/creator/recorder.js`
```js
export class Recorder {
  constructor() {
    this.mediaRecorder = null;
    this.chunks = [];
    this.isRecording = false;
    this.onStop = null;
  }

  start(canvas, audioStream, downloadName) {
    const videoStream = canvas.captureStream(60);
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks(),
    ]);
    this.chunks = [];

    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8,opus' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm' };
    }

    this.mediaRecorder = new MediaRecorder(combined, options);
    this.mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (this.onStop) this.onStop();
    };
    this.mediaRecorder.start();
    this.isRecording = true;
  }

  stop() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.isRecording = false;
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/creator/recorder.js
git commit -m "feat: extract recorder module"
```

---

## Phase 4: ステップガイドUIコンポーネント

### Task 12: ui/step-guide.js

**Files:**
- Create: `docs/js/ui/step-guide.js`

- [ ] **Step 1: step-guide.js を作成**

ファイル: `docs/js/ui/step-guide.js`
```js
// ステップガイドバーの描画とステート管理
export class StepGuide {
  constructor(container, steps) {
    // steps: [{ id, label }, ...]
    this.container = container;
    this.steps = steps;
    this.currentIdx = 0;
    this.completed = new Set();
    this.render();
  }

  setCurrent(idx) {
    this.currentIdx = idx;
    this.render();
  }

  markDone(idx) {
    this.completed.add(idx);
    if (idx === this.currentIdx && this.currentIdx < this.steps.length - 1) {
      this.currentIdx++;
    }
    this.render();
  }

  reset() {
    this.currentIdx = 0;
    this.completed.clear();
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    this.steps.forEach((step, i) => {
      const item = document.createElement('div');
      item.className = 'step-item';
      if (i === this.currentIdx && !this.completed.has(i)) item.classList.add('is-active');
      if (this.completed.has(i)) item.classList.add('is-done');

      const num = document.createElement('div');
      num.className = 'step-num';
      num.textContent = this.completed.has(i) ? '✓' : String(i + 1);

      const label = document.createElement('span');
      label.textContent = step.label;

      item.appendChild(num);
      item.appendChild(label);
      this.container.appendChild(item);

      if (i < this.steps.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'step-sep';
        sep.textContent = '→';
        this.container.appendChild(sep);
      }
    });
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/ui/step-guide.js
git commit -m "feat: add step guide UI component"
```

---

## Phase 5: Timing タブ実装

### Task 13: timing/timing-tab.js + index.html 更新

**Files:**
- Create: `docs/js/timing/timing-tab.js`
- Modify: `docs/index.html`
- Modify: `docs/js/app.js`

- [ ] **Step 1: index.html の Timing パネル中身を作成**

`docs/index.html` の `<section class="tab-panel is-active" id="panel-timing">` を以下に置き換える：

```html
<section class="tab-panel is-active" id="panel-timing">
  <div class="step-bar" id="step-bar-timing"></div>

  <div class="toolbar">
    <h1 style="font-family:var(--font-display);font-size:18px;letter-spacing:0.06em">Timing Editor</h1>
    <input type="file" id="t-audio-input" accept="audio/*" hidden />
    <button class="btn" id="t-pick-btn">音源を選択</button>
    <button class="btn btn--primary" id="t-play-btn" disabled>▶ 再生</button>
    <button class="btn" id="t-timing-btn" disabled style="background:#6d28d9;border-color:#6d28d9;">⬤ タイミング入力</button>
    <button class="btn" id="t-reset-btn">リセット</button>
    <input type="file" id="t-lrc-input" accept=".lrc,.txt" hidden />
    <button class="btn" id="t-import-lrc-btn">↑ LRC 読み込み</button>
    <button class="btn" id="t-export-lrc-btn" disabled>↓ LRC 書き出し</button>
    <div style="flex:1"></div>
    <span class="meta" id="t-meta">未読込</span>
  </div>

  <div class="seekrow">
    <span class="meta" id="t-cur-time">0:00</span>
    <input type="range" id="t-seek-bar" class="seek-bar" min="0" max="100" step="0.1" value="0" disabled />
    <span class="meta" id="t-tot-time">0:00</span>
  </div>

  <div class="panel">
    <div class="panel-header">
      <h3>歌詞 / タイミング入力</h3>
    </div>
    <div class="panel-body is-open">
      <div class="meta" style="line-height:1.7">
        ① 歌詞を貼り付け → ② 音源を選択 → ③ 「タイミング入力」を押して再生 →
        各行の歌い始めで <kbd style="background:var(--bg-3);border:1px solid var(--border);padding:1px 6px;border-radius:4px">Space</kbd>
        / 間奏は <kbd style="background:var(--bg-3);border:1px solid var(--border);padding:1px 6px;border-radius:4px">Enter</kbd>
        / 戻る <kbd style="background:var(--bg-3);border:1px solid var(--border);padding:1px 6px;border-radius:4px">←</kbd>
      </div>
      <textarea id="t-lyrics-input" placeholder="歌詞をここに貼り付け" style="background:var(--bg-3);border:1px solid var(--border);border-radius:8px;color:var(--fg);padding:10px 12px;font-size:13px;font-family:'Noto Sans JP',sans-serif;line-height:1.8;resize:vertical;min-height:120px"></textarea>
      <div id="t-timing-status" style="display:none;background:rgba(229,30,48,0.1);border:1px solid rgba(229,30,48,0.3);border-radius:10px;padding:12px 16px">
        <div class="meta">♪ 次にスタンプ <span id="t-timing-progress"></span></div>
        <div id="t-timing-current-line" style="font-size:17px;font-weight:700;line-height:1.5;margin-top:6px"></div>
      </div>
      <div id="t-lyric-line-list" style="display:flex;flex-direction:column;gap:2px;max-height:200px;overflow-y:auto"></div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: timing-tab.js を作成**

ファイル: `docs/js/timing/timing-tab.js`
```js
import { AudioGraph } from '../shared/audio.js';
import { LyricsData } from '../shared/lyrics-data.js';
import { formatLRCTime, parseLRC, buildLRC, downloadLRC } from '../shared/lrc.js';
import { StepGuide } from '../ui/step-guide.js';

export function initTimingTab() {
  const $ = id => document.getElementById(id);

  const audioGraph = new AudioGraph();
  const lyrics = new LyricsData();
  let isPlaying = false;
  let timingMode = false;
  let timingIdx = 0;
  let trackTitle = '';
  let isSeeking = false;

  const stepGuide = new StepGuide($('step-bar-timing'), [
    { id: 'audio', label: '音源を選択' },
    { id: 'lyrics', label: '歌詞を貼り付け' },
    { id: 'stamp', label: 'タイミング入力' },
    { id: 'export', label: 'LRC書き出し' },
  ]);

  $('t-pick-btn').addEventListener('click', () => $('t-audio-input').click());
  $('t-audio-input').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) loadAudio(f);
  });

  function loadAudio(file) {
    trackTitle = file.name.replace(/\.[^.]+$/, '');
    const audio = audioGraph.loadFile(file);
    audio.addEventListener('loadedmetadata', () => {
      const dur = audio.duration;
      const m = Math.floor(dur / 60);
      const s = String(Math.floor(dur % 60)).padStart(2, '0');
      $('t-meta').textContent = `${file.name} - ${m}:${s}`;
      $('t-tot-time').textContent = `${m}:${s}`;
      $('t-seek-bar').max = dur;
      $('t-seek-bar').value = 0;
      $('t-seek-bar').disabled = false;
      $('t-play-btn').disabled = false;
      $('t-timing-btn').disabled = lyrics.length === 0;
      stepGuide.markDone(0);
    });
    audio.addEventListener('timeupdate', () => {
      if (isSeeking) return;
      $('t-seek-bar').value = audio.currentTime;
      const m = Math.floor(audio.currentTime / 60);
      const s = String(Math.floor(audio.currentTime % 60)).padStart(2, '0');
      $('t-cur-time').textContent = `${m}:${s}`;
      if (!timingMode) updatePlayhead();
    });
    audio.addEventListener('ended', () => {
      isPlaying = false;
      $('t-play-btn').textContent = '▶ 再生';
    });
    audioGraph.setupGraph();
  }

  $('t-lyrics-input').addEventListener('input', () => {
    lyrics.parseFromText($('t-lyrics-input').value);
    renderLyricList();
    $('t-timing-btn').disabled = !audioGraph.audio || lyrics.length === 0;
    $('t-export-lrc-btn').disabled = true;
    if (lyrics.length > 0) stepGuide.markDone(1);
  });

  $('t-play-btn').addEventListener('click', async () => {
    if (!audioGraph.audio) return;
    await audioGraph.resume();
    if (isPlaying) {
      audioGraph.audio.pause();
      isPlaying = false;
      $('t-play-btn').textContent = '▶ 再生';
    } else {
      audioGraph.audio.play();
      isPlaying = true;
      $('t-play-btn').textContent = '⏸ 一時停止';
    }
  });

  $('t-seek-bar').addEventListener('mousedown', () => { isSeeking = true; });
  $('t-seek-bar').addEventListener('change', () => {
    if (!audioGraph.audio) return;
    audioGraph.audio.currentTime = $('t-seek-bar').value;
    isSeeking = false;
  });

  $('t-timing-btn').addEventListener('click', () => {
    if (timingMode) exitTimingMode();
    else enterTimingMode();
  });

  $('t-reset-btn').addEventListener('click', () => {
    lyrics.removeBlanksFrom(0);
    lyrics.clearTimes();
    timingIdx = 0;
    if (timingMode) exitTimingMode();
    renderLyricList();
    $('t-export-lrc-btn').disabled = true;
  });

  $('t-import-lrc-btn').addEventListener('click', () => $('t-lrc-input').click());
  $('t-lrc-input').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseLRC(ev.target.result);
      if (parsed.length === 0) return;
      lyrics.lines = parsed;
      $('t-lyrics-input').value = parsed.map(l => l.text).join('\n');
      renderLyricList();
      $('t-timing-btn').disabled = !audioGraph.audio;
      $('t-export-lrc-btn').disabled = false;
      stepGuide.markDone(1);
      stepGuide.markDone(2);
    };
    reader.readAsText(f, 'utf-8');
    $('t-lrc-input').value = '';
  });

  $('t-export-lrc-btn').addEventListener('click', () => {
    const content = buildLRC(lyrics.all);
    downloadLRC(content, `${trackTitle || 'lyrics'}.lrc`);
    stepGuide.markDone(3);
  });

  function enterTimingMode() {
    lyrics.parseFromText($('t-lyrics-input').value);
    if (lyrics.length === 0 || !audioGraph.audio) return;
    timingMode = true;
    timingIdx = 0;
    lyrics.clearTimes();
    $('t-timing-btn').textContent = '■ 停止';
    $('t-timing-btn').style.background = '#c81e3a';
    $('t-timing-btn').style.borderColor = '#c81e3a';
    $('t-export-lrc-btn').disabled = true;
    renderLyricList();
    updateTimingStatus();
    audioGraph.resume();
    audioGraph.audio.currentTime = 0;
    audioGraph.audio.play();
    isPlaying = true;
    $('t-play-btn').textContent = '⏸ 一時停止';
  }

  function exitTimingMode() {
    timingMode = false;
    $('t-timing-btn').textContent = '⬤ タイミング入力';
    $('t-timing-btn').style.background = '#6d28d9';
    $('t-timing-btn').style.borderColor = '#6d28d9';
    renderLyricList();
    updateTimingStatus();
    const hasTimes = lyrics.all.some(l => l.time !== null);
    $('t-export-lrc-btn').disabled = !hasTimes;
    if (hasTimes) stepGuide.markDone(2);
  }

  function stampLine() {
    if (!timingMode || timingIdx >= lyrics.length) return;
    lyrics.setTime(timingIdx, audioGraph.audio.currentTime);
    timingIdx++;
    renderLyricList();
    updateTimingStatus();
    if (timingIdx >= lyrics.length) exitTimingMode();
  }

  function renderLyricList() {
    const list = $('t-lyric-line-list');
    list.innerHTML = '';
    lyrics.all.forEach((l, i) => {
      const div = document.createElement('div');
      div.style.cssText = 'display:flex;align-items:center;gap:10px;padding:4px 8px;border-radius:6px;font-size:12px';
      if (timingMode && i === timingIdx) div.style.background = 'rgba(229,30,48,0.22)';

      const t = document.createElement('span');
      t.style.cssText = 'font-family:ui-monospace,monospace;min-width:62px;opacity:0.55;font-size:11px';
      t.textContent = l.time !== null ? formatLRCTime(l.time) : '--:--.--';

      const tx = document.createElement('span');
      tx.style.cssText = 'flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      if (!l.text) {
        tx.textContent = '〔間奏〕';
        tx.style.opacity = '0.4';
        tx.style.fontStyle = 'italic';
      } else {
        tx.textContent = l.text;
      }

      div.appendChild(t);
      div.appendChild(tx);
      list.appendChild(div);
    });
    if (timingMode && list.children[timingIdx]) {
      list.children[timingIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  function updatePlayhead() {
    if (!audioGraph.audio || !lyrics.length) return;
    const idx = lyrics.getCurrentIndex(audioGraph.audio.currentTime);
    const items = $('t-lyric-line-list').children;
    for (let i = 0; i < items.length; i++) {
      items[i].style.background = i === idx ? 'rgba(26,157,82,0.22)' : '';
    }
  }

  function updateTimingStatus() {
    const status = $('t-timing-status');
    if (!timingMode) {
      status.style.display = 'none';
      return;
    }
    status.style.display = 'block';
    $('t-timing-progress').textContent = `(${timingIdx + 1} / ${lyrics.length} 行)`;
    if (timingIdx < lyrics.length) {
      $('t-timing-current-line').textContent = lyrics.all[timingIdx].text || '〔間奏マーカー待機中〕';
    } else {
      $('t-timing-current-line').textContent = '✓ 完了';
    }
  }

  document.addEventListener('keydown', e => {
    if (!timingMode) return;
    if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      stampLine();
    } else if (e.code === 'Enter') {
      e.preventDefault();
      lyrics.insertBlank(timingIdx, audioGraph.audio.currentTime);
      timingIdx++;
      renderLyricList();
      updateTimingStatus();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      if (timingIdx > 0) {
        timingIdx--;
        if (lyrics.all[timingIdx].text === '') {
          lyrics.removeAt(timingIdx);
        } else {
          lyrics.setTime(timingIdx, null);
        }
        renderLyricList();
        updateTimingStatus();
      }
    }
  });
}
```

- [ ] **Step 3: app.js を更新（initTimingTab を呼び出す）**

`docs/js/app.js` を以下に置き換える：

```js
import { initTimingTab } from './timing/timing-tab.js';

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabs.forEach(b => b.classList.toggle('is-active', b === btn));
    panels.forEach(p => p.classList.toggle('is-active', p.id === `panel-${target}`));
  });
});

initTimingTab();
// initCreatorTab() は次のタスクで追加
```

- [ ] **Step 4: 動作確認**

ブラウザで `http://localhost:8000` を開く。
- Timing タブで音源読み込み・歌詞貼り付け・タイミングスタンプ（Space）・間奏マーカー（Enter）・LRC書き出しが動作する
- ステップガイドが進む

- [ ] **Step 5: コミット**

```bash
git add docs/
git commit -m "feat: implement Timing tab"
```

---

## Phase 6: Creator タブ実装

### Task 14: creator/creator-tab.js + index.html 更新

**Files:**
- Create: `docs/js/creator/creator-tab.js`
- Modify: `docs/index.html`
- Modify: `docs/js/app.js`

- [ ] **Step 1: index.html の Creator パネル中身を作成**

`docs/index.html` の `<section class="tab-panel" id="panel-creator">` を以下に置き換える：

```html
<section class="tab-panel" id="panel-creator">
  <div class="step-bar" id="step-bar-creator"></div>

  <div class="toolbar">
    <h1 style="font-family:var(--font-display);font-size:18px;letter-spacing:0.06em">Creator</h1>
    <input type="file" id="c-audio-input" accept="audio/*" hidden />
    <button class="btn" id="c-pick-btn">音源を選択</button>
    <button class="btn btn--primary" id="c-play-btn" disabled>▶ 再生</button>
    <button class="btn btn--rec" id="c-rec-btn" disabled>● 録画</button>
    <input type="file" id="c-lrc-input" accept=".lrc,.txt" hidden />
    <button class="btn" id="c-import-lrc-btn">↑ LRC 読み込み</button>
    <select class="select" id="c-aspect-select">
      <option value="9:16" selected>9:16</option>
      <option value="1:1">1:1</option>
      <option value="16:9">16:9</option>
    </select>
    <select class="select" id="c-style-select"></select>
    <label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:var(--radius-pill);border:1px solid var(--border);background:var(--bg-2);font-size:12px;cursor:pointer">
      <input type="checkbox" id="c-particles-toggle" checked style="accent-color:var(--accent)" /> 粒子
    </label>
    <label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:var(--radius-pill);border:1px solid var(--border);background:var(--bg-2);font-size:12px;cursor:pointer">
      <input type="checkbox" id="c-lyrics-toggle" checked style="accent-color:var(--accent)" /> 歌詞
    </label>
    <input type="text" class="text-input" id="c-song-title" placeholder="曲名" style="width:120px" />
    <input type="text" class="text-input" id="c-band-name" placeholder="バンド名" style="width:130px" />
    <div style="flex:1"></div>
    <span class="meta" id="c-meta">未読込</span>
  </div>

  <div class="seekrow">
    <span class="meta" id="c-cur-time">0:00</span>
    <input type="range" id="c-seek-bar" class="seek-bar" min="0" max="100" step="0.1" value="0" disabled />
    <span class="meta" id="c-tot-time">0:00</span>
  </div>

  <div class="stage">
    <div class="canvas-wrap" id="c-canvas-wrap" data-aspect="9:16">
      <canvas id="c-canvas" width="1080" height="1920"></canvas>
      <div class="drop" id="c-drop">
        <h2>DROP AUDIO HERE</h2>
        <p>音源ファイル（mp3 / wav / m4a など）を<br/>このエリアにドロップ、または「音源を選択」から読み込み</p>
        <div class="pill">音源をドロップ / 選択</div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: creator-tab.js を作成**

ファイル: `docs/js/creator/creator-tab.js`
```js
import { AudioGraph } from '../shared/audio.js';
import { LyricsData } from '../shared/lyrics-data.js';
import { parseLRC } from '../shared/lrc.js';
import { StepGuide } from '../ui/step-guide.js';
import { getStyles, getStyleById } from './visual-styles/registry.js';
import './visual-styles/red-frame.js';
import './visual-styles/rainbow-bars.js';
import './visual-styles/gold-aura.js';
import './visual-styles/mono-lines.js';
import { Particles } from './particles.js';
import { drawOverlay } from './overlay.js';
import { Recorder } from './recorder.js';

export function initCreatorTab() {
  const $ = id => document.getElementById(id);
  const canvas = $('c-canvas');
  const ctx = canvas.getContext('2d');

  const audioGraph = new AudioGraph();
  const lyrics = new LyricsData();
  const particles = new Particles();
  const recorder = new Recorder();

  let isPlaying = false;
  let isSeeking = false;
  let visualStyle = 'red-frame';
  let trackTitle = '';
  let lastBass = 0;

  const stepGuide = new StepGuide($('step-bar-creator'), [
    { id: 'audio', label: '音源を選択' },
    { id: 'style', label: '背景を選ぶ' },
    { id: 'record', label: '録画' },
  ]);

  // スタイルセレクトを動的生成
  const styleSel = $('c-style-select');
  getStyles().forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label;
    if (s.id === 'red-frame') opt.selected = true;
    styleSel.appendChild(opt);
  });
  styleSel.addEventListener('change', e => {
    visualStyle = e.target.value;
    stepGuide.markDone(1);
  });

  // アスペクト比
  const ASPECTS = { '9:16': [1080, 1920], '1:1': [1080, 1080], '16:9': [1920, 1080] };
  function applyAspect(name) {
    $('c-canvas-wrap').setAttribute('data-aspect', name);
    const [w, h] = ASPECTS[name];
    canvas.width = w;
    canvas.height = h;
    particles.init(w, h);
  }
  $('c-aspect-select').addEventListener('change', e => applyAspect(e.target.value));
  applyAspect('9:16');

  $('c-pick-btn').addEventListener('click', () => $('c-audio-input').click());
  $('c-audio-input').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) loadAudio(f);
  });

  // Drag & drop
  const wrap = $('c-canvas-wrap');
  ['dragenter', 'dragover'].forEach(ev =>
    wrap.addEventListener(ev, e => {
      e.preventDefault();
      wrap.style.outline = '2px solid var(--accent)';
    })
  );
  ['dragleave', 'drop'].forEach(ev =>
    wrap.addEventListener(ev, e => {
      e.preventDefault();
      wrap.style.outline = 'none';
    })
  );
  wrap.addEventListener('drop', e => {
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('audio/')) loadAudio(f);
  });

  function loadAudio(file) {
    trackTitle = file.name.replace(/\.[^.]+$/, '');
    const audio = audioGraph.loadFile(file);
    audio.addEventListener('loadedmetadata', () => {
      const dur = audio.duration;
      const m = Math.floor(dur / 60);
      const s = String(Math.floor(dur % 60)).padStart(2, '0');
      $('c-meta').textContent = `${file.name} - ${m}:${s}`;
      $('c-tot-time').textContent = `${m}:${s}`;
      $('c-seek-bar').max = dur;
      $('c-seek-bar').disabled = false;
      $('c-play-btn').disabled = false;
      $('c-rec-btn').disabled = false;
      $('c-drop').classList.add('is-hidden');
      stepGuide.markDone(0);
    });
    audio.addEventListener('timeupdate', () => {
      if (isSeeking) return;
      $('c-seek-bar').value = audio.currentTime;
      const m = Math.floor(audio.currentTime / 60);
      const s = String(Math.floor(audio.currentTime % 60)).padStart(2, '0');
      $('c-cur-time').textContent = `${m}:${s}`;
    });
    audio.addEventListener('ended', () => {
      isPlaying = false;
      $('c-play-btn').textContent = '▶ 再生';
      if (recorder.isRecording) recorder.stop();
    });
    audioGraph.setupGraph();
  }

  $('c-play-btn').addEventListener('click', async () => {
    if (!audioGraph.audio) return;
    await audioGraph.resume();
    if (isPlaying) {
      audioGraph.audio.pause();
      isPlaying = false;
      $('c-play-btn').textContent = '▶ 再生';
    } else {
      audioGraph.audio.play();
      isPlaying = true;
      $('c-play-btn').textContent = '⏸ 一時停止';
    }
  });

  $('c-seek-bar').addEventListener('mousedown', () => { isSeeking = true; });
  $('c-seek-bar').addEventListener('change', () => {
    if (audioGraph.audio) audioGraph.audio.currentTime = $('c-seek-bar').value;
    isSeeking = false;
  });

  $('c-rec-btn').addEventListener('click', () => {
    if (!audioGraph.audio) return;
    if (recorder.isRecording) {
      recorder.stop();
      $('c-rec-btn').textContent = '● 録画';
      $('c-rec-btn').classList.remove('is-recording');
    } else {
      recorder.start(canvas, audioGraph.destNode.stream, `${trackTitle}-visualizer.webm`);
      recorder.onStop = () => {
        $('c-rec-btn').textContent = '● 録画';
        $('c-rec-btn').classList.remove('is-recording');
        stepGuide.markDone(2);
      };
      $('c-rec-btn').textContent = '■ 停止';
      $('c-rec-btn').classList.add('is-recording');
      audioGraph.resume();
      if (!isPlaying) {
        audioGraph.audio.play();
        isPlaying = true;
        $('c-play-btn').textContent = '⏸ 一時停止';
      }
    }
  });

  $('c-import-lrc-btn').addEventListener('click', () => $('c-lrc-input').click());
  $('c-lrc-input').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseLRC(ev.target.result);
      if (parsed.length === 0) return;
      lyrics.lines = parsed;
    };
    reader.readAsText(f, 'utf-8');
    $('c-lrc-input').value = '';
  });

  // 描画ループ
  function render() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    let freq = new Uint8Array(1024);
    let time = new Uint8Array(1024);
    let bass = 0;
    if (audioGraph.analyser) {
      freq = audioGraph.getFreqData();
      time = audioGraph.getTimeData();
      bass = audioGraph.getBass();
    }
    lastBass = lastBass * 0.85 + bass * 0.15;

    if ($('c-particles-toggle').checked) {
      particles.draw(ctx, W, H, lastBass);
    }

    const style = getStyleById(visualStyle);
    if (style) {
      style.drawFn(ctx, W, H, freq, time, lastBass, { showJacket: false });
    }

    drawOverlay(ctx, W, H, {
      songTitle: $('c-song-title').value,
      bandName: $('c-band-name').value,
      lyricsData: lyrics,
      currentTime: audioGraph.audio?.currentTime || 0,
      showLyrics: $('c-lyrics-toggle').checked,
      lyricsY: 0.5,
      showTrackTitle: true,
      trackTitle,
    });

    requestAnimationFrame(render);
  }
  render();
}
```

- [ ] **Step 3: app.js を更新**

`docs/js/app.js` の末尾を更新：

```js
import { initTimingTab } from './timing/timing-tab.js';
import { initCreatorTab } from './creator/creator-tab.js';

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabs.forEach(b => b.classList.toggle('is-active', b === btn));
    panels.forEach(p => p.classList.toggle('is-active', p.id === `panel-${target}`));
  });
});

initTimingTab();
initCreatorTab();
```

- [ ] **Step 4: 動作確認**

ブラウザで `http://localhost:8000` を開く。
- Creator タブで音源読み込み → 再生 → 4スタイル切り替えがすべて動作する
- 粒子・歌詞のトグルが効く
- 録画ボタンで WebM がダウンロードされる
- LRC読み込みで歌詞が表示される

- [ ] **Step 5: コミット**

```bash
git add docs/
git commit -m "feat: implement Creator tab"
```

---

## Phase 7: ドキュメント・公開設定

### Task 15: README 更新

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README.md を全面更新**

ファイル: `README.md`
```markdown
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
```

- [ ] **Step 2: コミット**

```bash
git add README.md
git commit -m "docs: rewrite README for v2 structure"
```

---

### Task 16: 旧ファイルの削除と整理

**Files:**
- Delete: `visualizer.html`
- Delete: `visualizer.js`

- [ ] **Step 1: 旧ファイルを削除**

Run:
```bash
git rm visualizer.html visualizer.js
```

- [ ] **Step 2: コミット**

```bash
git commit -m "chore: remove legacy visualizer files"
```

---

## Phase 8: 最終動作確認

### Task 17: スモークテスト

- [ ] **Step 1: ローカルサーバー起動**

Run: `cd docs && python -m http.server 8000`

- [ ] **Step 2: Timing タブの動作確認**

ブラウザで以下を確認：
- [ ] 音源を選択 → メタ表示・シークバー有効化
- [ ] 歌詞テキストを貼り付け → 一覧が表示される
- [ ] 「タイミング入力」→ 再生開始
- [ ] Space で各行スタンプ → 時刻が表示される
- [ ] Enter で間奏マーカー → `〔間奏〕` 行が追加される
- [ ] ← で1行戻る
- [ ] LRC書き出し → ファイルがダウンロードされる
- [ ] ステップガイドが「音源 → 歌詞 → タイミング → LRC」と進む

- [ ] **Step 3: Creator タブの動作確認**

- [ ] 音源を選択 → DROPオーバーレイが消える
- [ ] 再生 → ビジュアライザーが動く
- [ ] スタイル切り替え（4種すべて）→ 描画が切り替わる
- [ ] アスペクト比切り替え（9:16 / 1:1 / 16:9）→ キャンバスサイズが変わる
- [ ] 粒子トグル → ON/OFFが効く
- [ ] 曲名・バンド名入力 → 画面上部に表示される
- [ ] LRC読み込み → 歌詞がキャンバスに表示される
- [ ] 録画ボタン → WebMファイルがダウンロードされる
- [ ] ステップガイドが「音源 → 背景 → 録画」と進む

- [ ] **Step 4: コンソールエラー確認**

ブラウザの開発者ツールでエラーがゼロであることを確認。

- [ ] **Step 5: 公開準備のコミット**

```bash
git add -A
git status  # 変更がないことを確認
```

Expected: "nothing to commit, working tree clean"

---

## 完了基準

- [x] Timing タブで歌詞タイミング作成 → LRC書き出しまで一通り動作
- [x] Creator タブで音源読み込み → 4スタイル表示 → 録画まで一通り動作
- [x] 両タブにステップガイドが表示され進捗が反映される
- [x] コンソールエラーゼロ
- [x] README に GitHub Pages 公開手順が記載
- [x] 旧 `visualizer.html` / `visualizer.js` は削除済み

このプランが完了したら **Plan 2（Creator強化: フォント・装飾・配置・ロゴ・歌詞エフェクト）** へ進む。
