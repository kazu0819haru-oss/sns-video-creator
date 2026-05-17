// ドラッグで X/Y 位置を編集するためのマネージャ。
//
// 使用方法:
//   const dm = new DragManager(canvas);
//   dm.addItem({
//     id: 'title',
//     getBounds: (W, H) => ({ cx, cy, w, h }),
//     setPos: (xPct, yPct) => { state.title.x = xPct; state.title.y = yPct; },
//   });
//   dm.setEnabled(true); // 編集モード ON
//
// レンダリングループで dm.drawHandles(ctx, W, H) を呼ぶと選択中アイテムに枠を描画。
export class DragManager {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.items = [];   // [{id, getBounds, setPos}]
    this.enabled = false;
    this.dragging = null; // { item, offsetX, offsetY }
    this.selected = null;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);

    this.canvas.addEventListener('mousedown', this._onDown);
    window.addEventListener('mousemove', this._onMove);
    window.addEventListener('mouseup', this._onUp);
  }

  addItem(item) { this.items.push(item); }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this.dragging = null;
      this.selected = null;
    }
  }

  // クライアント座標 → キャンバスピクセル座標
  _toCanvasCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  _hitTest(x, y) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const b = this.items[i].getBounds(W, H);
      if (!b) continue;
      const left = b.cx - b.w / 2;
      const top = b.cy - b.h / 2;
      if (x >= left && x <= left + b.w && y >= top && y <= top + b.h) {
        return this.items[i];
      }
    }
    return null;
  }

  _onDown(e) {
    if (!this.enabled) return;
    const { x, y } = this._toCanvasCoords(e.clientX, e.clientY);
    const hit = this._hitTest(x, y);
    if (hit) {
      const b = hit.getBounds(this.canvas.width, this.canvas.height);
      this.dragging = { item: hit, offsetX: x - b.cx, offsetY: y - b.cy };
      this.selected = hit;
      e.preventDefault();
    } else {
      this.selected = null;
    }
  }

  _onMove(e) {
    if (!this.dragging) return;
    const { x, y } = this._toCanvasCoords(e.clientX, e.clientY);
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = x - this.dragging.offsetX;
    const cy = y - this.dragging.offsetY;
    this.dragging.item.setPos(
      Math.max(0, Math.min(1, cx / W)),
      Math.max(0, Math.min(1, cy / H))
    );
  }

  _onUp() { this.dragging = null; }

  drawHandles(ctx, W, H) {
    if (!this.enabled) return;
    ctx.save();
    for (const item of this.items) {
      const b = item.getBounds(W, H);
      if (!b) continue;
      const isSel = item === this.selected;
      ctx.strokeStyle = isSel ? '#1a9d52' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = isSel ? 3 : 1.5;
      ctx.setLineDash(isSel ? [] : [6, 4]);
      ctx.strokeRect(b.cx - b.w / 2, b.cy - b.h / 2, b.w, b.h);
    }
    ctx.restore();
  }

  destroy() {
    this.canvas.removeEventListener('mousedown', this._onDown);
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('mouseup', this._onUp);
  }
}
