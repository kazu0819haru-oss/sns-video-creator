# Plan 4: SNS最適化機能（プラットフォームプリセット・イントロアウトロ・スマホプレビュー）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development

**Goal:** Creator タブに SNS ショート動画向けの 3 大機能を追加：①プラットフォームプリセット（TikTok/Reels/Shorts などの推奨設定とテキスト安全域オーバーレイ）②イントロ・アウトロカード（QRコード対応・録画範囲に含まれる）③スマホフレームプレビュー（投稿時の見え方リアルタイム確認）。

**Architecture:**
- プラットフォームプリセットは `platform-presets.js` の単純なデータレジストリ。選択時にアスペクト比 + 安全域オーバーレイを切替。安全域は **DOM オーバーレイ** で描画（Canvas に焼かないので録画には入らない）。
- イントロ/アウトロは `intro-outro.js` の状態 + 描画モジュール。再生時刻が intro/outro 範囲内なら他要素を覆って描画 → 録画にも含まれる。
- QRコードは `qrcode-generator` を CDN ESM で import、Canvas に描画。
- スマホプレビューは小型の `<canvas>` ミラーで、メインキャンバスから `drawImage` で同期表示。プラットフォーム UI はオーバーレイ画像（CSS で重ねるだけ）。

**Tech Stack:** Vanilla JS / ES Modules / Canvas API / CDN ESM import for qrcode-generator

**Note:** MP4 直接出力は技術的に複雑（WebCodecs API）なため **Plan 5** に分離。本プランでは録画は引き続き WebM。

---

## File Structure

```
docs/
├── index.html                              # 変更
├── css/ui.css                              # 変更
└── js/
    └── creator/
        ├── platform-presets.js             # NEW
        ├── intro-outro.js                  # NEW
        ├── phone-preview.js                # NEW
        └── creator-tab.js                  # 変更
```

---

## Task 1: `creator/platform-presets.js`

**File:** `docs/js/creator/platform-presets.js`

- [ ] **Step 1:** ファイル作成

```js
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
```

- [ ] **Step 2:** コミット

```bash
cd "C:\Users\kazu0\Claude\Visualizer作成"
git add docs/js/creator/platform-presets.js
git commit -m "feat: add platform presets registry (TikTok/Reels/Shorts/IG/YouTube)"
```

---

## Task 2: `creator/intro-outro.js`

**File:** `docs/js/creator/intro-outro.js`

- [ ] **Step 1:** ファイル作成

```js
// イントロ/アウトロカードの状態管理と Canvas 描画。
// QRコードは qrcode-generator を CDN ESM で動的 import。
//
// 状態:
//   intro: { enabled, duration (秒), title, subtitle, fadeOut (秒) }
//   outro: { enabled, duration (秒), title, subtitle, qrUrl, fadeIn (秒) }
//
// 再生時刻が範囲内なら Canvas を覆って描画される（録画にも含まれる）。

let qrLib = null;
async function loadQRLib() {
  if (qrLib) return qrLib;
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm');
    qrLib = mod.default;
    return qrLib;
  } catch (e) {
    console.error('QR ライブラリの読み込み失敗:', e);
    return null;
  }
}

export class IntroOutro {
  constructor() {
    this.intro = {
      enabled: false,
      duration: 3,
      title: '',
      subtitle: '',
      fadeOut: 0.6,
    };
    this.outro = {
      enabled: false,
      duration: 3,
      title: '',
      subtitle: '',
      qrUrl: '',
      fadeIn: 0.6,
    };
    this._qrCache = { url: '', dataUrl: '' };
  }

  async _renderQR(url) {
    if (!url) return null;
    if (this._qrCache.url === url && this._qrCache.dataUrl) return this._qrCache.dataUrl;
    const lib = await loadQRLib();
    if (!lib) return null;
    try {
      const qr = lib(0, 'M');
      qr.addData(url);
      qr.make();
      const dataUrl = qr.createDataURL(8, 4);
      this._qrCache = { url, dataUrl };
      return dataUrl;
    } catch (e) {
      console.error('QR 生成失敗:', e);
      return null;
    }
  }

  // intro/outro の表示状態を返す。caller が他の描画を抑制するか判断に使う。
  // currentTime, audioDuration はトリム適用後の effective 時刻を渡す。
  getActiveOverlay(currentTime, totalDuration) {
    if (this.intro.enabled && currentTime < this.intro.duration) {
      const fadeStart = this.intro.duration - this.intro.fadeOut;
      const alpha = currentTime < fadeStart ? 1 : Math.max(0, 1 - (currentTime - fadeStart) / this.intro.fadeOut);
      return { kind: 'intro', alpha, data: this.intro };
    }
    if (this.outro.enabled && totalDuration > 0) {
      const outroStart = totalDuration - this.outro.duration;
      if (currentTime >= outroStart) {
        const fadeEnd = outroStart + this.outro.fadeIn;
        const alpha = currentTime > fadeEnd ? 1 : Math.max(0, (currentTime - outroStart) / this.outro.fadeIn);
        return { kind: 'outro', alpha, data: this.outro };
      }
    }
    return null;
  }

  // active が intro / outro のときに Canvas を覆って描画
  async draw(ctx, W, H, active) {
    if (!active) return;
    const a = active.alpha;
    const d = active.data;

    ctx.save();
    ctx.globalAlpha = a;

    // 黒背景
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);

    // タイトル
    if (d.title) {
      const fs = Math.round(H * 0.06);
      ctx.font = `700 ${fs}px "Anton", "Shippori Mincho B1", sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 12;
      const titleY = active.kind === 'outro' && d.qrUrl ? H * 0.3 : H * 0.4;
      ctx.fillText(d.title, W / 2, titleY);
    }

    if (d.subtitle) {
      const fs = Math.round(H * 0.025);
      ctx.font = `400 ${fs}px "Shippori Mincho B1", serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 8;
      const subY = active.kind === 'outro' && d.qrUrl ? H * 0.38 : H * 0.5;
      ctx.fillText(d.subtitle, W / 2, subY);
    }

    // QRコード（outro のみ）
    if (active.kind === 'outro' && d.qrUrl) {
      const dataUrl = await this._renderQR(d.qrUrl);
      if (dataUrl) {
        const img = await this._loadImage(dataUrl);
        if (img) {
          const size = Math.min(W, H) * 0.3;
          const x = W / 2 - size / 2;
          const y = H * 0.55;
          ctx.drawImage(img, x, y, size, size);
          // QRの下にURL表示
          ctx.font = `500 ${Math.round(H * 0.018)}px "Inter", sans-serif`;
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.shadowBlur = 0;
          ctx.fillText(d.qrUrl, W / 2, y + size + Math.round(H * 0.035));
        }
      }
    }

    ctx.restore();
  }

  _loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
}
```

- [ ] **Step 2:** コミット

```bash
git add docs/js/creator/intro-outro.js
git commit -m "feat: add IntroOutro module with QR code support"
```

---

## Task 3: `creator/phone-preview.js`

**File:** `docs/js/creator/phone-preview.js`

- [ ] **Step 1:** ファイル作成

```js
// スマホフレームプレビュー。メインキャンバスの内容を小型キャンバスにミラーリングし、
// プラットフォーム UI スケルトン（コメント・いいねボタンなど）を半透明で重ねる。
//
// presetId に応じてプラットフォーム別 UI を表示。
export class PhonePreview {
  constructor(canvasEl, mainCanvas) {
    this.canvas = canvasEl;
    this.mainCanvas = mainCanvas;
    this.ctx = canvasEl.getContext('2d');
    this.presetId = null;
    this.enabled = true;
  }

  setPreset(id) { this.presetId = id; }
  setEnabled(on) { this.enabled = on; }

  draw() {
    if (!this.enabled) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    this.ctx.clearRect(0, 0, W, H);
    // メインキャンバスをフィット描画
    const mw = this.mainCanvas.width;
    const mh = this.mainCanvas.height;
    const scale = Math.min(W / mw, H / mh);
    const dw = mw * scale;
    const dh = mh * scale;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, W, H);
    try { this.ctx.drawImage(this.mainCanvas, dx, dy, dw, dh); } catch (_) {}

    // プラットフォーム UI スケルトン
    if (this.presetId === 'tiktok') this._drawTikTokUI(dx, dy, dw, dh);
    else if (this.presetId === 'reels') this._drawReelsUI(dx, dy, dw, dh);
    else if (this.presetId === 'shorts') this._drawShortsUI(dx, dy, dw, dh);
  }

  _drawIcon(x, y, label) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = '600 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
  }

  _drawTikTokUI(dx, dy, dw, dh) {
    const ctx = this.ctx;
    ctx.save();
    // 右側アイコン群
    const rightX = dx + dw - 22;
    [0, 1, 2, 3].forEach(i => this._drawIcon(rightX, dy + dh - 70 - i * 40, '♥'));
    // 下部キャプション領域（半透明帯）
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(dx, dy + dh - 50, dw - 50, 50);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('@user_name', dx + 8, dy + dh - 32);
    ctx.fillText('#NiSSHëL #迷彩 #バンド', dx + 8, dy + dh - 18);
    ctx.restore();
  }

  _drawReelsUI(dx, dy, dw, dh) {
    const ctx = this.ctx;
    ctx.save();
    const rightX = dx + dw - 22;
    ['♥', '💬', '➤', '⋯'].forEach((emoji, i) => this._drawIcon(rightX, dy + dh - 100 - i * 40, emoji));
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(dx, dy + dh - 60, dw, 60);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('user_name •  followed', dx + 8, dy + dh - 40);
    ctx.fillText('♪ Original audio · NiSSHëL', dx + 8, dy + dh - 24);
    ctx.restore();
  }

  _drawShortsUI(dx, dy, dw, dh) {
    const ctx = this.ctx;
    ctx.save();
    const rightX = dx + dw - 22;
    ['👍', '👎', '💬', '➤'].forEach((emoji, i) => this._drawIcon(rightX, dy + dh - 110 - i * 40, emoji));
    // 下部のショートUI
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(dx, dy + dh - 50, dw, 50);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '600 9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('▶ チャンネル名', dx + 8, dy + dh - 32);
    ctx.fillText('登録', dx + dw - 50, dy + dh - 28);
    ctx.restore();
  }
}
```

- [ ] **Step 2:** コミット

```bash
git add docs/js/creator/phone-preview.js
git commit -m "feat: add PhonePreview component with platform UI skeletons"
```

---

## Task 4: `index.html` 更新

**File:** `docs/index.html`

- [ ] **Step 1:** Creator ツールバーの背景モード select の前にプラットフォームプリセット select を追加

`<select class="select" id="c-bg-mode-select" ...>` の **前** に挿入：

```html
    <select class="select" id="c-preset-select" title="プラットフォームプリセット">
      <option value="">プラットフォーム…</option>
    </select>
```

- [ ] **Step 2:** Creator キャンバスラップ内に Safe Zone Overlay コンテナを追加

`<button class="btn edit-mode-btn" id="c-edit-mode-btn" ...>✥ 配置編集</button>` の **直後**、`</div>` (canvas-wrap の閉じ) の **前** に：

```html
        <div class="safe-zones" id="c-safe-zones" hidden>
          <div class="safe-zone safe-zone--top"></div>
          <div class="safe-zone safe-zone--bottom"></div>
          <div class="safe-zone safe-zone--left"></div>
          <div class="safe-zone safe-zone--right"></div>
        </div>
```

- [ ] **Step 3:** Properties Panel に「📱 SNS最適化」アコーディオンを追加（ロゴアコーディオンの後）

既存の `<details class="accordion"><summary>🎯 ロゴ</summary>...</details>` の **直後** に：

```html
      <!-- SNS section -->
      <details class="accordion">
        <summary>📱 SNS最適化</summary>
        <div class="accordion-body" id="c-sns-controls"></div>
      </details>
```

- [ ] **Step 4:** Properties Panel の下にスマホプレビューを追加

`</aside>` の **直前** に：

```html
        <details class="accordion">
          <summary>📲 スマホプレビュー</summary>
          <div class="accordion-body" style="padding:8px">
            <canvas id="c-phone-canvas" width="240" height="427" style="width:100%;border-radius:18px;background:#000;border:6px solid #1a1a1a;box-shadow:0 4px 20px rgba(0,0,0,0.6)"></canvas>
          </div>
        </details>
```

- [ ] **Step 5:** コミット

```bash
git add docs/index.html
git commit -m "feat: add preset select, safe zones, SNS panel, phone preview HTML"
```

---

## Task 5: CSS 追加

**File:** `docs/css/ui.css`

- [ ] **Step 1:** ファイル末尾に追記

```css
/* ============ Safe Zones Overlay ============ */
.safe-zones {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}
.safe-zones[hidden] { display: none; }
.safe-zone {
  position: absolute;
  background: rgba(229, 30, 48, 0.18);
  border: 1px dashed rgba(229, 30, 48, 0.6);
}
.safe-zone--top    { top: 0; left: 0; right: 0; }
.safe-zone--bottom { bottom: 0; left: 0; right: 0; }
.safe-zone--left   { top: 0; bottom: 0; left: 0; }
.safe-zone--right  { top: 0; bottom: 0; right: 0; }

/* ============ Phone Preview ============ */
#c-phone-canvas {
  aspect-ratio: 9/16;
  display: block;
}

/* ============ SNS panel hint ============ */
.sns-panel-hint {
  font-size: 11px;
  color: var(--fg-muted);
  line-height: 1.6;
  padding: 8px 10px;
  background: rgba(26, 157, 82, 0.08);
  border: 1px solid rgba(26, 157, 82, 0.25);
  border-radius: var(--radius-sm);
}
.duration-warning {
  font-size: 11px;
  color: #ff9b6b;
  padding: 8px 10px;
  background: rgba(255, 100, 50, 0.08);
  border: 1px solid rgba(255, 100, 50, 0.3);
  border-radius: var(--radius-sm);
  display: none;
}
.duration-warning.is-visible { display: block; }
```

- [ ] **Step 2:** コミット

```bash
git add docs/css/ui.css
git commit -m "feat: add CSS for safe zones, phone preview, SNS panel"
```

---

## Task 6: `creator-tab.js` 統合

**File:** `docs/js/creator/creator-tab.js`

複数のピンポイント編集が必要。各編集の old_string を正確に指定して Edit すること。

- [ ] **Step 1:** import 追加

`import { Timeline } from './timeline.js';` の **直後** に：

```js
import { PRESETS, getPresetById } from './platform-presets.js';
import { IntroOutro } from './intro-outro.js';
import { PhonePreview } from './phone-preview.js';
```

- [ ] **Step 2:** インスタンス追加

`let timeline = null;` の **直後** に：

```js
  const introOutro = new IntroOutro();
  let phonePreview = null;
  let activePresetId = null;
```

- [ ] **Step 3:** プリセット select の処理を追加（背景モード切替ハンドラの **前**）

`// 背景モード切替` のコメント行の **前** に：

```js
  // プラットフォームプリセット
  const presetSel = $('c-preset-select');
  PRESETS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.icon} ${p.label}`;
    presetSel.appendChild(opt);
  });
  presetSel.addEventListener('change', () => {
    const id = presetSel.value;
    activePresetId = id || null;
    const preset = getPresetById(id);
    if (preset) {
      // アスペクト比を適用
      $('c-aspect-select').value = preset.aspect;
      $('c-aspect-select').dispatchEvent(new Event('change'));
      // 安全域オーバーレイを適用
      applySafeZones(preset.safeZones);
    } else {
      applySafeZones(null);
    }
    if (phonePreview) phonePreview.setPreset(id);
  });

  function applySafeZones(zones) {
    const cont = $('c-safe-zones');
    if (!zones) {
      cont.hidden = true;
      return;
    }
    cont.hidden = false;
    cont.querySelector('.safe-zone--top').style.height = `${zones.top || 0}%`;
    cont.querySelector('.safe-zone--bottom').style.height = `${zones.bottom || 0}%`;
    cont.querySelector('.safe-zone--left').style.width = `${zones.left || 0}%`;
    cont.querySelector('.safe-zone--right').style.width = `${zones.right || 0}%`;
  }
```

- [ ] **Step 4:** SNS パネル UI ビルダーを追加

`buildLogoSection($('c-logo-controls'), logo);` の **直後** に：

```js
  buildSnsSection($('c-sns-controls'), introOutro, () => state.trackTitle);
```

そしてファイル末尾の関数群（`function buildLogoSection(container, logo) { ... }` の **後**）に追加：

```js
function buildSnsSection(container, introOutro, getTrackTitle) {
  container.innerHTML = '';

  const hint = document.createElement('div');
  hint.className = 'sns-panel-hint';
  hint.textContent = 'イントロ・アウトロカードは録画に含まれます。プラットフォームプリセットを選ぶと安全域がプレビュー表示されます（録画には入りません）。';
  container.appendChild(hint);

  // ========== INTRO ==========
  container.appendChild(makeSnsSubsection('イントロカード', introOutro.intro, [
    { key: 'enabled', type: 'toggle', label: '表示' },
    { key: 'duration', type: 'range', label: '秒数', min: 1, max: 6, step: 0.5, fmt: v => v + 's' },
    { key: 'title', type: 'text', label: 'タイトル', placeholder: '曲名（空なら現在の曲名）' },
    { key: 'subtitle', type: 'text', label: 'サブ', placeholder: 'バンド名や説明' },
  ]));

  // ========== OUTRO ==========
  container.appendChild(makeSnsSubsection('アウトロカード', introOutro.outro, [
    { key: 'enabled', type: 'toggle', label: '表示' },
    { key: 'duration', type: 'range', label: '秒数', min: 1, max: 6, step: 0.5, fmt: v => v + 's' },
    { key: 'title', type: 'text', label: 'タイトル', placeholder: 'Follow / Listen' },
    { key: 'subtitle', type: 'text', label: 'サブ', placeholder: '@your_handle' },
    { key: 'qrUrl', type: 'text', label: 'QR URL', placeholder: 'https://...' },
  ]));
}

function makeSnsSubsection(title, target, fields) {
  const wrap = document.createElement('div');
  wrap.className = 'subsection';
  const t = document.createElement('div');
  t.className = 'subsection-title';
  t.textContent = title;
  wrap.appendChild(t);

  fields.forEach(f => {
    if (f.type === 'toggle') {
      const row = document.createElement('div');
      row.className = 'field-row';
      const lab = document.createElement('div');
      lab.className = 'field-label';
      lab.textContent = f.label;
      row.appendChild(lab);
      const sw = document.createElement('label');
      sw.className = 'toggle-switch';
      sw.innerHTML = `<input type="checkbox" ${target[f.key] ? 'checked' : ''}><span class="toggle-slider"></span>`;
      sw.querySelector('input').addEventListener('change', e => { target[f.key] = e.target.checked; });
      row.appendChild(sw);
      wrap.appendChild(row);
    } else if (f.type === 'range') {
      const row = document.createElement('div');
      row.className = 'field-row';
      const lab = document.createElement('div');
      lab.className = 'field-label';
      lab.textContent = f.label;
      row.appendChild(lab);
      const rw = document.createElement('div');
      rw.className = 'range-row';
      rw.style.flex = '1';
      const inp = document.createElement('input');
      inp.type = 'range';
      inp.min = f.min; inp.max = f.max; inp.step = f.step;
      inp.value = target[f.key];
      inp.className = 'seek-bar';
      const v = document.createElement('span');
      v.className = 'value';
      v.textContent = f.fmt(target[f.key]);
      inp.addEventListener('input', () => {
        target[f.key] = parseFloat(inp.value);
        v.textContent = f.fmt(target[f.key]);
      });
      rw.appendChild(inp); rw.appendChild(v);
      row.appendChild(rw);
      wrap.appendChild(row);
    } else if (f.type === 'text') {
      const row = document.createElement('div');
      row.className = 'field';
      const lab = document.createElement('div');
      lab.className = 'field-label';
      lab.textContent = f.label;
      row.appendChild(lab);
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.className = 'text-input';
      inp.placeholder = f.placeholder || '';
      inp.value = target[f.key] || '';
      inp.style.width = '100%';
      inp.addEventListener('input', () => { target[f.key] = inp.value; });
      row.appendChild(inp);
      wrap.appendChild(row);
    }
  });

  return wrap;
}
```

- [ ] **Step 5:** PhonePreview インスタンス化

`timeline = new Timeline(...)` の **直後** に：

```js
  const phoneCanvas = document.getElementById('c-phone-canvas');
  if (phoneCanvas) {
    phonePreview = new PhonePreview(phoneCanvas, canvas);
  }
```

- [ ] **Step 6:** render ループで intro/outro と phone preview を呼ぶ

`function render() {` の中、`logo.draw(ctx, W, H);` の **直後**、`dragMgr.drawHandles(ctx, W, H);` の **前** に：

```js
    // intro/outro オーバーレイ（録画に含める）
    const ct = audioGraph.audio?.currentTime || 0;
    const eff = audioTrim.effectiveTime(ct);
    const totalEff = audioTrim.effectiveDuration();
    const overlay = introOutro.getActiveOverlay(eff, totalEff);
    if (overlay) {
      introOutro.draw(ctx, W, H, overlay).catch(e => console.error(e));
    }
```

`requestAnimationFrame(render);` の **直前**（render の末尾）に：

```js
    if (phonePreview) phonePreview.draw();
```

- [ ] **Step 7:** イントロのデフォルト値を曲名と連動させる（loadAudio内、`stepGuide.markDone(0);` の **前**）

```js
      // イントロのタイトルが空なら trackTitle を自動補完表示用に
      if (!introOutro.intro.title) introOutro.intro.title = state.trackTitle;
```

- [ ] **Step 8:** コミット

```bash
git add docs/js/creator/creator-tab.js
git commit -m "feat: integrate platform presets, intro/outro, phone preview in Creator"
```

---

## Task 7: スモークテスト

- [ ] **Step 1:** 構文チェック

```bash
cd "C:\Users\kazu0\Claude\Visualizer作成"
node --check docs/js/creator/platform-presets.js
node --check docs/js/creator/intro-outro.js
node --check docs/js/creator/phone-preview.js
node --check docs/js/creator/creator-tab.js
```
Expected: 全 OK

- [ ] **Step 2:** HTTP 確認

```bash
cd docs && python -m http.server 8765 &
sleep 2
for url in / /js/creator/platform-presets.js /js/creator/intro-outro.js /js/creator/phone-preview.js; do
  printf "%s: " "$url"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8765$url"
done
for pid in $(netstat -ano | grep ':8765' | grep LISTEN | awk '{print $5}' | sort -u); do taskkill /F /PID $pid 2>/dev/null; done
```
Expected: 全 200

- [ ] **Step 3:** ブラウザ目視確認

- [ ] プラットフォームプリセット select が表示・5項目選べる
- [ ] TikTok 選択時、9:16 になり、上下/右に赤い安全域オーバーレイが出る
- [ ] Properties Panel に「📱 SNS最適化」と「📲 スマホプレビュー」アコーディオンが追加
- [ ] イントロ/アウトロのトグル・秒数・テキスト入力が動作
- [ ] QR URL を入れて再生 → アウトロカード時にQRが表示される
- [ ] スマホプレビューがメインキャンバスをミラーする
- [ ] TikTok/Reels/Shorts プリセット選択時、スマホプレビューに対応する UI スケルトンが重なる

---

## 完了基準

- [x] 5 種のプラットフォームプリセット適用（アスペクト比＋安全域）
- [x] 安全域は DOM オーバーレイで Canvas に焼かない（録画に入らない）
- [x] イントロ・アウトロカード（タイトル・サブ・QRコード対応）
- [x] スマホプレビューパネル（ミラー＋プラットフォーム UI スケルトン）
- [x] 構文 OK・HTTP 200

完了後は **Plan 5（MP4 直接出力 via WebCodecs + mp4-muxer）** へ進む。
