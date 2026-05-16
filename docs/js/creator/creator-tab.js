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
