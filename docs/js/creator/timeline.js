// タイムライン DOM コンポーネント。音源バー + 動画クリップトラックを表示。
// 各バーの両端にトリムハンドルを置き、ドラッグで秒値を更新する。
export class Timeline {
  constructor(container, { audioTrim, videoClips, onPickVideo, onSeek, getCurrentTime }) {
    this.container = container;
    this.audioTrim = audioTrim;
    this.videoClips = videoClips;
    this.onPickVideo = onPickVideo;
    this.onSeek = onSeek;
    this.getCurrentTime = getCurrentTime;
    this.render();
    this.videoClips.onChange = () => this.render();
  }

  _scale() {
    const total = Math.max(this.audioTrim.duration || 0, this.videoClips.totalDuration());
    const W = this.container.clientWidth - 80;
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

      this._addTrimHandles(bar, fill, this.audioTrim.duration,
        () => this.audioTrim.trimStart,
        () => this.audioTrim.trimEnd ?? this.audioTrim.duration,
        (s, _finalize) => { this.audioTrim.setStart(s); this._updateVideoSpacer(); },
        (e, _finalize) => this.audioTrim.setEnd(e));

      const ph = document.createElement('div');
      ph.className = 'tl-playhead';
      ph.id = 'tl-playhead';
      ph.title = 'ドラッグして再生位置を変更';
      bar.appendChild(ph);

      // プレイヘッドのドラッグでシーク
      const startDragSeek = (clientX) => {
        const rect = bar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const t = ratio * this.audioTrim.duration;
        if (this.onSeek) this.onSeek(t);
      };
      ph.addEventListener('mousedown', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const onMove = e => startDragSeek(e.clientX);
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });

      // 音源バー任意位置クリックでシーク（ハンドル除く）
      bar.addEventListener('click', ev => {
        if (ev.target.closest('.tl-handle')) return;
        startDragSeek(ev.clientX);
      });
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

    // 音源 trimStart に合わせた先頭スペーサー（動画クリップの開始位置を揃える）
    const spacer = document.createElement('div');
    spacer.className = 'tl-video-spacer';
    spacer.style.width = `${(this.audioTrim.trimStart || 0) * scale}px`;
    track.appendChild(spacer);
    this._videoSpacer = spacer;

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

      const tools = document.createElement('div');
      tools.className = 'tl-clip-tools';
      const cutBtn = this._mkToolBtn('✂', 'カット（再生位置で分割）', true, () => this._cutClip(i));
      const upBtn = this._mkToolBtn('◀', '前へ', i > 0, () => this.videoClips.moveClip(i, -1));
      const downBtn = this._mkToolBtn('▶', '次へ', i < this.videoClips.clips.length - 1, () => this.videoClips.moveClip(i, 1));
      const delBtn = this._mkToolBtn('×', '削除', true, () => this.videoClips.removeClip(i));
      delBtn.classList.add('tl-tool--danger');
      cutBtn.classList.add('tl-tool--cut');
      tools.appendChild(cutBtn);
      tools.appendChild(upBtn);
      tools.appendChild(downBtn);
      tools.appendChild(delBtn);
      bar.appendChild(tools);

      // 先頭クリップの左トリムを動かしたら、その分だけ音源 trimStart も追従させる
      let dragStartTrim = null;
      this._addTrimHandles(
        bar, fill, clip.duration,
        () => clip.trimStart,
        () => clip.trimEnd,
        (s, finalize) => {
          if (dragStartTrim === null) dragStartTrim = clip.trimStart;
          this.videoClips.setTrim(i, s, clip.trimEnd, !finalize);
          if (finalize) {
            if (i === 0) {
              const delta = clip.trimStart - dragStartTrim;
              if (delta !== 0) {
                const cur = this.audioTrim.trimStart || 0;
                this.audioTrim.setStart(cur + delta);
                // render() が videoClips._notify から発火するのでスペーサーも更新される
              }
            }
            dragStartTrim = null;
          }
        },
        (e, finalize) => this.videoClips.setTrim(i, clip.trimStart, e, !finalize),
      );

      this._installDragReorder(bar, i, track);

      track.appendChild(bar);
    });

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

  // 音源 trimStart の変更時に動画トラック先頭スペーサーの幅を更新
  _updateVideoSpacer() {
    if (!this._videoSpacer) return;
    const scale = this._scale();
    this._videoSpacer.style.width = `${(this.audioTrim.trimStart || 0) * scale}px`;
  }

  // カットボタン押下時のロジック
  // 音源 playhead がこのクリップ内なら playhead 位置で分割、それ以外なら中点で分割
  _cutClip(idx) {
    const clips = this.videoClips.clips;
    const c = clips[idx];
    if (!c) return;
    const ct = (this.getCurrentTime ? this.getCurrentTime() : 0) - (this.audioTrim.trimStart || 0);
    let acc = 0;
    let splitLocal = (c.trimStart + c.trimEnd) / 2; // デフォルト: 中点
    for (let i = 0; i < clips.length; i++) {
      const cc = clips[i];
      const dur = cc.trimEnd - cc.trimStart;
      if (i === idx && ct >= acc && ct < acc + dur) {
        splitLocal = cc.trimStart + (ct - acc);
        break;
      }
      acc += dur;
    }
    this.videoClips.splitClip(idx, splitLocal);
  }

  // クリップ本体（ハンドル/ボタン以外）をドラッグして並べ替え
  _installDragReorder(bar, idx, track) {
    bar.addEventListener('mousedown', ev => {
      // ハンドル・ツールボタン上では並べ替えを起動しない
      if (ev.target.closest('.tl-handle') || ev.target.closest('.tl-tool-btn')) return;
      ev.preventDefault();
      bar.classList.add('tl-bar--dragging');
      let currentIdx = idx;
      const onMove = e => {
        // マウス X 座標にあるクリップ要素を判定
        const elBelow = document.elementFromPoint(e.clientX, e.clientY);
        const targetBar = elBelow && elBelow.closest('.tl-bar--video');
        if (!targetBar || targetBar === bar) return;
        // target の中のインデックスを track 内の位置から判定
        const allBars = [...track.querySelectorAll('.tl-bar--video')];
        const targetIdx = allBars.indexOf(targetBar);
        if (targetIdx === -1 || targetIdx === currentIdx) return;
        this.videoClips.moveClipTo(currentIdx, targetIdx);
        currentIdx = targetIdx;
      };
      const onUp = () => {
        bar.classList.remove('tl-bar--dragging');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  _addTrimHandles(bar, fill, duration, getStart, getEnd, setStart, setEnd) {
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
    requestAnimationFrame(updateFill);

    const beginDrag = (handle, isLeft) => {
      handle.addEventListener('mousedown', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        const onMove = e => {
          const rect = bar.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const t = ratio * duration;
          if (isLeft) setStart(t, false); // suppress notify during drag
          else setEnd(t, false);
          updateFill();
        };
        const onUp = () => {
          // 最終値で notify を発火させ、UI を一度だけ再描画
          if (isLeft) setStart(getStart(), true);
          else setEnd(getEnd(), true);
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
