import { AudioGraph } from '../shared/audio.js';
import { LyricsData } from '../shared/lyrics-data.js';
import { formatLRCTime, parseLRC, buildLRC, downloadLRC } from '../shared/lrc.js';
import { StepGuide } from '../ui/step-guide.js';
import { attachFileDrop } from '../shared/file-drop.js';

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

  function loadLRC(file) {
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
    reader.readAsText(file, 'utf-8');
  }

  $('t-import-lrc-btn').addEventListener('click', () => $('t-lrc-input').click());
  $('t-lrc-input').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) loadLRC(f);
    $('t-lrc-input').value = '';
  });

  // タブ全体にドラッグ&ドロップ
  attachFileDrop($('panel-timing'), {
    onAudio: loadAudio,
    onLRC: loadLRC,
    overlay: $('t-drop-overlay'),
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
