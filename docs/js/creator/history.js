// タイムライン操作（トリム/カット/削除/並べ替え）の Undo/Redo 管理。
// 各操作の直前にスナップショットを積み、Ctrl+Z で取り消せる。
//
// スナップショットは clip オブジェクトへの参照を保持しつつ、
// プロパティ値（trim/clipMin/clipMax）と配列の並び順を保存する。

export class History {
  constructor(maxSize = 50) {
    this.stack = [];
    this.redoStack = [];
    this.maxSize = maxSize;
  }

  _snapshot(audioTrim, videoClips) {
    return {
      audio: { trimStart: audioTrim.trimStart, trimEnd: audioTrim.trimEnd },
      clipOrder: videoClips.clips.slice(),
      clipStates: videoClips.clips.map(c => ({
        ref: c,
        trimStart: c.trimStart,
        trimEnd: c.trimEnd,
        clipMin: c.clipMin,
        clipMax: c.clipMax,
      })),
    };
  }

  _restore(snap, audioTrim, videoClips) {
    audioTrim.trimStart = snap.audio.trimStart;
    audioTrim.trimEnd = snap.audio.trimEnd;
    videoClips.clips.length = 0;
    for (const c of snap.clipOrder) videoClips.clips.push(c);
    for (const cs of snap.clipStates) {
      cs.ref.trimStart = cs.trimStart;
      cs.ref.trimEnd = cs.trimEnd;
      cs.ref.clipMin = cs.clipMin;
      cs.ref.clipMax = cs.clipMax;
    }
    videoClips._notify();
  }

  // 操作の直前に呼ぶ。新しい操作で redo stack はクリア。
  push(audioTrim, videoClips) {
    this.stack.push(this._snapshot(audioTrim, videoClips));
    if (this.stack.length > this.maxSize) this.stack.shift();
    this.redoStack.length = 0;
  }

  undo(audioTrim, videoClips) {
    if (!this.stack.length) return false;
    this.redoStack.push(this._snapshot(audioTrim, videoClips));
    const snap = this.stack.pop();
    this._restore(snap, audioTrim, videoClips);
    return true;
  }

  redo(audioTrim, videoClips) {
    if (!this.redoStack.length) return false;
    this.stack.push(this._snapshot(audioTrim, videoClips));
    const snap = this.redoStack.pop();
    this._restore(snap, audioTrim, videoClips);
    return true;
  }

  canUndo() { return this.stack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }
  clear() { this.stack.length = 0; this.redoStack.length = 0; }
}
