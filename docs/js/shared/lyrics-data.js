// 歌詞配列の CRUD。各エントリは { text, time }。
// text === '' のものは間奏マーカー（描画スキップ）。
export class LyricsData {
  constructor() {
    this.lines = [];
  }

  parseFromText(text) {
    const arr = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    this.lines = arr.map(t => ({ text: t, time: null }));
  }

  clearTimes() {
    this.lines.forEach(l => { l.time = null; });
  }

  setTime(idx, time) {
    if (idx >= 0 && idx < this.lines.length) {
      this.lines[idx].time = time;
    }
  }

  insertBlank(idx, time) {
    this.lines.splice(idx, 0, { text: '', time });
  }

  removeAt(idx) {
    this.lines.splice(idx, 1);
  }

  removeBlanksFrom(idx) {
    this.lines = this.lines.slice(0, idx).concat(
      this.lines.slice(idx).filter(l => l.text !== '')
    );
  }

  getCurrentIndex(currentTime) {
    let idx = -1;
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].time !== null && this.lines[i].time <= currentTime) {
        idx = i;
      }
    }
    return idx;
  }

  get length() { return this.lines.length; }
  get all() { return this.lines; }
}
