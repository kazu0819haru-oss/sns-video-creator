// タイムライン DOM コンポーネント。音源バー + 動画クリップトラックを表示。
// 各バーの両端にトリムハンドルを置き、ドラッグで秒値を更新する。
export class Timeline {
  constructor(container, { audioTrim, videoClips, history, onPickVideo, onPickImage, onSeek, getCurrentTime }) {
    this.container = container;
    this.audioTrim = audioTrim;
    this.videoClips = videoClips;
    this.history = history;
    this.onPickVideo = onPickVideo;
    this.onPickImage = onPickImage;
    this.onSeek = onSeek;
    this.getCurrentTime = getCurrentTime;
    this.render();
    this.videoClips.onChange = () => this.render();
  }

  _snapshot() {
    if (this.history) this.history.push(this.audioTrim, this.videoClips);
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

      let audioDragInitial = null;
      this._addTrimHandles(bar, fill, this.audioTrim.duration,
        () => this.audioTrim.trimStart,
        () => this.audioTrim.trimEnd ?? this.audioTrim.duration,
        (s, finalize) => {
          if (audioDragInitial === null) {
            audioDragInitial = { trimStart: this.audioTrim.trimStart, trimEnd: this.audioTrim.trimEnd };
          }
          this.audioTrim.setStart(s);
          this._updateVideoSpacer();
          if (finalize) {
            const ai = audioDragInitial;
            if (ai && (ai.trimStart !== this.audioTrim.trimStart || ai.trimEnd !== this.audioTrim.trimEnd)) {
              // 履歴保存（initial 値で）
              const cur = { trimStart: this.audioTrim.trimStart, trimEnd: this.audioTrim.trimEnd };
              this.audioTrim.trimStart = ai.trimStart;
              this.audioTrim.trimEnd = ai.trimEnd;
              this._snapshot();
              this.audioTrim.trimStart = cur.trimStart;
              this.audioTrim.trimEnd = cur.trimEnd;
            }
            audioDragInitial = null;
          }
        },
        (e, finalize) => {
          if (audioDragInitial === null) {
            audioDragInitial = { trimStart: this.audioTrim.trimStart, trimEnd: this.audioTrim.trimEnd };
          }
          this.audioTrim.setEnd(e);
          if (finalize) {
            const ai = audioDragInitial;
            if (ai && (ai.trimStart !== this.audioTrim.trimStart || ai.trimEnd !== this.audioTrim.trimEnd)) {
              const cur = { trimStart: this.audioTrim.trimStart, trimEnd: this.audioTrim.trimEnd };
              this.audioTrim.trimStart = ai.trimStart;
              this.audioTrim.trimEnd = ai.trimEnd;
              this._snapshot();
              this.audioTrim.trimStart = cur.trimStart;
              this.audioTrim.trimEnd = cur.trimEnd;
            }
            audioDragInitial = null;
          }
        });

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
      const kind = clip.kind || 'video';
      const trimDur = clip.trimEnd - clip.trimStart;
      const bar = document.createElement('div');
      bar.className = `tl-bar tl-bar--${kind}`;
      bar.style.width = `${Math.max(4, trimDur * scale)}px`;
      bar.title = clip.name;

      const fill = document.createElement('div');
      fill.className = `tl-bar-fill tl-bar-fill--${kind}`;
      bar.appendChild(fill);

      const name = document.createElement('span');
      name.className = 'tl-clip-name';
      name.textContent = (kind === 'image' ? '🖼 ' : '🎬 ') + clip.name;
      fill.appendChild(name);

      const tools = document.createElement('div');
      tools.className = 'tl-clip-tools';
      const cutBtn = this._mkToolBtn('✂', 'カット（再生位置で分割）', true, () => { this._snapshot(); this._cutClip(i); });
      const upBtn = this._mkToolBtn('◀', '前へ', i > 0, () => { this._snapshot(); this.videoClips.moveClip(i, -1); });
      const downBtn = this._mkToolBtn('▶', '次へ', i < this.videoClips.clips.length - 1, () => { this._snapshot(); this.videoClips.moveClip(i, 1); });
      const delBtn = this._mkToolBtn('×', '削除', true, () => { this._snapshot(); this.videoClips.removeClip(i); });
      delBtn.classList.add('tl-tool--danger');
      cutBtn.classList.add('tl-tool--cut');
      tools.appendChild(cutBtn);
      tools.appendChild(upBtn);
      tools.appendChild(downBtn);
      tools.appendChild(delBtn);
      bar.appendChild(tools);

      // クリップ種類別ハンドル
      if (kind === 'image') {
        this._addImageDurationHandle(bar, fill, clip, i);
      } else {
        this._addVideoTrimHandles(bar, fill, clip, i);
      }

      this._installDragReorder(bar, i, track);

      track.appendChild(bar);
    });

    const addVideoBtn = document.createElement('button');
    addVideoBtn.className = 'tl-add-btn';
    addVideoBtn.textContent = '＋ 動画';
    addVideoBtn.addEventListener('click', () => this.onPickVideo && this.onPickVideo());
    track.appendChild(addVideoBtn);

    const addImageBtn = document.createElement('button');
    addImageBtn.className = 'tl-add-btn';
    addImageBtn.textContent = '＋ 画像';
    addImageBtn.style.marginLeft = '4px';
    addImageBtn.addEventListener('click', () => this.onPickImage && this.onPickImage());
    track.appendChild(addImageBtn);

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

  // 画像クリップ専用：右ハンドルだけで表示時間を伸縮（確認ダイアログなし、自由）
  _addImageDurationHandle(bar, fill, clip, clipIdx) {
    const rightH = document.createElement('div');
    rightH.className = 'tl-handle tl-handle--right';
    bar.appendChild(rightH);

    const updateFill = () => {
      const w = bar.clientWidth || 1;
      fill.style.left = '0px';
      fill.style.width = `${w}px`;
      rightH.style.left = `${w}px`;
    };
    updateFill();
    requestAnimationFrame(updateFill);

    rightH.addEventListener('mousedown', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const initialDuration = clip.duration;
      const startX = ev.clientX;
      const scale = this._scale();
      let snapshotted = false;
      const onMove = e => {
        if (!snapshotted) { this._snapshot(); snapshotted = true; }
        const deltaPx = e.clientX - startX;
        const deltaSec = scale > 0 ? deltaPx / scale : 0;
        const newDur = Math.max(0.1, initialDuration + deltaSec);
        this.videoClips.setImageDuration(clipIdx, newDur, true);
        bar.style.width = `${Math.max(4, newDur * scale)}px`;
        updateFill();
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        this.videoClips._notify();
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  // 動画クリップ専用トリム：ドラッグ中は描画のみ、mouseup で確認ダイアログ
  _addVideoTrimHandles(bar, fill, clip, clipIdx) {
    const leftH = document.createElement('div');
    leftH.className = 'tl-handle tl-handle--left';
    const rightH = document.createElement('div');
    rightH.className = 'tl-handle tl-handle--right';
    bar.appendChild(leftH);
    bar.appendChild(rightH);

    const duration = clip.duration;

    // バー幅は clipMin/clipMax 範囲を表す（カット後は範囲が狭まる）
    // フィルとハンドルはバー内での相対位置で計算
    const updateFill = () => {
      const w = bar.clientWidth || 1;
      const min = clip.clipMin ?? 0;
      const max = clip.clipMax ?? duration;
      const range = max - min;
      if (range <= 0) return;
      const left = ((clip.trimStart - min) / range) * w;
      const right = ((clip.trimEnd - min) / range) * w;
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
        const initialStart = clip.trimStart;
        const initialEnd = clip.trimEnd;
        const onMove = e => {
          const rect = bar.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const min = clip.clipMin ?? 0;
          const max = clip.clipMax ?? duration;
          const range = max - min;
          const t = min + ratio * range;
          if (isLeft) {
            clip.trimStart = Math.max(min, Math.min(t, clip.trimEnd - 0.05));
          } else {
            clip.trimEnd = Math.max(clip.trimStart + 0.05, Math.min(t, max));
          }
          updateFill();
        };
        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          const changed = Math.abs(clip.trimStart - initialStart) > 0.01 || Math.abs(clip.trimEnd - initialEnd) > 0.01;
          if (!changed) return;
          const ok = window.confirm(
            `クリップ「${clip.name}」をこの範囲でカット（切り抜き）しますか？\n\n` +
            `変更前: ${initialStart.toFixed(2)}s 〜 ${initialEnd.toFixed(2)}s\n` +
            `変更後: ${clip.trimStart.toFixed(2)}s 〜 ${clip.trimEnd.toFixed(2)}s\n\n` +
            `※ カットされた部分は削除されます。やり直す場合は Ctrl+Z`
          );
          if (ok) {
            // カット確定前の状態を history に保存（initial 値ベース）
            if (this.history) {
              // 一時的に initial 値に戻してから push、その後カット後値に戻す
              const savedStart = clip.trimStart;
              const savedEnd = clip.trimEnd;
              clip.trimStart = initialStart;
              clip.trimEnd = initialEnd;
              this.history.push(this.audioTrim, this.videoClips);
              clip.trimStart = savedStart;
              clip.trimEnd = savedEnd;
            }
            // カット範囲をロック
            clip.clipMin = clip.trimStart;
            clip.clipMax = clip.trimEnd;
            this.videoClips._notify();
          } else {
            // キャンセル：元に戻す
            clip.trimStart = initialStart;
            clip.trimEnd = initialEnd;
            this.videoClips._notify();
          }
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    };
    beginDrag(leftH, true);
    beginDrag(rightH, false);
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
      let snapshotted = false;
      const onMove = e => {
        // マウス X 座標にあるクリップ要素を判定
        const elBelow = document.elementFromPoint(e.clientX, e.clientY);
        const targetBar = elBelow && elBelow.closest('.tl-bar--video');
        if (!targetBar || targetBar === bar) return;
        // target の中のインデックスを track 内の位置から判定
        const allBars = [...track.querySelectorAll('.tl-bar--video')];
        const targetIdx = allBars.indexOf(targetBar);
        if (targetIdx === -1 || targetIdx === currentIdx) return;
        if (!snapshotted) { this._snapshot(); snapshotted = true; }
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
