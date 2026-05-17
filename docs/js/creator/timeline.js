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
        (s) => this.audioTrim.setStart(s),
        (e) => this.audioTrim.setEnd(e));

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

      this._addTrimHandles(
        bar, fill, clip.duration,
        () => clip.trimStart,
        () => clip.trimEnd,
        (s) => this.videoClips.setTrim(i, s, clip.trimEnd),
        (e) => this.videoClips.setTrim(i, clip.trimStart, e),
      );

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
