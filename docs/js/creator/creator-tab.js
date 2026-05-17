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
import { attachFileDrop } from '../shared/file-drop.js';
import { saveBlob } from '../shared/session.js';
import { getLrcHistory, addToLrcHistory, clearLrcHistory } from '../shared/lrc-history.js';
import { VideoClips } from './video-clips.js';
import { AudioTrim } from './audio-trim.js';
import { Timeline } from './timeline.js';
import { PRESETS, getPresetById } from './platform-presets.js';
import { IntroOutro } from './intro-outro.js';
import { PhonePreview } from './phone-preview.js';
import { SUGGESTIONS, pickRandom } from './sns-suggestions.js';

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
  const videoClips = new VideoClips();
  const audioTrim = new AudioTrim();
  let backgroundMode = 'visualizer'; // 'visualizer' | 'video'
  let timeline = null;
  const introOutro = new IntroOutro();
  let phonePreview = null;
  let activePresetId = null;

  // 状態
  const state = {
    visualStyle: 'red-frame',
    isPlaying: false,
    isSeeking: false,
    trackTitle: '',
    lastBass: 0,
    lastLineIdx: -1,
    lineStartTime: 0,
    editMode: false,
    title:  { text: '', font: getFontById('shippori-mincho').family, color: '#ffffff', sizeScale: 1.0, shadow: 14, background: 'none', x: 0.5, y: 0.065, vertical: false, visible: true },
    band:   { text: '', font: getFontById('shippori-mincho').family, color: '#cccccc', sizeScale: 0.7, shadow: 12, background: 'none', x: 0.5, y: 0.105, vertical: false, visible: true },
    lyrics: { enabled: true, font: getFontById('shippori-mincho').family, color: '#ffffff', sizeScale: 1.0, shadow: 18, background: 'none', x: 0.5, y: 0.5, vertical: false, effect: 'none' },
  };

  const stepGuide = new StepGuide($('step-bar-creator'), [
    { id: 'audio', label: '音源を選択' },
    { id: 'style', label: '背景を選ぶ' },
    { id: 'record', label: '録画' },
  ]);

  // ============ 既存のセットアップ（音源・スタイル・アスペクト・再生・録画） ============

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
      $('c-aspect-select').value = preset.aspect;
      $('c-aspect-select').dispatchEvent(new Event('change'));
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

  // 背景モード切替
  const bgModeSel = $('c-bg-mode-select');
  const timelinePanel = $('c-timeline-panel');
  bgModeSel.addEventListener('change', e => {
    backgroundMode = e.target.value;
    timelinePanel.hidden = backgroundMode !== 'video';
    $('c-style-select').disabled = backgroundMode === 'video';
    $('c-particles-toggle').disabled = backgroundMode === 'video';
  });

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

  function loadAudio(file) {
    state.trackTitle = file.name.replace(/\.[^.]+$/, '');
    const audio = audioGraph.loadFile(file);
    audio.addEventListener('loadedmetadata', () => {
      const dur = audio.duration;
      audioTrim.setDuration(dur);
      if (timeline) timeline.render();
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
      const snap = audioTrim.snap(audio.currentTime);
      if (snap.ended) {
        audio.pause();
        state.isPlaying = false;
        $('c-play-btn').textContent = '▶ 再生';
        if (recorder.isRecording) recorder.stop();
        videoClips.pauseAll();
      }
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
      const end = audioTrim.trimEnd ?? audioTrim.duration;
      if (audioGraph.audio.currentTime < audioTrim.trimStart || audioGraph.audio.currentTime >= end) {
        audioGraph.audio.currentTime = audioTrim.trimStart;
      }
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

  // スペースキー：Creator タブで再生/停止トグル
  document.addEventListener('keydown', e => {
    if (!document.getElementById('panel-creator').classList.contains('is-active')) return;
    const tag = document.activeElement.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (e.code === 'Space' && audioGraph.audio) {
      e.preventDefault();
      $('c-play-btn').click();
    }
  });

  $('c-rec-btn').addEventListener('click', () => {
    if (!audioGraph.audio) return;
    if (recorder.isRecording) {
      recorder.stop();
      $('c-rec-btn').textContent = '● 録画';
      $('c-rec-btn').classList.remove('is-recording');
    } else {
      recorder.onStop = async (blob, format) => {
        if (!blob) {
          $('c-rec-btn').textContent = '● 録画';
          $('c-rec-btn').classList.remove('is-recording');
          $('c-meta').textContent = '録画失敗';
          return;
        }
        const ext = format || 'webm';
        const filename = `${state.trackTitle || 'visualizer'}-${formatStamp()}.${ext}`;
        const result = await saveBlob(blob, filename);
        $('c-rec-btn').textContent = '● 録画';
        $('c-rec-btn').classList.remove('is-recording');
        stepGuide.markDone(2);
        $('c-meta').textContent = result.savedTo === 'session'
          ? `保存: ${result.path}`
          : `保存: ${filename}（ダウンロード）`;
      };
      recorder.start(canvas, audioGraph.destNode.stream);
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

  // タイムスタンプ生成（ファイル名用）
  function formatStamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  function loadLRCContent(content, name) {
    const parsed = parseLRC(content);
    if (parsed.length === 0) return;
    lyrics.lines = parsed;
    if (name) addToLrcHistory(name, content);
    rebuildLrcSelect();
    $('c-meta').textContent = `LRC: ${name || '読込済み'} (${parsed.length} 行)`;
  }

  function loadLRC(file) {
    const reader = new FileReader();
    reader.onload = ev => loadLRCContent(ev.target.result, file.name);
    reader.readAsText(file, 'utf-8');
  }

  function rebuildLrcSelect() {
    const sel = $('c-lrc-select');
    const prev = sel.value;
    sel.innerHTML = '';
    const placeholder = new Option('↑ LRC を選択…', '');
    placeholder.disabled = false;
    sel.appendChild(placeholder);
    sel.appendChild(new Option('📂 新規ファイルから選ぶ…', '__new__'));
    const hist = getLrcHistory();
    if (hist.length > 0) {
      const sep = new Option('──── 履歴 ────', '__sep__');
      sep.disabled = true;
      sel.appendChild(sep);
      hist.forEach((h, i) => {
        const d = new Date(h.date);
        const date = `${d.getMonth() + 1}/${d.getDate()}`;
        sel.appendChild(new Option(`${h.name}  (${date})`, `__hist_${i}__`));
      });
      sel.appendChild(new Option('🗑 履歴をクリア', '__clear__'));
    }
    sel.value = '';
  }

  $('c-lrc-select').addEventListener('change', e => {
    const v = e.target.value;
    if (v === '__new__') {
      $('c-lrc-input').click();
    } else if (v === '__clear__') {
      if (confirm('LRC 履歴をすべて削除しますか？')) {
        clearLrcHistory();
        rebuildLrcSelect();
      }
    } else if (v.startsWith('__hist_')) {
      const idx = parseInt(v.slice('__hist_'.length, -2), 10);
      const hist = getLrcHistory();
      if (hist[idx]) loadLRCContent(hist[idx].content, hist[idx].name);
    }
    e.target.value = '';
  });

  $('c-lrc-input').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) loadLRC(f);
    $('c-lrc-input').value = '';
  });

  rebuildLrcSelect();

  // タブ全体にドラッグ&ドロップ（音源 + LRC + ロゴ画像）
  attachFileDrop($('panel-creator'), {
    onAudio: loadAudio,
    onLRC: loadLRC,
    onImage: async (file) => {
      await logo.loadFile(file);
      // 既存のロゴプレビューを更新する場合は再構築
      buildLogoSection($('c-logo-controls'), logo);
    },
    onVideo: async (file) => {
      try {
        await videoClips.addClip(file);
        if (backgroundMode !== 'video') {
          bgModeSel.value = 'video';
          bgModeSel.dispatchEvent(new Event('change'));
        }
      } catch (err) {
        console.error(err);
        alert('動画の読み込みに失敗しました: ' + err.message);
      }
    },
    overlay: $('c-drop-overlay'),
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
  buildSnsSection($('c-sns-controls'), introOutro, () => state.trackTitle);

  timeline = new Timeline($('c-timeline-body'), {
    audioTrim,
    videoClips,
    onPickVideo: () => $('c-video-input').click(),
    onSeek: t => { if (audioGraph.audio) audioGraph.audio.currentTime = t; },
    getCurrentTime: () => audioGraph.audio?.currentTime || 0,
  });

  const phoneCanvas = document.getElementById('c-phone-canvas');
  if (phoneCanvas) {
    phonePreview = new PhonePreview(phoneCanvas, canvas);
  }

  $('c-video-input').addEventListener('change', async e => {
    const f = e.target.files?.[0];
    if (f) {
      try {
        await videoClips.addClip(f);
      } catch (err) {
        console.error(err);
        alert('動画の読み込みに失敗しました: ' + err.message);
      }
    }
    $('c-video-input').value = '';
  });

  // ============ 編集モード（ドラッグ配置） ============
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

    const ct = audioGraph.audio?.currentTime || 0;

    if (backgroundMode === 'video') {
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

    // 歌詞インデックス・行開始時刻の追跡
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

    // intro/outro オーバーレイ（録画に含める）
    const eff = audioTrim.effectiveTime(ct);
    const totalEff = audioTrim.effectiveDuration();
    const overlay = introOutro.getActiveOverlay(eff, totalEff);
    if (overlay) {
      introOutro.draw(ctx, W, H, overlay).catch(e => console.error(e));
    }

    dragMgr.drawHandles(ctx, W, H);

    if (phonePreview) phonePreview.draw();

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
  // 縦書きトグル
  wrap.appendChild(makeVerticalField(target));

  return wrap;
}

function makeVerticalField(target) {
  const row = document.createElement('div');
  row.className = 'field-row';
  const label = document.createElement('div');
  label.className = 'field-label';
  label.textContent = '縦書き';
  row.appendChild(label);
  const sw = document.createElement('label');
  sw.className = 'toggle-switch';
  sw.innerHTML = `<input type="checkbox" ${target.vertical ? 'checked' : ''}><span class="toggle-slider"></span>`;
  sw.querySelector('input').addEventListener('change', e => { target.vertical = e.target.checked; });
  row.appendChild(sw);
  return row;
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

function buildSnsSection(container, introOutro, getTrackTitle) {
  container.innerHTML = '';

  const hint = document.createElement('div');
  hint.className = 'sns-panel-hint';
  hint.textContent = 'イントロ・アウトロカードは録画に含まれます。各項目下のチップをタップすると例文が入ります（8秒ごとに更新）。';
  container.appendChild(hint);

  container.appendChild(makeSnsSubsection('イントロカード', introOutro.intro, [
    { key: 'enabled',  type: 'toggle', label: '表示' },
    { key: 'duration', type: 'range',  label: '秒数', min: 1, max: 6, step: 0.5, fmt: v => v + 's' },
    { key: 'title',    type: 'text',   label: 'タイトル', placeholder: '曲名など', suggest: SUGGESTIONS.introTitle },
    { key: 'titleFont', type: 'font',  label: 'タイトル書体' },
    { key: 'titleSize', type: 'range', label: 'タイトルサイズ', min: 0.5, max: 2.5, step: 0.05, fmt: v => v.toFixed(2) + 'x' },
    { key: 'titleColor', type: 'color', label: 'タイトル色' },
    { key: 'titleY', type: 'range', label: 'タイトル位置(縦)', min: 0.05, max: 0.95, step: 0.01, fmt: v => Math.round(v * 100) + '%' },
    { key: 'subtitle', type: 'text',   label: 'サブ', placeholder: 'バンド名・説明など', suggest: SUGGESTIONS.introSubtitle },
    { key: 'subtitleFont', type: 'font', label: 'サブ書体' },
    { key: 'subtitleSize', type: 'range', label: 'サブサイズ', min: 0.5, max: 2.5, step: 0.05, fmt: v => v.toFixed(2) + 'x' },
    { key: 'subtitleColor', type: 'color', label: 'サブ色' },
    { key: 'subtitleY', type: 'range', label: 'サブ位置(縦)', min: 0.05, max: 0.95, step: 0.01, fmt: v => Math.round(v * 100) + '%' },
  ]));

  container.appendChild(makeSnsSubsection('アウトロカード', introOutro.outro, [
    { key: 'enabled',  type: 'toggle', label: '表示' },
    { key: 'duration', type: 'range',  label: '秒数', min: 1, max: 6, step: 0.5, fmt: v => v + 's' },
    { key: 'title',    type: 'text',   label: 'タイトル', placeholder: 'Follow / Listen', suggest: SUGGESTIONS.outroTitle },
    { key: 'titleFont', type: 'font',  label: 'タイトル書体' },
    { key: 'titleSize', type: 'range', label: 'タイトルサイズ', min: 0.5, max: 2.5, step: 0.05, fmt: v => v.toFixed(2) + 'x' },
    { key: 'titleColor', type: 'color', label: 'タイトル色' },
    { key: 'titleY', type: 'range', label: 'タイトル位置(縦)', min: 0.05, max: 0.95, step: 0.01, fmt: v => Math.round(v * 100) + '%' },
    { key: 'subtitle', type: 'text',   label: 'サブ', placeholder: '@your_handle', suggest: SUGGESTIONS.outroSubtitle },
    { key: 'subtitleFont', type: 'font', label: 'サブ書体' },
    { key: 'subtitleSize', type: 'range', label: 'サブサイズ', min: 0.5, max: 2.5, step: 0.05, fmt: v => v.toFixed(2) + 'x' },
    { key: 'subtitleColor', type: 'color', label: 'サブ色' },
    { key: 'subtitleY', type: 'range', label: 'サブ位置(縦)', min: 0.05, max: 0.95, step: 0.01, fmt: v => Math.round(v * 100) + '%' },
    { key: 'qrUrl',    type: 'text',   label: 'QR URL', placeholder: 'https://...', suggest: SUGGESTIONS.outroQRUrl },
    { key: 'qrY', type: 'range', label: 'QR位置(縦)', min: 0.1, max: 0.9, step: 0.01, fmt: v => Math.round(v * 100) + '%' },
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

      // サジェストピル（定期更新）
      if (f.suggest && f.suggest.length > 0) {
        const head = document.createElement('div');
        head.className = 'suggestion-header';
        const headLabel = document.createElement('span');
        headLabel.textContent = '💡 例文';
        const refresh = document.createElement('button');
        refresh.className = 'suggestion-refresh';
        refresh.textContent = '↻ 別の例';
        head.appendChild(headLabel);
        head.appendChild(refresh);
        row.appendChild(head);

        const pillsRow = document.createElement('div');
        pillsRow.className = 'suggestion-row';
        row.appendChild(pillsRow);

        const renderPills = () => {
          pillsRow.innerHTML = '';
          pickRandom(f.suggest, 3).forEach(text => {
            const pill = document.createElement('button');
            pill.className = 'suggestion-pill';
            pill.textContent = text;
            pill.title = 'クリックして入力欄に挿入';
            pill.addEventListener('click', () => {
              inp.value = text;
              target[f.key] = text;
              inp.dispatchEvent(new Event('input', { bubbles: true }));
            });
            pillsRow.appendChild(pill);
          });
        };
        renderPills();
        refresh.addEventListener('click', renderPills);
        const timer = setInterval(renderPills, 8000);
        // 親 details がクローズ/オープンしてもタイマーは継続（軽量なので問題なし）
        pillsRow._timer = timer;
      }

      wrap.appendChild(row);
    } else if (f.type === 'font') {
      const row = document.createElement('div');
      row.className = 'field';
      const lab = document.createElement('div');
      lab.className = 'field-label';
      lab.textContent = f.label;
      row.appendChild(lab);
      const sel = document.createElement('select');
      sel.className = 'font-select';
      FONTS.forEach(font => {
        const opt = document.createElement('option');
        opt.value = font.family;
        opt.textContent = `${font.label}`;
        opt.style.fontFamily = font.family;
        if (target[f.key] === font.family) opt.selected = true;
        sel.appendChild(opt);
      });
      // 既存の値が FONTS にない場合（"Anton" など）も保持
      if (!FONTS.some(font => font.family === target[f.key])) {
        const opt = document.createElement('option');
        opt.value = target[f.key];
        opt.textContent = `(現在: ${target[f.key]})`;
        opt.selected = true;
        sel.insertBefore(opt, sel.firstChild);
      }
      sel.addEventListener('change', () => { target[f.key] = sel.value; });
      row.appendChild(sel);
      wrap.appendChild(row);
    }
  });

  return wrap;
}
