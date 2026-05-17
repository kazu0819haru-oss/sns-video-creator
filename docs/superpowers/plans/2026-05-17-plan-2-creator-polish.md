# Plan 2: Creator強化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creatorタブに 13フォント選択・テキスト装飾（独立設定）・キャンバス上ドラッグ配置・歌詞エフェクト6種・バンドロゴオーバーレイを追加し、SNSショート動画用の表現力を大幅強化する。

**Architecture:** 新規 Properties Panel（右サイド・3アコーディオン）に全コントロールを集約。既存の `lyrics-render.js` / `overlay.js` を拡張、新規 `lyrics-effects.js` / `text-positioning.js` / `logo.js` を追加。状態管理は `creator-tab.js` 内で集中させ、render ループ毎に最新オプションを使って描画。

**Tech Stack:** 既存 Vanilla JS / ES Modules / Canvas API、新規 Google Fonts (Dela Gothic One ほか12種)、HTML5 Drag/Mouse Events

---

## File Structure

新規・変更ファイル一覧：

```
docs/
├── index.html                              # 変更: フォント link 追加、Properties Panel 追加
├── css/
│   └── ui.css                              # 変更: panel + accordion + edit-mode CSS
└── js/
    ├── shared/
    │   ├── fonts.js                        # NEW: 13フォント定義
    │   └── lyrics-render.js                # 変更: フル装飾オプション対応
    └── creator/
        ├── creator-tab.js                  # 変更: 状態管理・Panel連携
        ├── overlay.js                      # 変更: 装飾オプションを上流から受け取る
        ├── lyrics-effects.js               # NEW: 6エフェクト
        ├── text-positioning.js             # NEW: ドラッグ配置
        └── logo.js                         # NEW: ロゴ状態＋描画
```

---

## Phase 1: フォント基盤

### Task 1: `shared/fonts.js` を作成

**Files:**
- Create: `docs/js/shared/fonts.js`

- [ ] **Step 1: fonts.js を作成**

ファイル: `docs/js/shared/fonts.js`
```js
// アプリで使用可能なフォント一覧。
// family: CSS font-family 文字列
// label: UI 表示名
// weight: デフォルトの font-weight
// tag: 用途バッジ
export const FONTS = [
  { id: 'shippori-mincho', family: '"Shippori Mincho B1", serif',     label: 'Shippori Mincho',     weight: 500, tag: '明朝・デフォルト' },
  { id: 'dela-gothic',     family: '"Dela Gothic One", sans-serif',    label: 'Dela Gothic One',     weight: 400, tag: 'ウルトラボールド' },
  { id: 'rampart',         family: '"Rampart One", sans-serif',        label: 'Rampart One',         weight: 400, tag: 'アウトライン' },
  { id: 'stick',           family: '"Stick", sans-serif',              label: 'Stick',               weight: 400, tag: '超細長' },
  { id: 'zen-old',         family: '"Zen Old Mincho", serif',          label: 'Zen Old Mincho',      weight: 900, tag: 'エレガント明朝' },
  { id: 'shippori-antique',family: '"Shippori Antique B1", serif',     label: 'Shippori Antique',    weight: 400, tag: 'レトロ明朝' },
  { id: 'kaisei',          family: '"Kaisei HarunoUmi", serif',        label: 'Kaisei HarunoUmi',    weight: 700, tag: 'モダン明朝' },
  { id: 'rocknroll',       family: '"RocknRoll One", sans-serif',      label: 'RocknRoll One',       weight: 400, tag: 'ポップ' },
  { id: 'bebas',           family: '"Bebas Neue", sans-serif',         label: 'Bebas Neue',          weight: 400, tag: '英字特化' },
  { id: 'klee',            family: '"Klee One", cursive',              label: 'Klee One',            weight: 600, tag: '手書き' },
  { id: 'yuji',            family: '"Yuji Syuku", serif',              label: 'Yuji Syuku',          weight: 400, tag: '毛筆' },
  { id: 'reggae',          family: '"Reggae One", sans-serif',         label: 'Reggae One',          weight: 400, tag: '個性派太字' },
  { id: 'mplus',           family: '"M PLUS 1", sans-serif',           label: 'M PLUS 1',            weight: 700, tag: '万能モダン' },
];

export function getFontById(id) {
  return FONTS.find(f => f.id === id) || FONTS[0];
}
```

- [ ] **Step 2: コミット**

```bash
cd "C:\Users\kazu0\Claude\Visualizer作成"
git add docs/js/shared/fonts.js
git commit -m "feat: add fonts registry with 13 stylish options"
```

---

### Task 2: `index.html` に Google Fonts 追加

**Files:**
- Modify: `docs/index.html`

- [ ] **Step 1: フォントの link 要素を更新**

`docs/index.html` の既存 link 行（`<link href="https://fonts.googleapis.com/css2?family=Anton...">`）を以下に置換：

```html
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Dela+Gothic+One&family=Inter:wght@400;500;600;700;900&family=Kaisei+HarunoUmi:wght@700&family=Klee+One:wght@600&family=M+PLUS+1:wght@700&family=Noto+Sans+JP:wght@400;500;700;900&family=Rampart+One&family=Reggae+One&family=RocknRoll+One&family=Shippori+Antique+B1&family=Shippori+Mincho+B1:wght@400;500;700&family=Stick&family=Yuji+Syuku&family=Zen+Old+Mincho:wght@700;900&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: コミット**

```bash
git add docs/index.html
git commit -m "feat: load 13 Google Fonts in index.html"
```

---

## Phase 2: Properties Panel スキャフォールド

### Task 3: `index.html` に Properties Panel を追加

**Files:**
- Modify: `docs/index.html`

- [ ] **Step 1: Creator パネル内に Properties Panel を追加**

`docs/index.html` の `<section class="tab-panel" id="panel-creator">` 内の `<div class="stage">` ブロックを、以下のように **layout div で囲んで右サイドに properties を追加**：

`<div class="stage">` から始まる既存ブロックを **そのまま** 残しつつ、その親を新規 `<div class="creator-layout">` で囲い、Properties Panel を追加する。

具体的には、`</div>` (`<div class="seekrow">` の終了)の直後にある `<div class="stage">` ... `</div>` 全体を、以下に置き換える：

```html
<div class="creator-layout">
  <div class="stage">
    <div class="canvas-wrap" id="c-canvas-wrap" data-aspect="9:16">
      <canvas id="c-canvas" width="1080" height="1920"></canvas>
      <div class="drop" id="c-drop">
        <h2>DROP AUDIO HERE</h2>
        <p>音源ファイル（mp3 / wav / m4a など）を<br/>このエリアにドロップ、または「音源を選択」から読み込み</p>
        <div class="pill">音源をドロップ / 選択</div>
      </div>
      <button class="btn edit-mode-btn" id="c-edit-mode-btn" title="テキスト・ロゴをドラッグで移動">✥ 配置編集</button>
    </div>
  </div>

  <aside class="properties-panel" id="c-properties">
    <!-- Text section -->
    <details class="accordion" open>
      <summary>📝 テキスト</summary>
      <div class="accordion-body" id="c-text-controls"></div>
    </details>

    <!-- Effects section -->
    <details class="accordion">
      <summary>✨ 演出</summary>
      <div class="accordion-body" id="c-effects-controls"></div>
    </details>

    <!-- Logo section -->
    <details class="accordion">
      <summary>🎯 ロゴ</summary>
      <div class="accordion-body" id="c-logo-controls"></div>
    </details>
  </aside>
</div>
```

- [ ] **Step 2: コミット**

```bash
git add docs/index.html
git commit -m "feat: scaffold properties panel in Creator tab"
```

---

### Task 4: Properties Panel の CSS

**Files:**
- Modify: `docs/css/ui.css`

- [ ] **Step 1: CSS をファイル末尾に追記**

`docs/css/ui.css` の末尾に以下を追記：

```css
/* Creator Layout */
.creator-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 14px;
  min-height: 0;
}
.creator-layout .stage { flex: 1; }
.creator-layout .canvas-wrap { max-height: calc(100vh - 320px); }

/* Edit mode button on canvas */
.edit-mode-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 6px 12px;
  background: rgba(0,0,0,0.55);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  font-size: 12px;
  color: var(--fg);
  cursor: pointer;
  backdrop-filter: blur(4px);
  z-index: 10;
}
.edit-mode-btn.is-active {
  background: var(--accent);
  border-color: var(--accent);
}
.canvas-wrap.is-edit-mode canvas { cursor: move; }
.canvas-wrap.is-edit-mode { outline: 2px dashed var(--accent); }

/* Properties Panel */
.properties-panel {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 6px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.accordion {
  background: var(--bg-3);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.accordion > summary {
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}
.accordion > summary::-webkit-details-marker { display: none; }
.accordion > summary::after {
  content: '▾';
  margin-left: auto;
  opacity: 0.5;
  transition: transform 0.2s;
}
.accordion[open] > summary::after { transform: rotate(180deg); }
.accordion-body {
  padding: 10px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Form controls inside accordion */
.field { display: flex; flex-direction: column; gap: 4px; }
.field-label {
  font-size: 11px;
  color: var(--fg-muted);
  letter-spacing: 0.04em;
}
.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.field-row .field-label { min-width: 60px; }
.subsection {
  border-top: 1px solid var(--border);
  padding-top: 10px;
  margin-top: 4px;
}
.subsection-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-soft);
  letter-spacing: 0.05em;
  margin-bottom: 6px;
  text-transform: uppercase;
}

/* Color input */
input[type="color"] {
  width: 36px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  padding: 2px;
}
input[type="color"]::-webkit-color-swatch { border: none; border-radius: 3px; }
input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }

/* Range slider in panel */
.range-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.range-row input[type="range"] { flex: 1; }
.range-row .value {
  font-size: 11px;
  color: var(--fg-muted);
  min-width: 32px;
  text-align: right;
  font-family: ui-monospace, monospace;
}

/* Font selector with preview */
.font-select {
  width: 100%;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-3);
  color: var(--fg);
  font-size: 13px;
  outline: none;
}
.font-preview {
  padding: 10px 14px;
  background: rgba(0,0,0,0.4);
  border-radius: var(--radius-sm);
  font-size: 22px;
  line-height: 1.2;
  text-align: center;
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
}

/* Logo preview */
.logo-preview {
  background: rgba(0,0,0,0.4);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  padding: 12px;
  text-align: center;
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo-preview img { max-width: 100%; max-height: 64px; object-fit: contain; }
.logo-preview .empty { font-size: 11px; color: var(--fg-faint); }

/* Toggle switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--border-strong);
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.2s;
}
.toggle-slider::before {
  content: '';
  position: absolute;
  left: 2px; top: 2px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: white;
  transition: transform 0.2s;
}
.toggle-switch input:checked + .toggle-slider { background: var(--accent); }
.toggle-switch input:checked + .toggle-slider::before { transform: translateX(16px); }
```

- [ ] **Step 2: コミット**

```bash
git add docs/css/ui.css
git commit -m "feat: add CSS for properties panel and edit mode"
```

---

## Phase 3: テキスト装飾レンダリングの拡張

### Task 5: `shared/lyrics-render.js` をフルオプション対応に拡張

**Files:**
- Modify: `docs/js/shared/lyrics-render.js`

- [ ] **Step 1: ファイル全体を以下に置換**

ファイル: `docs/js/shared/lyrics-render.js`
```js
// Canvas 上に歌詞を描画する関数群。
// opts:
//   enabled, currentLineIdx, lineStartTime, currentTime
//   font: CSS font-family 文字列
//   weight: font-weight
//   color: 文字色 (hex / rgba)
//   sizeScale: 標準比に対するスケール (1.0 がデフォルト)
//   x, y: 位置（0-1 のパーセンテージ）
//   shadow: シャドウ強度 (0-40)
//   background: 'none' | 'bar' | 'blur'
//   effect: 'none' | 'fade' | 'slide' | 'typewriter' | 'glow' | 'colorshift'
//   bass: 0-1 (glow/colorshift で使用)
export function drawLyrics(ctx, W, H, lyricsData, opts = {}) {
  if (!opts.enabled) return;
  const idx = opts.currentLineIdx ?? lyricsData.getCurrentIndex(opts.currentTime || 0);
  if (idx < 0) return;
  const line = lyricsData.all[idx];
  if (!line || !line.text) return; // 間奏マーカー

  const baseSize = Math.round(H * 0.026 * (opts.sizeScale ?? 1));
  const cx = W * (opts.x ?? 0.5);
  const cy = H * (opts.y ?? 0.5);
  const font = opts.font || '"Shippori Mincho B1", serif';
  const weight = opts.weight ?? 400;
  const shadowBlur = opts.shadow ?? 18;

  // エフェクト進行（行の経過時間）
  const lineStart = opts.lineStartTime ?? 0;
  const elapsed = Math.max(0, (opts.currentTime ?? 0) - lineStart);

  // 表示テキストとエフェクトパラメータ
  let displayText = line.text;
  let alpha = 1;
  let yOffset = 0;
  let extraGlow = 0;
  let color = opts.color || 'rgba(255,255,255,0.95)';

  switch (opts.effect) {
    case 'fade': {
      const dur = 0.4;
      alpha = Math.min(1, elapsed / dur);
      break;
    }
    case 'slide': {
      const dur = 0.45;
      const t = Math.min(1, elapsed / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      alpha = ease;
      yOffset = (1 - ease) * baseSize * 0.8;
      break;
    }
    case 'typewriter': {
      const charsPerSec = 24;
      const n = Math.min(displayText.length, Math.floor(elapsed * charsPerSec));
      displayText = displayText.slice(0, n);
      break;
    }
    case 'glow': {
      const bass = opts.bass ?? 0;
      extraGlow = bass * 30;
      break;
    }
    case 'colorshift': {
      const t = (opts.currentTime ?? 0) * 0.3;
      const hue = (Math.sin(t) * 0.5 + 0.5) * 360;
      color = `hsl(${hue.toFixed(0)}, 90%, 80%)`;
      break;
    }
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${baseSize}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // テキスト背景
  if (opts.background && opts.background !== 'none') {
    const metrics = ctx.measureText(displayText);
    const padX = baseSize * 0.6;
    const padY = baseSize * 0.35;
    const w = metrics.width + padX * 2;
    const h = baseSize + padY * 2;
    const bx = cx - w / 2;
    const by = cy + yOffset - h / 2;
    if (opts.background === 'bar') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, bx, by, w, h, baseSize * 0.2);
      ctx.fill();
    } else if (opts.background === 'blur') {
      ctx.save();
      ctx.filter = 'blur(8px)';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(ctx, bx - 8, by - 8, w + 16, h + 16, baseSize * 0.3);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.shadowColor = 'rgba(0,0,0,1)';
  ctx.shadowBlur = shadowBlur + extraGlow;
  ctx.fillStyle = color;
  ctx.fillText(displayText, cx, cy + yOffset);
  ctx.shadowBlur = (shadowBlur + extraGlow) / 3;
  ctx.fillText(displayText, cx, cy + yOffset);
  ctx.restore();
}

// タイトルやバンド名を1行のテキストとして描画する汎用関数
export function drawTextLine(ctx, W, H, text, opts = {}) {
  if (!text) return;
  const baseSize = Math.round(H * 0.026 * (opts.sizeScale ?? 1));
  const cx = W * (opts.x ?? 0.5);
  const cy = H * (opts.y ?? 0.065);
  const font = opts.font || '"Shippori Mincho B1", serif';
  const weight = opts.weight ?? 500;
  const shadowBlur = opts.shadow ?? 14;

  ctx.save();
  ctx.font = `${weight} ${baseSize}px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (opts.background && opts.background !== 'none') {
    const metrics = ctx.measureText(text);
    const padX = baseSize * 0.6;
    const padY = baseSize * 0.35;
    const w = metrics.width + padX * 2;
    const h = baseSize + padY * 2;
    const bx = cx - w / 2;
    const by = cy - h / 2;
    if (opts.background === 'bar') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, bx, by, w, h, baseSize * 0.2);
      ctx.fill();
    } else if (opts.background === 'blur') {
      ctx.save();
      ctx.filter = 'blur(8px)';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(ctx, bx - 8, by - 8, w + 16, h + 16, baseSize * 0.3);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = shadowBlur;
  ctx.fillStyle = opts.color || 'rgba(255,255,255,0.92)';
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/shared/lyrics-render.js
git commit -m "feat: enhance lyrics-render with full styling and 6 effects"
```

---

### Task 6: `creator/overlay.js` を新オプションに対応

**Files:**
- Modify: `docs/js/creator/overlay.js`

- [ ] **Step 1: ファイル全体を以下に置換**

ファイル: `docs/js/creator/overlay.js`
```js
import { drawLyrics, drawTextLine } from '../shared/lyrics-render.js';

// opts は CreatorTab から渡される全状態。
// {
//   title: { text, font, color, sizeScale, shadow, background, x, y, visible },
//   band:  { text, font, color, sizeScale, shadow, background, x, y, visible },
//   lyrics:{ enabled, font, color, sizeScale, shadow, background, x, y, effect,
//            currentLineIdx, lineStartTime },
//   currentTime, lyricsData, bass,
//   logo (オプション・別途 drawLogo で描画されるためここでは扱わない)
// }
export function drawOverlay(ctx, W, H, opts) {
  ctx.save();

  // タイトル
  if (opts.title?.visible !== false && opts.title?.text) {
    drawTextLine(ctx, W, H, opts.title.text, {
      font: opts.title.font,
      color: opts.title.color,
      sizeScale: opts.title.sizeScale,
      shadow: opts.title.shadow,
      background: opts.title.background,
      x: opts.title.x,
      y: opts.title.y,
      weight: 500,
    });
  }

  // バンド名
  if (opts.band?.visible !== false && opts.band?.text) {
    drawTextLine(ctx, W, H, opts.band.text, {
      font: opts.band.font,
      color: opts.band.color,
      sizeScale: opts.band.sizeScale,
      shadow: opts.band.shadow,
      background: opts.band.background,
      x: opts.band.x,
      y: opts.band.y,
      weight: 400,
    });
  }

  // 歌詞
  drawLyrics(ctx, W, H, opts.lyricsData, {
    enabled: opts.lyrics?.enabled,
    font: opts.lyrics?.font,
    color: opts.lyrics?.color,
    sizeScale: opts.lyrics?.sizeScale,
    shadow: opts.lyrics?.shadow,
    background: opts.lyrics?.background,
    x: opts.lyrics?.x,
    y: opts.lyrics?.y,
    effect: opts.lyrics?.effect,
    currentLineIdx: opts.lyrics?.currentLineIdx,
    lineStartTime: opts.lyrics?.lineStartTime,
    currentTime: opts.currentTime,
    bass: opts.bass,
    weight: 400,
  });

  ctx.restore();
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/creator/overlay.js
git commit -m "refactor: overlay.js accepts per-element styling options"
```

---

## Phase 4: バンドロゴモジュール

### Task 7: `creator/logo.js`

**Files:**
- Create: `docs/js/creator/logo.js`

- [ ] **Step 1: logo.js を作成**

ファイル: `docs/js/creator/logo.js`
```js
// バンドロゴの状態と Canvas 描画を担当
export class Logo {
  constructor() {
    this.img = null;
    this.file = null;
    this.x = 0.85;       // キャンバス幅に対する中心の割合
    this.y = 0.92;
    this.widthScale = 0.18; // キャンバス幅に対する幅の割合
    this.opacity = 0.85;
    this.visible = true;
  }

  loadFile(file) {
    this.file = file;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => { this.img = img; resolve(img); };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  clear() {
    this.img = null;
    this.file = null;
  }

  // 中心 (x*W, y*H)、幅 (widthScale * W) で描画
  // 高さは画像のアスペクト比から自動算出
  draw(ctx, W, H) {
    if (!this.visible || !this.img) return;
    const w = W * this.widthScale;
    const aspect = this.img.naturalHeight / this.img.naturalWidth;
    const h = w * aspect;
    const cx = W * this.x;
    const cy = H * this.y;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.drawImage(this.img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  }

  // ヒット判定（ドラッグ配置用）。座標は Canvas ピクセル単位。
  getBounds(W, H) {
    if (!this.img) return null;
    const w = W * this.widthScale;
    const aspect = this.img.naturalHeight / this.img.naturalWidth;
    const h = w * aspect;
    const cx = W * this.x;
    const cy = H * this.y;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/creator/logo.js
git commit -m "feat: add Logo module for band logo overlay"
```

---

## Phase 5: ドラッグ配置モジュール

### Task 8: `creator/text-positioning.js`

**Files:**
- Create: `docs/js/creator/text-positioning.js`

- [ ] **Step 1: text-positioning.js を作成**

ファイル: `docs/js/creator/text-positioning.js`
```js
// ドラッグで X/Y 位置を編集するためのマネージャ。
//
// 使用方法:
//   const dm = new DragManager(canvas);
//   dm.addItem({
//     id: 'title',
//     getBounds: (W, H) => ({ cx, cy, w, h }),
//     setPos: (xPct, yPct) => { state.title.x = xPct; state.title.y = yPct; },
//   });
//   dm.setEnabled(true); // 編集モード ON
//
// レンダリングループで dm.drawHandles(ctx, W, H) を呼ぶと選択中アイテムに枠を描画。
export class DragManager {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.items = [];   // [{id, getBounds, setPos}]
    this.enabled = false;
    this.dragging = null; // { item, offsetX, offsetY }
    this.selected = null;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);

    this.canvas.addEventListener('mousedown', this._onDown);
    window.addEventListener('mousemove', this._onMove);
    window.addEventListener('mouseup', this._onUp);
  }

  addItem(item) { this.items.push(item); }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this.dragging = null;
      this.selected = null;
    }
  }

  // クライアント座標 → キャンバスピクセル座標
  _toCanvasCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  _hitTest(x, y) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const b = this.items[i].getBounds(W, H);
      if (!b) continue;
      const left = b.cx - b.w / 2;
      const top = b.cy - b.h / 2;
      if (x >= left && x <= left + b.w && y >= top && y <= top + b.h) {
        return this.items[i];
      }
    }
    return null;
  }

  _onDown(e) {
    if (!this.enabled) return;
    const { x, y } = this._toCanvasCoords(e.clientX, e.clientY);
    const hit = this._hitTest(x, y);
    if (hit) {
      const b = hit.getBounds(this.canvas.width, this.canvas.height);
      this.dragging = { item: hit, offsetX: x - b.cx, offsetY: y - b.cy };
      this.selected = hit;
      e.preventDefault();
    } else {
      this.selected = null;
    }
  }

  _onMove(e) {
    if (!this.dragging) return;
    const { x, y } = this._toCanvasCoords(e.clientX, e.clientY);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = x - this.dragging.offsetX;
    const cy = y - this.dragging.offsetY;
    this.dragging.item.setPos(
      Math.max(0, Math.min(1, cx / W)),
      Math.max(0, Math.min(1, cy / H))
    );
  }

  _onUp() { this.dragging = null; }

  drawHandles(ctx, W, H) {
    if (!this.enabled) return;
    ctx.save();
    for (const item of this.items) {
      const b = item.getBounds(W, H);
      if (!b) continue;
      const isSel = item === this.selected;
      ctx.strokeStyle = isSel ? '#1a9d52' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = isSel ? 3 : 1.5;
      ctx.setLineDash(isSel ? [] : [6, 4]);
      ctx.strokeRect(b.cx - b.w / 2, b.cy - b.h / 2, b.w, b.h);
    }
    ctx.restore();
  }

  destroy() {
    this.canvas.removeEventListener('mousedown', this._onDown);
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('mouseup', this._onUp);
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/creator/text-positioning.js
git commit -m "feat: add DragManager for canvas text/logo positioning"
```

---

## Phase 6: Creator タブの統合

### Task 9: `creator-tab.js` を全面更新

**Files:**
- Modify: `docs/js/creator/creator-tab.js`

- [ ] **Step 1: ファイル全体を以下に置換**

ファイル: `docs/js/creator/creator-tab.js`
```js
import { AudioGraph } from '../shared/audio.js';
import { LyricsData } from '../shared/lyrics-data.js';
import { parseLRC } from '../shared/lrc.js';
import { StepGuide } from '../ui/step-guide.js';
import { FONTS, getFontById } from '../shared/fonts.js';
import { getStyles, getStyleById } from './visual-styles/registry.js';
import './visual-styles/red-frame.js';
import './visual-styles/rainbow-bars.js';
import './visual-styles/gold-aura.js';
import './visual-styles/mono-lines.js';
import { Particles } from './particles.js';
import { drawOverlay } from './overlay.js';
import { Recorder } from './recorder.js';
import { Logo } from './logo.js';
import { DragManager } from './text-positioning.js';

const EFFECTS = [
  { id: 'none', label: 'なし' },
  { id: 'fade', label: 'フェードイン' },
  { id: 'slide', label: 'スライドアップ' },
  { id: 'typewriter', label: 'タイプライター' },
  { id: 'glow', label: 'グロー（音連動）' },
  { id: 'colorshift', label: 'カラーシフト' },
];

export function initCreatorTab() {
  const $ = id => document.getElementById(id);
  const canvas = $('c-canvas');
  const ctx = canvas.getContext('2d');

  const audioGraph = new AudioGraph();
  const lyrics = new LyricsData();
  const particles = new Particles();
  const recorder = new Recorder();
  const logo = new Logo();
  const dragMgr = new DragManager(canvas);

  // 状態
  const state = {
    visualStyle: 'red-frame',
    isPlaying: false,
    isSeeking: false,
    trackTitle: '',
    lastBass: 0,
    lastLineIdx: -1,
    lineStartTime: 0,
    title:  { text: '', font: getFontById('shippori-mincho').family, color: '#ffffff', sizeScale: 1.0, shadow: 14, background: 'none', x: 0.5, y: 0.065, visible: true },
    band:   { text: '', font: getFontById('shippori-mincho').family, color: '#cccccc', sizeScale: 0.7, shadow: 12, background: 'none', x: 0.5, y: 0.105, visible: true },
    lyrics: { enabled: true, font: getFontById('shippori-mincho').family, color: '#ffffff', sizeScale: 1.0, shadow: 18, background: 'none', x: 0.5, y: 0.5, effect: 'none' },
  };

  const stepGuide = new StepGuide($('step-bar-creator'), [
    { id: 'audio', label: '音源を選択' },
    { id: 'style', label: '背景を選ぶ' },
    { id: 'record', label: '録画' },
  ]);

  // ============ 既存のセットアップ（音源・スタイル・アスペクト・再生・録画） ============

  const styleSel = $('c-style-select');
  getStyles().forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label;
    if (s.id === 'red-frame') opt.selected = true;
    styleSel.appendChild(opt);
  });
  styleSel.addEventListener('change', e => {
    state.visualStyle = e.target.value;
    stepGuide.markDone(1);
  });

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

  const wrap = $('c-canvas-wrap');
  ['dragenter', 'dragover'].forEach(ev =>
    wrap.addEventListener(ev, e => {
      e.preventDefault();
      if (!state.editMode) wrap.style.outline = '2px solid var(--accent)';
    })
  );
  ['dragleave', 'drop'].forEach(ev =>
    wrap.addEventListener(ev, e => {
      e.preventDefault();
      if (!state.editMode) wrap.style.outline = 'none';
    })
  );
  wrap.addEventListener('drop', e => {
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('audio/')) loadAudio(f);
  });

  function loadAudio(file) {
    state.trackTitle = file.name.replace(/\.[^.]+$/, '');
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
      if (state.isSeeking) return;
      $('c-seek-bar').value = audio.currentTime;
      const m = Math.floor(audio.currentTime / 60);
      const s = String(Math.floor(audio.currentTime % 60)).padStart(2, '0');
      $('c-cur-time').textContent = `${m}:${s}`;
    });
    audio.addEventListener('ended', () => {
      state.isPlaying = false;
      $('c-play-btn').textContent = '▶ 再生';
      if (recorder.isRecording) recorder.stop();
    });
    audioGraph.setupGraph();
  }

  $('c-play-btn').addEventListener('click', async () => {
    if (!audioGraph.audio) return;
    await audioGraph.resume();
    if (state.isPlaying) {
      audioGraph.audio.pause();
      state.isPlaying = false;
      $('c-play-btn').textContent = '▶ 再生';
    } else {
      audioGraph.audio.play();
      state.isPlaying = true;
      $('c-play-btn').textContent = '⏸ 一時停止';
    }
  });

  $('c-seek-bar').addEventListener('mousedown', () => { state.isSeeking = true; });
  $('c-seek-bar').addEventListener('change', () => {
    if (audioGraph.audio) audioGraph.audio.currentTime = $('c-seek-bar').value;
    state.isSeeking = false;
  });

  $('c-rec-btn').addEventListener('click', () => {
    if (!audioGraph.audio) return;
    if (recorder.isRecording) {
      recorder.stop();
      $('c-rec-btn').textContent = '● 録画';
      $('c-rec-btn').classList.remove('is-recording');
    } else {
      recorder.start(canvas, audioGraph.destNode.stream, `${state.trackTitle}-visualizer.webm`);
      recorder.onStop = () => {
        $('c-rec-btn').textContent = '● 録画';
        $('c-rec-btn').classList.remove('is-recording');
        stepGuide.markDone(2);
      };
      $('c-rec-btn').textContent = '■ 停止';
      $('c-rec-btn').classList.add('is-recording');
      audioGraph.resume();
      if (!state.isPlaying) {
        audioGraph.audio.play();
        state.isPlaying = true;
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

  // 既存のツールバートグルを state に同期
  function syncFromToolbar() {
    state.title.text = $('c-song-title').value;
    state.band.text = $('c-band-name').value;
    state.lyrics.enabled = $('c-lyrics-toggle').checked;
  }
  $('c-song-title').addEventListener('input', syncFromToolbar);
  $('c-band-name').addEventListener('input', syncFromToolbar);
  $('c-lyrics-toggle').addEventListener('change', syncFromToolbar);

  // ============ Properties Panel UI 構築 ============
  buildTextSection($('c-text-controls'), state);
  buildEffectsSection($('c-effects-controls'), state);
  buildLogoSection($('c-logo-controls'), logo);

  // ============ 編集モード（ドラッグ配置） ============
  state.editMode = false;
  const editBtn = $('c-edit-mode-btn');
  editBtn.addEventListener('click', () => {
    state.editMode = !state.editMode;
    editBtn.classList.toggle('is-active', state.editMode);
    wrap.classList.toggle('is-edit-mode', state.editMode);
    dragMgr.setEnabled(state.editMode);
  });

  // ドラッグ対象を登録
  dragMgr.addItem({
    id: 'title',
    getBounds: (W, H) => {
      if (!state.title.visible || !state.title.text) return null;
      const fs = Math.round(H * 0.026 * state.title.sizeScale);
      return { cx: W * state.title.x, cy: H * state.title.y, w: Math.max(120, fs * state.title.text.length * 0.7), h: fs * 1.6 };
    },
    setPos: (x, y) => { state.title.x = x; state.title.y = y; },
  });
  dragMgr.addItem({
    id: 'band',
    getBounds: (W, H) => {
      if (!state.band.visible || !state.band.text) return null;
      const fs = Math.round(H * 0.026 * state.band.sizeScale);
      return { cx: W * state.band.x, cy: H * state.band.y, w: Math.max(120, fs * state.band.text.length * 0.7), h: fs * 1.6 };
    },
    setPos: (x, y) => { state.band.x = x; state.band.y = y; },
  });
  dragMgr.addItem({
    id: 'lyrics',
    getBounds: (W, H) => {
      const idx = lyrics.getCurrentIndex(audioGraph.audio?.currentTime || 0);
      const text = idx >= 0 ? lyrics.all[idx]?.text : '';
      if (!state.lyrics.enabled || !text) return null;
      const fs = Math.round(H * 0.026 * state.lyrics.sizeScale);
      return { cx: W * state.lyrics.x, cy: H * state.lyrics.y, w: Math.max(180, fs * text.length * 0.7), h: fs * 1.8 };
    },
    setPos: (x, y) => { state.lyrics.x = x; state.lyrics.y = y; },
  });
  dragMgr.addItem({
    id: 'logo',
    getBounds: (W, H) => {
      const b = logo.getBounds(W, H);
      if (!b || !logo.visible) return null;
      return { cx: W * logo.x, cy: H * logo.y, w: b.w, h: b.h };
    },
    setPos: (x, y) => { logo.x = x; logo.y = y; },
  });

  // ============ 描画ループ ============
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
    state.lastBass = state.lastBass * 0.85 + bass * 0.15;

    if ($('c-particles-toggle').checked) {
      particles.draw(ctx, W, H, state.lastBass);
    }

    const style = getStyleById(state.visualStyle);
    if (style) {
      style.drawFn(ctx, W, H, freq, time, state.lastBass, { showJacket: false });
    }

    // 歌詞インデックス・行開始時刻の追跡
    const ct = audioGraph.audio?.currentTime || 0;
    const idx = lyrics.getCurrentIndex(ct);
    if (idx !== state.lastLineIdx) {
      state.lastLineIdx = idx;
      state.lineStartTime = idx >= 0 ? (lyrics.all[idx]?.time ?? ct) : ct;
    }

    drawOverlay(ctx, W, H, {
      title: state.title,
      band: state.band,
      lyrics: {
        ...state.lyrics,
        currentLineIdx: idx,
        lineStartTime: state.lineStartTime,
      },
      lyricsData: lyrics,
      currentTime: ct,
      bass: state.lastBass,
    });

    logo.draw(ctx, W, H);

    dragMgr.drawHandles(ctx, W, H);

    requestAnimationFrame(render);
  }
  render();
}

// ============ Properties Panel ビルダー関数 ============

function buildTextSection(container, state) {
  container.innerHTML = '';
  container.appendChild(makeSubsection('タイトル', state.title));
  container.appendChild(makeSubsection('バンド名', state.band));
  container.appendChild(makeSubsection('歌詞', state.lyrics, true));
}

function makeSubsection(title, target, isLyrics = false) {
  const wrap = document.createElement('div');
  wrap.className = 'subsection';

  const t = document.createElement('div');
  t.className = 'subsection-title';
  t.textContent = title;
  wrap.appendChild(t);

  // フォント
  wrap.appendChild(makeFontField(target));
  // カラー
  wrap.appendChild(makeColorField(target));
  // サイズ
  wrap.appendChild(makeRangeField('サイズ', target, 'sizeScale', 0.5, 3.0, 0.05, v => v.toFixed(2) + 'x'));
  // シャドウ
  wrap.appendChild(makeRangeField('シャドウ', target, 'shadow', 0, 40, 1, v => v + 'px'));
  // 背景
  wrap.appendChild(makeBackgroundField(target));

  return wrap;
}

function makeFontField(target) {
  const row = document.createElement('div');
  row.className = 'field';

  const label = document.createElement('div');
  label.className = 'field-label';
  label.textContent = 'フォント';
  row.appendChild(label);

  const select = document.createElement('select');
  select.className = 'font-select';
  FONTS.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = `${f.label} — ${f.tag}`;
    opt.style.fontFamily = f.family;
    if (target.font === f.family) opt.selected = true;
    select.appendChild(opt);
  });
  row.appendChild(select);

  const preview = document.createElement('div');
  preview.className = 'font-preview';
  const updatePreview = () => {
    const f = getFontById(select.value);
    preview.style.fontFamily = f.family;
    preview.style.fontWeight = f.weight;
    preview.textContent = target.text || '迷彩 NiSSHëL';
  };
  select.addEventListener('change', () => {
    const f = getFontById(select.value);
    target.font = f.family;
    updatePreview();
  });
  updatePreview();
  row.appendChild(preview);

  return row;
}

function makeColorField(target) {
  const row = document.createElement('div');
  row.className = 'field-row';

  const label = document.createElement('div');
  label.className = 'field-label';
  label.textContent = 'カラー';

  const input = document.createElement('input');
  input.type = 'color';
  input.value = target.color;
  input.addEventListener('input', () => { target.color = input.value; });

  row.appendChild(label);
  row.appendChild(input);
  return row;
}

function makeRangeField(labelText, target, key, min, max, step, fmt) {
  const row = document.createElement('div');
  row.className = 'field-row';

  const label = document.createElement('div');
  label.className = 'field-label';
  label.textContent = labelText;
  row.appendChild(label);

  const rangeWrap = document.createElement('div');
  rangeWrap.className = 'range-row';
  rangeWrap.style.flex = '1';

  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = target[key];
  input.className = 'seek-bar';

  const valueEl = document.createElement('span');
  valueEl.className = 'value';
  valueEl.textContent = fmt(target[key]);

  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    target[key] = v;
    valueEl.textContent = fmt(v);
  });

  rangeWrap.appendChild(input);
  rangeWrap.appendChild(valueEl);
  row.appendChild(rangeWrap);

  return row;
}

function makeBackgroundField(target) {
  const row = document.createElement('div');
  row.className = 'field-row';

  const label = document.createElement('div');
  label.className = 'field-label';
  label.textContent = '背景';
  row.appendChild(label);

  const select = document.createElement('select');
  select.className = 'select';
  select.style.flex = '1';
  [
    ['none', 'なし'],
    ['bar', '半透明バー'],
    ['blur', 'ぼかしブロック'],
  ].forEach(([v, l]) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = l;
    if (target.background === v) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => { target.background = select.value; });
  row.appendChild(select);

  return row;
}

function buildEffectsSection(container, state) {
  container.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'field';

  const label = document.createElement('div');
  label.className = 'field-label';
  label.textContent = '歌詞エフェクト';
  row.appendChild(label);

  const select = document.createElement('select');
  select.className = 'select';
  EFFECTS.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.label;
    if (state.lyrics.effect === e.id) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => { state.lyrics.effect = select.value; });
  row.appendChild(select);

  const hint = document.createElement('div');
  hint.className = 'field-label';
  hint.style.fontSize = '10px';
  hint.style.lineHeight = '1.6';
  hint.style.marginTop = '4px';
  hint.textContent = 'グローは音の強さ、カラーシフトは時間で色が変化します。';
  row.appendChild(hint);

  container.appendChild(row);
}

function buildLogoSection(container, logo) {
  container.innerHTML = '';

  // アップロード
  const upRow = document.createElement('div');
  upRow.className = 'field';
  const upLabel = document.createElement('div');
  upLabel.className = 'field-label';
  upLabel.textContent = 'ロゴ画像 (PNG / SVG / JPG)';
  upRow.appendChild(upLabel);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/svg+xml,image/jpeg';
  fileInput.style.fontSize = '12px';
  fileInput.style.color = 'var(--fg-muted)';

  const preview = document.createElement('div');
  preview.className = 'logo-preview';
  const emptyText = document.createElement('span');
  emptyText.className = 'empty';
  emptyText.textContent = '未読込';
  preview.appendChild(emptyText);

  fileInput.addEventListener('change', async e => {
    const f = e.target.files?.[0];
    if (!f) return;
    await logo.loadFile(f);
    preview.innerHTML = '';
    const imgEl = document.createElement('img');
    imgEl.src = logo.img.src;
    preview.appendChild(imgEl);
  });

  upRow.appendChild(fileInput);
  upRow.appendChild(preview);
  container.appendChild(upRow);

  // 表示トグル
  const visRow = document.createElement('div');
  visRow.className = 'field-row';
  const visLabel = document.createElement('div');
  visLabel.className = 'field-label';
  visLabel.textContent = '表示';
  visRow.appendChild(visLabel);

  const toggle = document.createElement('label');
  toggle.className = 'toggle-switch';
  toggle.innerHTML = `<input type="checkbox" ${logo.visible ? 'checked' : ''}><span class="toggle-slider"></span>`;
  toggle.querySelector('input').addEventListener('change', e => { logo.visible = e.target.checked; });
  visRow.appendChild(toggle);
  container.appendChild(visRow);

  // サイズ
  const sizeRow = document.createElement('div');
  sizeRow.className = 'field-row';
  const sizeLabel = document.createElement('div');
  sizeLabel.className = 'field-label';
  sizeLabel.textContent = 'サイズ';
  sizeRow.appendChild(sizeLabel);
  const sizeWrap = document.createElement('div');
  sizeWrap.className = 'range-row';
  sizeWrap.style.flex = '1';
  const sizeInput = document.createElement('input');
  sizeInput.type = 'range';
  sizeInput.min = 0.05;
  sizeInput.max = 0.5;
  sizeInput.step = 0.01;
  sizeInput.value = logo.widthScale;
  sizeInput.className = 'seek-bar';
  const sizeVal = document.createElement('span');
  sizeVal.className = 'value';
  sizeVal.textContent = (logo.widthScale * 100).toFixed(0) + '%';
  sizeInput.addEventListener('input', () => {
    logo.widthScale = parseFloat(sizeInput.value);
    sizeVal.textContent = (logo.widthScale * 100).toFixed(0) + '%';
  });
  sizeWrap.appendChild(sizeInput);
  sizeWrap.appendChild(sizeVal);
  sizeRow.appendChild(sizeWrap);
  container.appendChild(sizeRow);

  // 不透明度
  const opRow = document.createElement('div');
  opRow.className = 'field-row';
  const opLabel = document.createElement('div');
  opLabel.className = 'field-label';
  opLabel.textContent = '不透明度';
  opRow.appendChild(opLabel);
  const opWrap = document.createElement('div');
  opWrap.className = 'range-row';
  opWrap.style.flex = '1';
  const opInput = document.createElement('input');
  opInput.type = 'range';
  opInput.min = 0;
  opInput.max = 1;
  opInput.step = 0.05;
  opInput.value = logo.opacity;
  opInput.className = 'seek-bar';
  const opVal = document.createElement('span');
  opVal.className = 'value';
  opVal.textContent = (logo.opacity * 100).toFixed(0) + '%';
  opInput.addEventListener('input', () => {
    logo.opacity = parseFloat(opInput.value);
    opVal.textContent = (logo.opacity * 100).toFixed(0) + '%';
  });
  opWrap.appendChild(opInput);
  opWrap.appendChild(opVal);
  opRow.appendChild(opWrap);
  container.appendChild(opRow);

  const hint = document.createElement('div');
  hint.className = 'field-label';
  hint.style.fontSize = '10px';
  hint.style.lineHeight = '1.6';
  hint.style.marginTop = '4px';
  hint.textContent = '位置はキャンバス右上の「✥ 配置編集」をONにしてドラッグで決定。';
  container.appendChild(hint);
}
```

- [ ] **Step 2: コミット**

```bash
git add docs/js/creator/creator-tab.js
git commit -m "feat: integrate properties panel, drag positioning, effects, logo in Creator"
```

---

## Phase 7: 最終確認

### Task 10: スモークテスト

- [ ] **Step 1: 構文チェック**

```bash
cd "C:\Users\kazu0\Claude\Visualizer作成"
node --check docs/js/creator/creator-tab.js
node --check docs/js/creator/logo.js
node --check docs/js/creator/text-positioning.js
node --check docs/js/creator/overlay.js
node --check docs/js/shared/fonts.js
node --check docs/js/shared/lyrics-render.js
```
Expected: 全て OK

- [ ] **Step 2: ローカルサーバー起動と HTTP 確認**

```bash
cd docs && python -m http.server 8765 &
sleep 2
curl -s -o /dev/null -w "%{http_code} /\n" http://localhost:8765/
curl -s -o /dev/null -w "%{http_code} fonts.js\n" http://localhost:8765/js/shared/fonts.js
curl -s -o /dev/null -w "%{http_code} logo.js\n" http://localhost:8765/js/creator/logo.js
curl -s -o /dev/null -w "%{http_code} text-positioning.js\n" http://localhost:8765/js/creator/text-positioning.js
curl -s -o /dev/null -w "%{http_code} creator-tab.js\n" http://localhost:8765/js/creator/creator-tab.js
```
Expected: 全て 200

- [ ] **Step 3: ブラウザ動作確認（手動）**

ブラウザで http://localhost:8765 を開いて Creator タブを表示。以下を目視確認：
- [ ] 右側に Properties Panel が表示される（テキスト・演出・ロゴの3アコーディオン）
- [ ] テキストセクション展開時、タイトル/バンド名/歌詞それぞれにフォント・カラー・サイズ・シャドウ・背景の設定が出る
- [ ] フォントドロップダウンに 13 種類が並び、サンプルプレビューがリアルタイム更新
- [ ] 演出セクションで6種類のエフェクトが選択できる
- [ ] ロゴセクションで画像アップロード後、サイズ・不透明度スライダーで調整できる
- [ ] キャンバス右上の「✥ 配置編集」ボタンをONにすると、要素に枠線が出てドラッグで動かせる

- [ ] **Step 4: サーバー停止**

```bash
for pid in $(netstat -ano | grep ':8765' | grep LISTEN | awk '{print $5}' | sort -u); do taskkill /F /PID $pid; done
```

---

## 完了基準

- [x] 13 種フォント実装（サンプルプレビュー付き）
- [x] タイトル / バンド名 / 歌詞それぞれ独立した装飾コントロール（フォント・カラー・サイズ・シャドウ・背景）
- [x] 歌詞エフェクト 6 種（fade / slide / typewriter / glow / colorshift / none）
- [x] バンドロゴ機能（アップロード・サイズ・不透明度・表示トグル）
- [x] ✥ 配置編集モードでタイトル・バンド名・歌詞・ロゴをドラッグ配置
- [x] Properties Panel が右サイドにアコーディオン UI で配置
- [x] コンソールエラーゼロ
- [x] HTTP 全エンドポイント 200

このプランが完了したら **Plan 3（動画背景: 複数クリップ・タイムライン・トリム）** へ進む。
