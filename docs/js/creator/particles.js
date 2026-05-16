export class Particles {
  constructor() {
    this.particles = [];
  }

  init(W, H) {
    const n = Math.round((W * H) / 14000);
    this.particles = [];
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.3,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        a: Math.random() * 0.6 + 0.2,
        tw: Math.random() * Math.PI * 2,
      });
    }
  }

  draw(ctx, W, H, bass) {
    ctx.save();
    for (const p of this.particles) {
      p.x += p.vx + bass * 0.4;
      p.y += p.vy;
      p.tw += 0.02;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
      const alpha = p.a * (0.6 + 0.4 * Math.sin(p.tw)) * (0.6 + bass * 0.8);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 + bass * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
