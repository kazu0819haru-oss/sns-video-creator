# Plan 3: 動画背景・タイムライン・トリム Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development

**Goal:** Creator タブに **背景モード切替**（Visualizer / Video）を追加し、Video モードでは **複数の動画クリップをタイムラインで管理**（追加・削除・順序入れ替え・両端トリム）できるようにする。**音源にもトリム**を追加。動画クリップは音源の再生位置に同期してキャンバスに描画され、ビジュアライザーエフェクトは Video モードでは無効化される。

**Architecture:**
- 音源が **マスタータイムライン**。再生位置（trim 適用後）から、現在再生すべき動画クリップとそのローカル時刻を算出。
- 動画クリップは hidden `<video>` 要素として個別にインスタンス化。アクティブクリップが切り替わるタイミングで `video.play()` + `currentTime` セット。
- レンダーループ毎にアクティブクリップの `<video>` を `ctx.drawImage` で canvas にフィット描画。
- タイムラインは DOM ベース（pure CSS バー + range 風ハンドル）。Video モード時のみキャンバス下に表示。

**Tech Stack:** 既存 Vanilla JS / ES Modules / Canvas API / HTMLVideoElement

---

## File Structure

```
docs/
├── index.html                       # 変更: 背景モード select + タイムラインパネル
├── css/
│   └── ui.css                       # 変更: タイムライン UI
└── js/
    ├── shared/
    │   └── file-drop.js             # 変更: onVideo コールバック追加
    └── creator/
        ├── video-clips.js           # NEW: 動画クリップ管理＋描画エンジン
        ├── audio-trim.js            # NEW: 音源トリム状態管理
        ├── timeline.js              # NEW: タイムライン DOM コンポーネント
        └── creator-tab.js           # 変更: 背景モード切替・統合
```

---

## Task 1: `shared/file-drop.js` に動画判定追加

**File:** `docs/js/shared/file-drop.js`

- [ ] **Step 1:** ファイル種別判定に動画を追加

`getFileKind` 関数内で audio チェックの直後に video を追加：

```js
const VIDEO_EXT = ['.mp4', '.mov', '.webm', '.mkv', '.avi'];

export function getFileKind(file) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('video/') || VIDEO_EXT.some(ext => name.endsWith(ext))) return 'video';
  if (file.type.startsWith('audio/') || AUDIO_EXT.some(ext => name.endsWith(ext))) return 'audio';
  if (LRC_EXT.some(ext => name.endsWith(ext))) return 'lrc';
  if (file.type.startsWith('image/')) return 'image';
  return 'unknown';
}
```

`attachFileDrop` の `drop` ハンドラ内で video 分岐も追加：

```js
else if (kind === 'video' && opts.onVideo) opts.onVideo(f);
```

**注意：** `audio` 判定は `video/` 判定の後にすること（video ファイルにも audio MIME が含まれることがあるため）。

- [ ] **Step 2:** コミット

```bash
cd "C:\Users\kazu0\Claude\Visualizer作成"
git add docs/js/shared/file-drop.js
git commit -m "feat: support video files in file-drop utility"
```

---

## Task 2: `creator/video-clips.js` を作成

**File:** `docs/js/creator/video-clips.js`

- [ ] **Step 1:** ファイル作成

```js
// 動画クリップの管理と Canvas 描画。
// 音源のトリム後再生位置から、現在再生すべきクリップとそのローカル時刻を算出する。
//
// 各クリップ: { id, file, video (HTMLVideoElement), name, duration, trimStart, trimEnd }
//   trimStart, trimEnd は秒。trimEnd === null は「最後まで」。
export class VideoClips {
  constructor() {
    this.clips = [];
    this.activeIdx = -1;
    this.onChange = null; // タイムライン UI 再描画用
  }

  _notify() { if (this.onChange) this.onChange(); }

  async addClip(file) {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('動画読み込み失敗: ' + file.name));
    });
    const clip = {
      id: Date.now() + Math.random(),
      file,
      video,
      name: file.name,
      duration: video.duration,
      trimStart: 0,
      trimEnd: video.duration,
    };
    this.clips.push(clip);
    this._notify();
    return clip;
  }

  removeClip(idx) {
    const c = this.clips[idx];
    if (!c) return;
    try { URL.revokeObjectURL(c.video.src); } catch (_) {}
    this.clips.splice(idx, 1);
    if (this.activeIdx >= this.clips.length) this.activeIdx = -1;
    this._notify();
  }

  moveClip(idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= this.clips.length) return;
    [this.clips[idx], this.clips[j]] = [this.clips[j], this.clips[idx]];
    this._notify();
  }

  setTrim(idx, trimStart, trimEnd) {
    const c = this.clips[idx];
    if (!c) return;
    c.trimStart = Math.max(0, Math.min(trimStart, c.duration));
    c.trimEnd = Math.max(c.trimStart, Math.min(trimEnd, c.duration));
    this._notify();
  }

  // 配列順での合計（トリム済み）尺
  totalDuration() {
    return this.clips.reduce((s, c) => s + (c.trimEnd - c.trimStart), 0);
  }

  // 指定 elapsed (秒) に該当するクリップ index + ローカル時刻を返す
  getActiveAt(elapsed) {
    let acc = 0;
    for (let i = 0; i < this.clips.length; i++) {
      const c = this.clips[i];
      const dur = c.trimEnd - c.trimStart;
      if (elapsed < acc + dur) {
        return { idx: i, localTime: c.trimStart + (elapsed - acc) };
      }
      acc += dur;
    }
    return null; // 全クリップ終了後
  }

  // 音源再生位置に合わせて active クリップを同期。
  // isPlaying: 音源が再生中か。クリップ切替時 play() を呼ぶ。
  sync(elapsed, isPlaying) {
    const target = this.getActiveAt(elapsed);
    if (!target) {
      // クリップ範囲外 → すべて停止
      if (this.activeIdx >= 0) {
        const prev = this.clips[this.activeIdx];
        if (prev) prev.video.pause();
        this.activeIdx = -1;
      }
      return;
    }
    if (target.idx !== this.activeIdx) {
      if (this.activeIdx >= 0) {
        const prev = this.clips[this.activeIdx];
        if (prev) prev.video.pause();
      }
      this.activeIdx = target.idx;
    }
    const active = this.clips[this.activeIdx];
    if (!active) return;
    // ドリフトが大きければ currentTime 補正
    const drift = Math.abs(active.video.currentTime - target.localTime);
    if (drift > 0.25) {
      active.video.currentTime = target.localTime;
    }
    if (isPlaying) {
      if (active.video.paused) active.video.play().catch(() => {});
    } else {
      if (!active.video.paused) active.video.pause();
    }
  }

  pauseAll() {
    for (const c of this.clips) {
      if (!c.video.paused) c.video.pause();
    }
  }

  // 現在の active クリップを canvas にフィット描画（cover）
  draw(ctx, W, H) {
    if (this.activeIdx < 0) return;
    const c = this.clips[this.activeIdx];
    if (!c || c.video.readyState < 2) return;
    const vw = c.video.videoWidth;
    const vh = c.video.videoHeight;
    if (!vw || !vh) return;
    // object-fit: cover
    const scale = Math.max(W / vw, H / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;
    ctx.drawImage(c.video, dx, dy, dw, dh);
  }
}
```

- [ ] **Step 2:** コミット

```bash
git add docs/js/creator/video-clips.js
git commit -m "feat: add VideoClips module for multi-clip playback engine"
```

---

## Task 3: `creator/audio-trim.js` を作成

**File:** `docs/js/creator/audio-trim.js`

- [ ] **Step 1:** ファイル作成

```js
// 音源の trim 状態管理。
// trimStart / trimEnd（秒）を保持し、再生中の trim 範囲外を補正する。
export class AudioTrim {
  constructor() {
    this.trimStart = 0;
    this.trimEnd = null; // null = 末尾まで
    this.duration = 0;
  }

  setDuration(dur) {
    this.duration = dur;
    if (this.trimEnd === null) this.trimEnd = dur;
  }

  setStart(t) {
    this.trimStart = Math.max(0, Math.min(t, this.trimEnd ?? this.duration));
  }

  setEnd(t) {
    this.trimEnd = Math.max(this.trimStart, Math.min(t, this.duration));
  }

  // audio.currentTime を effective 時刻に変換（trimStart からの相対秒）
  effectiveTime(currentTime) {
    return Math.max(0, currentTime - this.trimStart);
  }

  effectiveDuration() {
    return Math.max(0, (this.trimEnd ?? this.duration) - this.trimStart);
  }

  // audio.currentTime が trim 範囲外なら trimStart / trimEnd にスナップして返す
  // 戻り値: { snappedTime, ended }
  snap(currentTime) {
    const end = this.trimEnd ?? this.duration;
    if (currentTime < this.trimStart) return { snappedTime: this.trimStart, ended: false };
    if (currentTime >= end) return { snappedTime: end, ended: true };
    return { snappedTime: currentTime, ended: false };
  }
}
```

- [ ] **Step 2:** コミット

```bash
git add docs/js/creator/audio-trim.js
git commit -m "feat: add AudioTrim state module"
```

---

## Task 4: `creator/timeline.js` を作成

**File:** `docs/js/creator/timeline.js`

- [ ] **Step 1:** ファイル作成

```js
// タイムライン DOM コンポーネント。音源バー + 動画クリップトラックを表示。
// 各バーの両端にトリムハンドルを置き、ドラッグで秒値を更新する。
export class Timeline {
  constructor(container, { audioTrim, videoClips, onPickVideo, onSeek, getCurrentTime }) {
    this.container = container;
    this.audioTrim = audioTrim;
    this.videoClips = videoClips;
    this.onPickVideo = onPickVideo;     // クリップ追加ボタンが押されたときのコールバック
    this.onSeek = onSeek;                // ユーザーがプレイヘッドを動かしたとき
    this.getCurrentTime = getCurrentTime; // 現在の audio.currentTime を返す関数
    this.render();
    this.videoClips.onChange = () => this.render();
  }

  // 秒 → ピクセル換算（全体幅 = max(audioTrim.duration, videoClips.totalDuration())）
  _scale() {
    const total = Math.max(this.audioTrim.duration || 0, this.videoClips.totalDuration());
    const W = this.container.clientWidth - 80; // ラベル幅分マージン
    return total > 0 ? W / total : 0;
  }

  render() {
    this.container.innerHTML = '';
    this.container.appendChild(this._buildAudioRow());
    this.container.appendChild(this._buildVideoRow());
    this._installPlayheadLoop();
  }

  _buildAudioRow() {
    const row = document.createElement('div');
    row.className = 'tl-row';

    const label = document.createElement('div');
    label.className = 'tl-label';
    label.textContent = '音源';
    row.appendChild(label);

    const track = document.createElement('div');
    track.className = 'tl-track';
    row.appendChild(track);

    if (this.audioTrim.duration > 0) {
      const scale = this._scale();
      const totalPx = this.audioTrim.duration * scale;
      const bar = document.createElement('div');
      bar.className = 'tl-bar tl-bar--audio';
      bar.style.width = `${totalPx}px`;
      track.appendChild(bar);

      const fill = document.createElement('div');
      fill.className = 'tl-bar-fill tl-bar-fill--audio';
      bar.appendChild(fill);

      this._addTrimHandles(bar, fill, this.audioTrim.duration, () => this.audioTrim.trimStart, () => this.audioTrim.trimEnd ?? this.audioTrim.duration, (s) => this.audioTrim.setStart(s), (e) => this.audioTrim.setEnd(e));

      // プレイヘッド
      const ph = document.createElement('div');
      ph.className = 'tl-playhead';
      ph.id = 'tl-playhead';
      bar.appendChild(ph);
    } else {
      track.innerHTML = '<span class="tl-empty">音源を読み込むとここにタイムラインが表示されます</span>';
    }

    return row;
  }

  _buildVideoRow() {
    const row = document.createElement('div');
    row.className = 'tl-row';

    const label = document.createElement('div');
    label.className = 'tl-label';
    label.textContent = '動画';
    row.appendChild(label);

    const track = document.createElement('div');
    track.className = 'tl-track';
    row.appendChild(track);

    const scale = this._scale();

    this.videoClips.clips.forEach((clip, i) => {
      const trimDur = clip.trimEnd - clip.trimStart;
      const bar = document.createElement('div');
      bar.className = 'tl-bar tl-bar--video';
      bar.style.width = `${Math.max(60, trimDur * scale)}px`;
      bar.title = clip.name;

      const fill = document.createElement('div');
      fill.className = 'tl-bar-fill tl-bar-fill--video';
      bar.appendChild(fill);

      const name = document.createElement('span');
      name.className = 'tl-clip-name';
      name.textContent = clip.name;
      fill.appendChild(name);

      // 順序入れ替え + 削除
      const tools = document.createElement('div');
      tools.className = 'tl-clip-tools';
      const upBtn = this._mkToolBtn('◀', '前へ', i > 0, () => this.videoClips.moveClip(i, -1));
      const downBtn = this._mkToolBtn('▶', '次へ', i < this.videoClips.clips.length - 1, () => this.videoClips.moveClip(i, 1));
      const delBtn = this._mkToolBtn('×', '削除', true, () => this.videoClips.removeClip(i));
      delBtn.classList.add('tl-tool--danger');
      tools.appendChild(upBtn);
      tools.appendChild(downBtn);
      tools.appendChild(delBtn);
      bar.appendChild(tools);

      // クリップ自体のトリムハンドル（in/out は元クリップの長さ基準）
      this._addTrimHandles(
        bar, fill, clip.duration,
        () => clip.trimStart,
        () => clip.trimEnd,
        (s) => this.videoClips.setTrim(i, s, clip.trimEnd),
        (e) => this.videoClips.setTrim(i, clip.trimStart, e),
        true /* localScale: バー自身の幅で換算 */
      );

      track.appendChild(bar);
    });

    // 追加ボタン
    const addBtn = document.createElement('button');
    addBtn.className = 'tl-add-btn';
    addBtn.textContent = '＋ クリップ追加';
    addBtn.addEventListener('click', () => this.onPickVideo && this.onPickVideo());
    track.appendChild(addBtn);

    return row;
  }

  _mkToolBtn(text, title, enabled, onClick) {
    const btn = document.createElement('button');
    btn.className = 'tl-tool-btn';
    btn.textContent = text;
    btn.title = title;
    btn.disabled = !enabled;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  // 両端ハンドルとフィル領域の幅を反映する。localScale=true なら bar.clientWidth から逆算。
  _addTrimHandles(bar, fill, duration, getStart, getEnd, setStart, setEnd, localScale = false) {
    const leftH = document.createElement('div');
    leftH.className = 'tl-handle tl-handle--left';
    const rightH = document.createElement('div');
    rightH.className = 'tl-handle tl-handle--right';
    bar.appendChild(leftH);
    bar.appendChild(rightH);

    const updateFill = () => {
      const w = bar.clientWidth || 1;
      const s = getStart();
      const e = getEnd();
      const left = (s / duration) * w;
      const right = (e / duration) * w;
      fill.style.left = `${left}px`;
      fill.style.width = `${Math.max(0, right - left)}px`;
      leftH.style.left = `${left}px`;
      rightH.style.left = `${right}px`;
    };
    updateFill();
    requestAnimationFrame(updateFill); // bar が DOM に入った後の幅で再計算

    const beginDrag = (handle, isLeft) => {
      handle.addEventListener('mousedown', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const onMove = e => {
          const rect = bar.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const t = ratio * duration;
          if (isLeft) setStart(t);
          else setEnd(t);
          updateFill();
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    };
    beginDrag(leftH, true);
    beginDrag(rightH, false);
  }

  _installPlayheadLoop() {
    cancelAnimationFrame(this._raf);
    const tick = () => {
      const ph = this.container.querySelector('#tl-playhead');
      if (ph && this.audioTrim.duration > 0) {
        const t = this.getCurrentTime();
        const ratio = Math.max(0, Math.min(1, t / this.audioTrim.duration));
        ph.style.left = `${ratio * 100}%`;
      }
      this._raf = requestAnimationFrame(tick);
    };
    tick();
  }
}
```

- [ ] **Step 2:** コミット

```bash
git add docs/js/creator/timeline.js
git commit -m "feat: add Timeline DOM component with trim handles"
```

---

## Task 5: `index.html` 更新（背景モード切替 + タイムラインパネル）

**File:** `docs/index.html`

- [ ] **Step 1:** Creator ツールバー、スタイル select の前に背景モード select を追加

「`<select class="select" id="c-style-select"></select>`」を以下に置き換える：

```html
    <select class="select" id="c-bg-mode-select" title="背景モード">
      <option value="visualizer" selected>背景: ビジュアライザー</option>
      <option value="video">背景: 動画</option>
    </select>
    <select class="select" id="c-style-select"></select>
    <input type="file" id="c-video-input" accept="video/*" hidden />
```

- [ ] **Step 2:** Creator タブ末尾の properties panel の閉じ `</aside>` の直後、つまり `</div>` (creator-layout の閉じ) の前にタイムラインパネルを追加

`</aside>` と続く `</div>` の間に：

```html
  </aside>

  <div class="timeline-panel" id="c-timeline-panel" hidden>
    <div class="timeline-panel-header">
      <h3>タイムライン</h3>
      <span class="meta" id="c-tl-hint">動画クリップを追加して並び順とトリムを設定</span>
    </div>
    <div class="timeline-body" id="c-timeline-body"></div>
  </div>
</div>
```

（既存の `</div>` は creator-layout の閉じ。タイムラインパネルはその外側にもっていく必要があるため、上記置換だと閉じタグが二重になる。注意して既存構造を確認すること。）

正しくは、`<aside class="properties-panel" id="c-properties">...</aside>` の **閉じタグ `</aside>` の直後、その親 `<div class="creator-layout">` の閉じタグ `</div>` の前** に `<div class="timeline-panel">` を入れる。

- [ ] **Step 3:** コミット

```bash
git add docs/index.html
git commit -m "feat: add background mode select and timeline panel HTML"
```

---

## Task 6: タイムライン CSS

**File:** `docs/css/ui.css`

- [ ] **Step 1:** ファイル末尾に追記

```css
/* ============ Timeline Panel ============ */
.timeline-panel {
  grid-column: 1 / -1;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  margin-top: 12px;
}
.timeline-panel[hidden] { display: none; }
.timeline-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
}
.timeline-panel-header h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--fg-muted);
  letter-spacing: 0.04em;
}
.timeline-body {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tl-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
}
.tl-label {
  font-size: 11px;
  color: var(--fg-faint);
  width: 40px;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.tl-track {
  flex: 1;
  background: rgba(0,0,0,0.4);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
}
.tl-empty {
  font-size: 11px;
  color: var(--fg-faint);
  padding: 4px 8px;
}

.tl-bar {
  position: relative;
  height: 28px;
  flex-shrink: 0;
  background: rgba(255,255,255,0.06);
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1);
}
.tl-bar--audio { background: rgba(26,157,82,0.12); border-color: rgba(26,157,82,0.4); }
.tl-bar--video { background: rgba(99,102,241,0.15); border-color: rgba(99,102,241,0.5); }

.tl-bar-fill {
  position: absolute;
  top: 0; bottom: 0;
  border-radius: 5px;
}
.tl-bar-fill--audio { background: rgba(26,157,82,0.4); }
.tl-bar-fill--video { background: rgba(99,102,241,0.45); display: flex; align-items: center; padding: 0 6px; }

.tl-clip-name {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255,255,255,0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}

.tl-handle {
  position: absolute;
  top: -2px;
  width: 4px;
  height: calc(100% + 4px);
  background: var(--fg);
  cursor: ew-resize;
  border-radius: 2px;
  transform: translateX(-2px);
  z-index: 2;
  transition: background 0.15s;
}
.tl-handle:hover { background: var(--accent-soft); }
.tl-handle--left::before, .tl-handle--right::before {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 2px; height: 10px;
  background: rgba(0,0,0,0.5);
  transform: translate(-50%, -50%);
  border-radius: 1px;
}

.tl-playhead {
  position: absolute;
  top: -4px;
  left: 0;
  width: 2px;
  height: calc(100% + 8px);
  background: #ffd700;
  pointer-events: none;
  z-index: 3;
  box-shadow: 0 0 6px rgba(255,215,0,0.6);
}

.tl-clip-tools {
  position: absolute;
  top: -22px;
  right: 0;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}
.tl-bar:hover .tl-clip-tools { opacity: 1; }
.tl-tool-btn {
  width: 18px; height: 18px;
  background: rgba(0,0,0,0.7);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--fg);
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.tl-tool-btn:hover { background: var(--bg-3); }
.tl-tool-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.tl-tool--danger { color: #ff6b6b; }

.tl-add-btn {
  padding: 6px 14px;
  background: rgba(255,255,255,0.04);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  color: var(--fg-muted);
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
}
.tl-add-btn:hover { background: rgba(255,255,255,0.08); color: var(--fg); }
```

- [ ] **Step 2:** コミット

```bash
git add docs/css/ui.css
git commit -m "feat: add timeline UI styles"
```

---

## Task 7: `creator-tab.js` に背景モード・ビデオ統合

**File:** `docs/js/creator/creator-tab.js`

- [ ] **Step 1:** import 追加

ファイル冒頭の `import { addToLrcHistory, ... }` の直後に：

```js
import { VideoClips } from './video-clips.js';
import { AudioTrim } from './audio-trim.js';
import { Timeline } from './timeline.js';
```

- [ ] **Step 2:** state とインスタンス追加

`const recorder = new Recorder();` 行の直後に追加：

```js
const videoClips = new VideoClips();
const audioTrim = new AudioTrim();
let backgroundMode = 'visualizer'; // 'visualizer' | 'video'
let timeline = null;
```

- [ ] **Step 3:** スタイル select の前に背景モード select の処理を追加

`const styleSel = $('c-style-select');` の **前** に：

```js
const bgModeSel = $('c-bg-mode-select');
const timelinePanel = $('c-timeline-panel');
bgModeSel.addEventListener('change', e => {
  backgroundMode = e.target.value;
  timelinePanel.hidden = backgroundMode !== 'video';
  styleSel.disabled = backgroundMode === 'video';
  $('c-particles-toggle').disabled = backgroundMode === 'video';
});
```

- [ ] **Step 4:** `loadAudio` の `loadedmetadata` ハンドラで audioTrim に duration を設定

`audio.addEventListener('loadedmetadata', () => {` ブロックの中、`stepGuide.markDone(0);` の **前** に：

```js
audioTrim.setDuration(audio.duration);
```

- [ ] **Step 5:** 再生時に audioTrim の trimStart へジャンプするロジックを再生ボタンに追加

`$('c-play-btn').addEventListener('click', async () => {` の `else` ブランチ（再生開始）にて `audioGraph.audio.play();` の **前** に：

```js
if (audioGraph.audio.currentTime < audioTrim.trimStart || audioGraph.audio.currentTime >= (audioTrim.trimEnd ?? audioTrim.duration)) {
  audioGraph.audio.currentTime = audioTrim.trimStart;
}
```

- [ ] **Step 6:** timeupdate ハンドラで trimEnd 超過を検出して停止

既存の `audio.addEventListener('timeupdate', () => {` ブロックの末尾に追加：

```js
const snap = audioTrim.snap(audio.currentTime);
if (snap.ended) {
  audio.pause();
  state.isPlaying = false;
  $('c-play-btn').textContent = '▶ 再生';
  if (recorder.isRecording) recorder.stop();
  videoClips.pauseAll();
}
```

- [ ] **Step 7:** 描画ループ修正

`function render() {` 内、`if (style) { style.drawFn(...); }` の部分を以下に置換：

```js
    // 背景モードで分岐
    if (backgroundMode === 'video') {
      // 音源 trim 適用後の effective time
      const ct = audioGraph.audio?.currentTime || 0;
      const effective = audioTrim.effectiveTime(ct);
      videoClips.sync(effective, state.isPlaying);
      videoClips.draw(ctx, W, H);
    } else {
      if ($('c-particles-toggle').checked) {
        particles.draw(ctx, W, H, state.lastBass);
      }
      const style = getStyleById(state.visualStyle);
      if (style) {
        style.drawFn(ctx, W, H, freq, time, state.lastBass, { showJacket: false });
      }
    }
```

**注意：** 既存コードに `if ($('c-particles-toggle').checked)` と style.drawFn 呼び出しがあるので、それらを上記の `else` ブランチ内に統合する。

- [ ] **Step 8:** Timeline インスタンス化

`buildLogoSection($('c-logo-controls'), logo);` の **直後** に：

```js
  timeline = new Timeline($('c-timeline-body'), {
    audioTrim,
    videoClips,
    onPickVideo: () => $('c-video-input').click(),
    onSeek: t => { if (audioGraph.audio) audioGraph.audio.currentTime = t; },
    getCurrentTime: () => audioGraph.audio?.currentTime || 0,
  });
```

- [ ] **Step 9:** 動画ファイル入力ハンドラ

`$('c-lrc-input').addEventListener('change', ...)` の **すぐ後ろ** に：

```js
  $('c-video-input').addEventListener('change', async e => {
    const f = e.target.files?.[0];
    if (f) await videoClips.addClip(f);
    $('c-video-input').value = '';
  });
```

- [ ] **Step 10:** ドラッグ&ドロップに onVideo 追加

既存 `attachFileDrop($('panel-creator'), { ... })` の opts に `onVideo` を追加：

```js
    onVideo: async (file) => {
      await videoClips.addClip(file);
      // 動画を入れたら自動で背景モードを video に
      if (backgroundMode !== 'video') {
        bgModeSel.value = 'video';
        bgModeSel.dispatchEvent(new Event('change'));
      }
    },
```

- [ ] **Step 11:** コミット

```bash
git add docs/js/creator/creator-tab.js
git commit -m "feat: integrate video background mode, audio trim, timeline in Creator"
```

---

## Task 8: スモークテスト

- [ ] **Step 1:** 構文チェック

```bash
cd "C:\Users\kazu0\Claude\Visualizer作成"
node --check docs/js/creator/video-clips.js
node --check docs/js/creator/audio-trim.js
node --check docs/js/creator/timeline.js
node --check docs/js/creator/creator-tab.js
node --check docs/js/shared/file-drop.js
```
Expected: 全 OK

- [ ] **Step 2:** HTTP 確認

```bash
cd docs && python -m http.server 8765 &
sleep 2
for url in / /js/creator/video-clips.js /js/creator/audio-trim.js /js/creator/timeline.js; do
  printf "%s: " "$url"
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8765$url"
done
for pid in $(netstat -ano | grep ':8765' | grep LISTEN | awk '{print $5}' | sort -u); do taskkill /F /PID $pid 2>/dev/null; done
```
Expected: 全 200

- [ ] **Step 3:** ブラウザ目視確認

- [ ] 「背景: 動画」を選ぶとタイムラインパネルが表示される
- [ ] 動画ファイルをドロップするとクリップが追加され、自動で背景モードが「動画」に切り替わる
- [ ] タイムライン上の動画クリップにマウスホバーすると ◀ ▶ × の操作ボタンが出る
- [ ] クリップの両端ハンドルをドラッグするとトリム範囲が変わる
- [ ] 音源バーの両端でドラッグすると音源の trim 範囲が変わる
- [ ] 再生開始すると音源の trimStart から始まり、trimEnd で停止
- [ ] 動画クリップが音源の進行と同期して順番に切り替わる
- [ ] Visualizer モードに戻すと従来通りのビジュアライザーが動く

---

## 完了基準

- [x] 背景モード切替（Visualizer / Video）
- [x] 動画クリップの追加・削除・順序入れ替え・トリム
- [x] 音源トリム
- [x] タイムライン UI（音源バー + 動画クリップトラック + プレイヘッド）
- [x] Video モードでは Visualizer エフェクトを描画しない
- [x] 動画クリップが音源と同期再生
- [x] コンソールエラーゼロ・HTTP 200

完了後は **Plan 4（SNS最適化＋MP4出力）** へ進む。
