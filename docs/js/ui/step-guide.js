// ステップガイドバーの描画とステート管理
export class StepGuide {
  constructor(container, steps) {
    // steps: [{ id, label }, ...]
    this.container = container;
    this.steps = steps;
    this.currentIdx = 0;
    this.completed = new Set();
    this.render();
  }

  setCurrent(idx) {
    this.currentIdx = idx;
    this.render();
  }

  markDone(idx) {
    this.completed.add(idx);
    if (idx === this.currentIdx && this.currentIdx < this.steps.length - 1) {
      this.currentIdx++;
    }
    this.render();
  }

  reset() {
    this.currentIdx = 0;
    this.completed.clear();
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    this.steps.forEach((step, i) => {
      const item = document.createElement('div');
      item.className = 'step-item';
      if (i === this.currentIdx && !this.completed.has(i)) item.classList.add('is-active');
      if (this.completed.has(i)) item.classList.add('is-done');

      const num = document.createElement('div');
      num.className = 'step-num';
      num.textContent = this.completed.has(i) ? '✓' : String(i + 1);

      const label = document.createElement('span');
      label.textContent = step.label;

      item.appendChild(num);
      item.appendChild(label);
      this.container.appendChild(item);

      if (i < this.steps.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'step-sep';
        sep.textContent = '→';
        this.container.appendChild(sep);
      }
    });
  }
}
