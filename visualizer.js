(() => {
  const fileInput     = document.getElementById('audio-input');
  const pickBtn       = document.getElementById('pick-btn');
  const playBtn       = document.getElementById('play-btn');
  const recBtn        = document.getElementById('rec-btn');
  const aspectSel     = document.getElementById('aspect-select');
  const styleSel      = document.getElementById('style-select');
  const particlesTgl  = document.getElementById('particles-toggle');
  const jacketTgl     = document.getElementById('jacket-toggle');
  const titleTgl      = document.getElementById('title-toggle');
  const canvasWrap    = document.getElementById('canvas-wrap');
  const canvas        = document.getElementById('canvas');
  const drop          = document.getElementById('drop');
  const meta          = document.getElementById('meta');
  const seekBar       = document.getElementById('seek-bar');
  const curTimeEl     = document.getElementById('cur-time');
  const totTimeEl     = document.getElementById('tot-time');
  const ctx           = canvas.getContext('2d');

  const lyricsTgl       = document.getElementById('lyrics-canvas-toggle');
  const lyricsInput     = document.getElementById('lyrics-input');
  const timingBtn       = document.getElementById('timing-btn');
  const resetTimingBtn  = document.getElementById('reset-timing-btn');
  const exportLrcBtn    = document.getElementById('export-lrc-btn');
  const lyricLineList   = document.getElementById('lyric-line-list');
  const lyricsPanelBtn  = document.getElementById('lyrics-panel-toggle');
  const lyricsBody      = document.getElementById('lyrics-body');
  const lyricsCount     = document.getElementById('lyrics-count');
  const timingStatus    = document.getElementById('timing-status');
  const timingProgress  = document.getElementById('timing-progress');
  const timingCurrLine  = document.getElementById('timing-current-line');
  const songTitleInput  = document.getElementById('song-title-input');
  const bandNameInput   = document.getElementById('band-name-input');
  const lyricsYSlider   = document.getElementById('lyrics-y-slider');
  const lyricsYVal      = document.getElementById('lyrics-y-val');
  const importLrcBtn    = document.getElementById('import-lrc-btn');
  const lrcInput        = document.getElementById('lrc-input');

  let audio = null, audioCtx = null, sourceNode = null, analyser = null;
  let gainNode = null, destNode = null;
  let mediaRecorder = null, chunks = [];
  let isPlaying = false, isRecording = false, isSeeking = false;
  let jacketImg = null;
  let visualStyle = 'red-frame';
  let trackTitle = '';
  let lyrics = [];
  let timingMode = false;
  let timingIdx = 0;
  let lyricsY = 0.50;

  jacketImg = new Image();
  jacketImg.crossOrigin = 'anonymous';
  jacketImg.src = 'jacket.jpg';
  jacketImg.onerror = () => { jacketImg = null; };

  lyricsPanelBtn.addEventListener('click', () => {
    const open = lyricsBody.classList.toggle('is-open');
    lyricsPanelBtn.textContent = open ? '▲ 閉じる' : '▼ 開く';
  });
  // panel starts open

  lyricsYSlider.addEventListener('input', () => {
    lyricsY = lyricsYSlider.value / 100;
    lyricsYVal.textContent = `${lyricsYSlider.value}%`;
  });

  importLrcBtn.addEventListener('click', () => lrcInput.click());
  lrcInput.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => importLRC(ev.target.result);
    reader.readAsText(f, 'utf-8');
    lrcInput.value = '';
  });

  function importLRC(text) {
    const re = /\[(\d+):(\d+(?:\.\d+)?)\](.+)/g;
    const parsed = [];
    let m;
    while ((m = re.exec(text)) !== null) {
      const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
      parsed.push({ text: m[3].trim(), time });
    }
    parsed.sort((a, b) => a.time - b.time);
    if (parsed.length === 0) return;
    lyrics = parsed;
    lyricsInput.value = parsed.map(l => l.text).join('\n');
    lyricsCount.textContent = `${lyrics.length} 行`;
    renderLyricList();
    timingBtn.disabled = !audio || lyrics.length === 0;
    exportLrcBtn.disabled = false;
  }

  lyricsInput.addEventListener('input', () => {
    parseLyricsInput();
    timingBtn.disabled = !audio || lyrics.length === 0;
    exportLrcBtn.disabled = true;
  });

  const AUTO_LOAD_CANDIDATES = ['burai.wav', 'audio.wav', 'audio.mp3'];
  async function tryAutoLoad() {
    for (const name of AUTO_LOAD_CANDIDATES) {
      try {
        const r = await fetch(name);
        if (!r.ok) continue;
        const blob = await r.blob();
        const file = new File([blob], name, { type: blob.type || 'audio/wav' });
        loadAudioFile(file);
        return true;
      } catch (e) {}
    }
    return false;
  }

  const ASPECTS = { '9:16':[1080,1920], '1:1':[1080,1080], '16:9':[1920,1080] };
  function applyAspect(name) {
    canvasWrap.setAttribute('data-aspect', name);
    const [w, h] = ASPECTS[name];
    canvas.width = w; canvas.height = h;
    initParticles();
  }
  aspectSel.addEventListener('change', e => applyAspect(e.target.value));
  styleSel.addEventListener('change', e => { visualStyle = e.target.value; });

  pickBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) loadAudioFile(f);
  });
  ['dragenter','dragover'].forEach(ev =>
    canvasWrap.addEventListener(ev, e => { e.preventDefault(); canvasWrap.style.outline = '2px solid #1a9d52'; })
  );
  ['dragleave','drop'].forEach(ev =>
    canvasWrap.addEventListener(ev, e => { e.preventDefault(); canvasWrap.style.outline = 'none'; })
  );
  canvasWrap.addEventListener('drop', e => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && f.type.startsWith('audio/')) loadAudioFile(f);
  });

  function loadAudioFile(file) {
    if (audio) { audio.pause(); audio.src = ''; }
    trackTitle = file.name.replace(/\.[^.]+$/, '');
    const dlName = `${trackTitle}-visualizer.webm`;
    const dlEl = document.getElementById('dl-name');
    if (dlEl) dlEl.textContent = dlName;
    audio = new Audio();
    audio.src = URL.createObjectURL(file);
    audio.crossOrigin = 'anonymous';
    audio.addEventListener('loadedmetadata', () => {
      const dur = audio.duration;
      const m = Math.floor(dur / 60);
      const s = String(Math.floor(dur % 60)).padStart(2,'0');
      meta.textContent = `${file.name} - ${m}:${s}`;
      totTimeEl.textContent = `${m}:${s}`;
      seekBar.max = dur;
      seekBar.value = 0;
      seekBar.disabled = false;
      drop.classList.add('is-hidden');
      playBtn.disabled = false;
      recBtn.disabled = false;
      timingBtn.disabled = lyrics.length === 0;
    });
    audio.addEventListener('timeupdate', () => {
      if (isSeeking) return;
      seekBar.value = audio.currentTime;
      const m = Math.floor(audio.currentTime / 60);
      const s = String(Math.floor(audio.currentTime % 60)).padStart(2,'0');
      curTimeEl.textContent = `${m}:${s}`;
      updateLyricPlayhead();
    });
    audio.addEventListener('ended', () => {
      isPlaying = false;
      playBtn.textContent = 'Play';
      if (isRecording) stopRecording();
    });
    setupAudioGraph();
  }
  function parseLyricsInput() {
    const lines = lyricsInput.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    lyrics = lines.map(text => ({ text, time: null }));
    lyricsCount.textContent = lyrics.length > 0 ? `${lyrics.length} 行` : '';
    renderLyricList();
  }

  function formatLRCTime(t) {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(5, '0');
    return `${String(m).padStart(2, '0')}:${s}`;
  }

  function renderLyricList() {
    lyricLineList.innerHTML = '';
    lyrics.forEach((l, i) => {
      const div = document.createElement('div');
      div.className = 'lyric-line-item';
      if (timingMode && i === timingIdx) div.classList.add('is-timing-cursor');
      const t = document.createElement('span');
      t.className = 'lyric-time';
      t.textContent = l.time !== null ? formatLRCTime(l.time) : '--:--.--';
      const tx = document.createElement('span');
      tx.className = 'lyric-text';
      if (!l.text) {
        tx.textContent = '〔間奏〕';
        tx.style.opacity = '0.4';
        tx.style.fontStyle = 'italic';
      } else {
        tx.textContent = l.text;
      }
      const rb = document.createElement('button');
      rb.className = 'lyric-retime-btn';
      rb.textContent = '↺ ここから';
      rb.title = 'この行からタイミングをやり直す';
      rb.addEventListener('click', () => retimeFromLine(i));
      div.appendChild(t);
      div.appendChild(tx);
      div.appendChild(rb);
      lyricLineList.appendChild(div);
    });
    if (timingMode && lyricLineList.children[timingIdx]) {
      lyricLineList.children[timingIdx].scrollIntoView({ block: 'nearest' });
    }
  }

  function retimeFromLine(i) {
    // i以降の間奏マーカーを除去し、実際の歌詞行のみ残す
    const cleaned = lyrics.slice(0, i).concat(lyrics.slice(i).filter(l => l.text !== ''));
    lyrics.length = 0;
    cleaned.forEach(l => lyrics.push(l));
    for (let j = i; j < lyrics.length; j++) lyrics[j].time = null;
    timingIdx = i;
    timingMode = true;
    timingBtn.textContent = '■ 停止';
    timingBtn.classList.add('is-active');
    exportLrcBtn.disabled = true;
    renderLyricList();
    updateTimingStatus();
    if (!audio) return;
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    const prevTime = i > 0 && lyrics[i - 1].time !== null ? Math.max(0, lyrics[i - 1].time - 1) : 0;
    audio.currentTime = prevTime;
    audio.play();
    isPlaying = true;
    playBtn.textContent = 'Pause';
  }

  function updateLyricPlayhead() {
    if (timingMode) return;
    const idx = getCurrentLyricIndex();
    const items = lyricLineList.querySelectorAll('.lyric-line-item');
    items.forEach((el, i) => el.classList.toggle('is-playhead', i === idx));
    if (idx >= 0 && items[idx]) items[idx].scrollIntoView({ block: 'nearest' });
  }

  function updateTimingStatus() {
    if (!timingMode) {
      timingStatus.classList.remove('is-visible');
      return;
    }
    timingStatus.classList.add('is-visible');
    const actualTotal = lyrics.filter(l => l.text !== '').length;
    timingProgress.textContent = `(${timingIdx + 1} / ${lyrics.length} 行)`;
    if (timingIdx < lyrics.length) {
      timingCurrLine.textContent = lyrics[timingIdx].text || '〔間奏マーカー待機中〕';
    } else {
      timingCurrLine.textContent = '✓ 完了';
    }
  }

  function enterTimingMode() {
    parseLyricsInput();
    if (lyrics.length === 0 || !audio) return;
    timingMode = true;
    timingIdx = 0;
    lyrics.forEach(l => l.time = null);
    timingBtn.textContent = '■ 停止';
    timingBtn.classList.add('is-active');
    exportLrcBtn.disabled = true;
    renderLyricList();
    updateTimingStatus();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    audio.currentTime = 0;
    audio.play();
    isPlaying = true;
    playBtn.textContent = 'Pause';
  }

  function exitTimingMode() {
    timingMode = false;
    timingBtn.textContent = '⬤ タイミング入力';
    timingBtn.classList.remove('is-active');
    renderLyricList();
    updateTimingStatus();
    exportLrcBtn.disabled = !lyrics.some(l => l.time !== null);
  }

  function stampLine() {
    if (!timingMode || timingIdx >= lyrics.length) return;
    lyrics[timingIdx].time = audio.currentTime;
    timingIdx++;
    renderLyricList();
    updateTimingStatus();
    if (timingIdx >= lyrics.length) exitTimingMode();
  }

  function getCurrentLyricIndex() {
    if (!audio || !lyrics.length) return -1;
    const t = audio.currentTime;
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time !== null && lyrics[i].time <= t) idx = i;
    }
    return idx;
  }

  function drawLyricsOnCanvas(W, H) {
    if (!lyricsTgl.checked || !lyrics.length) return;
    const idx = getCurrentLyricIndex();
    if (idx < 0) return;
    const text = lyrics[idx].text;
    if (!text) return; // 間奏マーカー：何も描画しない
    const fontSize = Math.round(H * 0.026);
    const cx = W / 2, cy = H * lyricsY;
    ctx.save();
    ctx.font = `400 ${fontSize}px "Shippori Mincho B1", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,1)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(text, cx, cy);
    ctx.shadowBlur = 6;
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }

  timingBtn.addEventListener('click', () => {
    if (timingMode) exitTimingMode(); else enterTimingMode();
  });

  resetTimingBtn.addEventListener('click', () => {
    // 間奏マーカーをすべて除去してリセット
    const originals = lyrics.filter(l => l.text !== '');
    lyrics.length = 0;
    originals.forEach(l => { l.time = null; lyrics.push(l); });
    timingIdx = 0;
    if (timingMode) exitTimingMode();
    renderLyricList();
    exportLrcBtn.disabled = true;
  });

  exportLrcBtn.addEventListener('click', () => {
    const lines = lyrics.filter(l => l.time !== null)
      .map(l => `[${formatLRCTime(l.time)}]${l.text}`).join('\n');
    const blob = new Blob([lines], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${trackTitle || 'lyrics'}.lrc`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  document.addEventListener('keydown', e => {
    if (!timingMode) return;
    const tag = e.target.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); stampLine(); }
    else if (e.code === 'Enter') {
      e.preventDefault();
      // 間奏マーカーを現在位置に挿入
      lyrics.splice(timingIdx, 0, { text: '', time: audio.currentTime });
      timingIdx++;
      renderLyricList();
      updateTimingStatus();
    }
    else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      if (timingIdx > 0) {
        timingIdx--;
        if (lyrics[timingIdx].text === '') {
          // 間奏マーカーは配列から削除
          lyrics.splice(timingIdx, 1);
        } else {
          lyrics[timingIdx].time = null;
        }
        renderLyricList();
        updateTimingStatus();
      }
    }
  });

  function setupAudioGraph() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (sourceNode) try { sourceNode.disconnect(); } catch(_) {}
    sourceNode = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;
    gainNode = audioCtx.createGain();
    destNode = audioCtx.createMediaStreamDestination();
    sourceNode.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    gainNode.connect(destNode);
  }

  seekBar.addEventListener('mousedown', () => { isSeeking = true; });
  seekBar.addEventListener('input', () => {
    if (!audio) return;
    const m = Math.floor(seekBar.value / 60);
    const s = String(Math.floor(seekBar.value % 60)).padStart(2,'0');
    curTimeEl.textContent = `${m}:${s}`;
  });
  seekBar.addEventListener('change', () => {
    if (!audio) return;
    audio.currentTime = seekBar.value;
    isSeeking = false;
  });

  playBtn.addEventListener('click', async () => {
    if (!audio) return;
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    if (isPlaying) { audio.pause(); isPlaying = false; playBtn.textContent = 'Play'; }
    else { audio.play(); isPlaying = true; playBtn.textContent = 'Pause'; }
  });

  recBtn.addEventListener('click', () => {
    if (!audio) return;
    if (isRecording) stopRecording(); else startRecording();
  });
  function startRecording() {
    const videoStream = canvas.captureStream(60);
    const audioStream = destNode.stream;
    const combined = new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
    chunks = [];
    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm;codecs=vp8,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };
    mediaRecorder = new MediaRecorder(combined, options);
    mediaRecorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${trackTitle}-visualizer.webm`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    mediaRecorder.start();
    isRecording = true;
    recBtn.textContent = 'Stop';
    recBtn.classList.add('is-recording');
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (!isPlaying) { audio.play(); isPlaying = true; playBtn.textContent = 'Pause'; }
  }
  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    isRecording = false;
    recBtn.textContent = 'Rec';
    recBtn.classList.remove('is-recording');
  }

  let particles = [];
  function initParticles() {
    const n = Math.round((canvas.width * canvas.height) / 14000);
    particles = [];
    for (let i = 0; i < n; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.3,
        vx: (Math.random()-0.5) * 0.2,
        vy: (Math.random()-0.5) * 0.2,
        a: Math.random() * 0.6 + 0.2,
        tw: Math.random() * Math.PI * 2,
      });
    }
  }
  function drawParticles(W, H, bass) {
    if (!particlesTgl.checked) return;
    ctx.save();
    for (const p of particles) {
      p.x += p.vx + bass*0.4;
      p.y += p.vy;
      p.tw += 0.02;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      const alpha = p.a * (0.6 + 0.4*Math.sin(p.tw)) * (0.6 + bass*0.8);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1+bass*0.4), 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  let lastBass = 0;
  function render() {
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    let freqData = new Uint8Array(1024);
    let timeData = new Uint8Array(1024);
    let bass = 0;
    if (analyser) {
      freqData = new Uint8Array(analyser.frequencyBinCount);
      timeData = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);
      let sum = 0;
      for (let i = 0; i < 16; i++) sum += freqData[i];
      bass = sum / (16 * 255);
    }
    lastBass = lastBass * 0.85 + bass * 0.15;

    drawParticles(W, H, lastBass);

    if (visualStyle === 'red-frame')        drawRedFrame(W, H, freqData, timeData, lastBass);
    else if (visualStyle === 'rainbow-bars') drawRainbowBars(W, H, freqData, lastBass);
    else if (visualStyle === 'gold-aura')    drawGoldAura(W, H, freqData, lastBass);
    else if (visualStyle === 'mono-lines')   drawMonoLines(W, H, freqData, lastBass);

    drawOverlay(W, H);
    requestAnimationFrame(render);
  }

  function drawRedFrame(W, H, freq, time, bass) {
    const cx = W/2, cy = H/2;
    const baseR = Math.min(W, H) * 0.26;

    if (jacketTgl.checked && jacketImg && jacketImg.complete && jacketImg.naturalWidth) {
      const r = baseR;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.closePath(); ctx.clip();
      ctx.drawImage(jacketImg, cx-r, cy-r, r*2, r*2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(cx-r, cy-r, r*2, r*2);
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath(); ctx.arc(cx, cy, baseR, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    const bars = 160;
    const innerR = baseR + 6;
    const maxLen = Math.min(W, H) * 0.18;
    ctx.save();
    ctx.shadowColor = 'rgba(229,30,48,0.85)';
    ctx.shadowBlur = 18 + bass*60;
    for (let i = 0; i < bars; i++) {
      const v = (freq[i*2] || 0) / 255;
      const len = Math.max(2, v * maxLen + 4);
      const ang = (i / bars) * Math.PI * 2 - Math.PI/2;
      const x1 = cx + Math.cos(ang) * innerR;
      const y1 = cy + Math.sin(ang) * innerR;
      const x2 = cx + Math.cos(ang) * (innerR + len);
      const y2 = cy + Math.sin(ang) * (innerR + len);
      ctx.strokeStyle = `rgba(229,30,48,${0.75 + v*0.25})`;
      ctx.lineWidth = (Math.PI*2*innerR/bars) * 0.55;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();

    const yMid = H * 0.78;
    const amp = H * 0.06 * (1 + bass*0.5);
    ctx.save();
    const N = time.length;
    const layers = [{a:0.9,o:0,m:1},{a:0.28,o:18,m:0.6},{a:0.12,o:36,m:0.4}];
    for (const L of layers) {
      ctx.strokeStyle = `rgba(255,255,255,${L.a})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = (i / (N-1)) * W;
        const v = (time[i] - 128) / 128;
        const y = yMid + L.o + (L.o===0 ? v*amp : -v*amp*L.m);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRainbowBars(W, H, freq, bass) {
    if (jacketTgl.checked && jacketImg && jacketImg.complete && jacketImg.naturalWidth) {
      const size = Math.min(W*0.7, H*0.45);
      const x = (W - size)/2;
      const y = H*0.13;
      ctx.save();
      ctx.shadowColor = 'rgba(255,255,255,0.35)';
      ctx.shadowBlur = 30 + bass*100;
      const r = 22;
      ctx.beginPath();
      ctx.moveTo(x+r, y);
      ctx.arcTo(x+size, y, x+size, y+size, r);
      ctx.arcTo(x+size, y+size, x, y+size, r);
      ctx.arcTo(x, y+size, x, y, r);
      ctx.arcTo(x, y, x+size, y, r);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(jacketImg, x, y, size, size);
      ctx.restore();
    }

    const bars = 96;
    const margin = W * 0.04;
    const totalW = W - margin*2;
    const slot = totalW / bars;
    const bw = slot * 0.68;
    const gap = slot - bw;
    const baseY = H * 0.92;
    const maxBarH = H * 0.32;
    ctx.save();
    for (let i = 0; i < bars; i++) {
      const v = (freq[i*2] || 0) / 255;
      const h = v * maxBarH + 6;
      const x = margin + i * slot + gap/2;
      const hue = 180 + (i / bars) * 160;
      const grad = ctx.createLinearGradient(0, baseY-h, 0, baseY);
      grad.addColorStop(0, `hsla(${hue},90%,75%,1)`);
      grad.addColorStop(1, `hsla(${hue},85%,55%,1)`);
      ctx.fillStyle = grad;
      const rr = Math.min(bw/2, 6);
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

  function drawGoldAura(W, H, freq, bass) {
    const cx = W/2, cy = H/2;
    const baseR = Math.min(W, H) * 0.22 * (1 + bass*0.15);

    if (jacketTgl.checked && jacketImg && jacketImg.complete && jacketImg.naturalWidth) {
      const r = baseR * 0.78;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.closePath(); ctx.clip();
      ctx.drawImage(jacketImg, cx-r, cy-r, r*2, r*2);
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const layers = 5;
    for (let k = 0; k < layers; k++) {
      const t = k / (layers-1);
      const offset = 0.92 + t * 0.45 + bass*0.25;
      const r0 = baseR * offset;
      const r1 = baseR * (offset + 0.18);
      const grad = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
      const a = 0.18 * (1 - t) + 0.05 + bass*0.2;
      grad.addColorStop(0, `rgba(255,220,120,0)`);
      grad.addColorStop(0.5, `rgba(255,200,80,${a})`);
      grad.addColorStop(1, `rgba(255,160,40,0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    const bars = 200;
    const innerR = baseR + 6;
    const maxLen = Math.min(W, H) * 0.12;
    ctx.save();
    ctx.shadowColor = 'rgba(255,200,80,0.9)';
    ctx.shadowBlur = 22 + bass*80;
    for (let i = 0; i < bars; i++) {
      const v = (freq[i] || 0) / 255;
      const len = v * maxLen + 2;
      const ang = (i / bars) * Math.PI * 2;
      const x1 = cx + Math.cos(ang) * innerR;
      const y1 = cy + Math.sin(ang) * innerR;
      const x2 = cx + Math.cos(ang) * (innerR + len);
      const y2 = cy + Math.sin(ang) * (innerR + len);
      ctx.strokeStyle = `rgba(255,220,120,${0.55 + v*0.45})`;
      ctx.lineWidth = (Math.PI*2*innerR/bars) * 0.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMonoLines(W, H, freq, bass) {
    const cx = W/2, cy = H/2;
    const baseR = Math.min(W, H) * 0.24;

    if (jacketTgl.checked && jacketImg && jacketImg.complete && jacketImg.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.beginPath(); ctx.arc(cx, cy, baseR*0.92, 0, Math.PI*2); ctx.closePath(); ctx.clip();
      ctx.drawImage(jacketImg, cx-baseR, cy-baseR, baseR*2, baseR*2);
      ctx.restore();
    }

    const bars = 180;
    const innerR = baseR;
    const maxLen = Math.min(W, H) * 0.16;
    ctx.save();
    for (let i = 0; i < bars; i++) {
      const v = (freq[i*2] || 0) / 255;
      const len = v * maxLen + 2;
      const ang = (i / bars) * Math.PI * 2 - Math.PI/2;
      const x1 = cx + Math.cos(ang) * innerR;
      const y1 = cy + Math.sin(ang) * innerR;
      const x2 = cx + Math.cos(ang) * (innerR + len);
      const y2 = cy + Math.sin(ang) * (innerR + len);
      ctx.strokeStyle = `rgba(255,255,255,${0.55 + v*0.45})`;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOverlay(W, H) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';

    const songT = songTitleInput.value.trim();
    const bandN = bandNameInput.value.trim();
    if (songT || bandN) {
      ctx.shadowBlur = 14;
      if (songT) {
        ctx.font = `500 ${Math.round(H*0.026)}px "Shippori Mincho B1", serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillText(songT, W/2, H*0.065);
      }
      if (bandN) {
        ctx.font = `400 ${Math.round(H*0.018)}px "Shippori Mincho B1", serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(bandN, W/2, H*(songT ? 0.100 : 0.065));
      }
    }

    drawLyricsOnCanvas(W, H);

    if (titleTgl.checked && trackTitle && !songT && !bandN) {
      const hasLyrics = lyricsTgl.checked && lyrics.some(l => l.time !== null);
      ctx.font = `500 ${Math.round(H * (hasLyrics ? 0.018 : 0.026))}px "Shippori Mincho B1", serif`;
      ctx.shadowBlur = 10;
      ctx.fillStyle = hasLyrics ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)';
      ctx.fillText(trackTitle, W/2, H * (hasLyrics ? 0.92 : 0.88));
    }

    ctx.restore();
  }

  applyAspect('9:16');
  render();
  tryAutoLoad();
})();
