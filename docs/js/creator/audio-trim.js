// 音源の trim 状態管理。
// trimStart / trimEnd（秒）を保持し、再生中の trim 範囲外を補正する。
export class AudioTrim {
  constructor() {
    this.trimStart = 0;
    this.trimEnd = null;
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

  effectiveTime(currentTime) {
    return Math.max(0, currentTime - this.trimStart);
  }

  effectiveDuration() {
    return Math.max(0, (this.trimEnd ?? this.duration) - this.trimStart);
  }

  snap(currentTime) {
    const end = this.trimEnd ?? this.duration;
    if (currentTime < this.trimStart) return { snappedTime: this.trimStart, ended: false };
    if (currentTime >= end) return { snappedTime: end, ended: true };
    return { snappedTime: currentTime, ended: false };
  }
}
