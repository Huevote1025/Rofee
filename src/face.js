import { geometry, interpolate, clamp } from './model.js';

/** Rostro vectorial: todos los trazos se recalculan, sin imágenes rasterizadas. */
export class FaceRenderer {
  constructor(canvas, { pad = [0.8, 0.6, 0.5], idle = true, lambda = 5, onFrame } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.current = [...pad];
    this.target = [...pad];
    this.idle = idle;
    this.lambda = lambda;
    this.onFrame = onFrame;
    this.blinkAt = performance.now() + this.blinkDelay();
    this.saccadeAt = performance.now() + 1000;
    this.gaze = [0, 0];
    this.gazeTarget = [0, 0];
    this.last = performance.now();
    this.lastNotify = 0;
    this.running = true;
    this.tick = this.tick.bind(this);
    this.frame = requestAnimationFrame(this.tick);
  }

  blinkDelay() { return 3000 + Math.random() * 3000; }
  setTarget(pad, immediate = false) {
    this.target = [...pad];
    if (immediate) this.current = [...pad];
  }
  setResolution(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.aspectRatio = `${width} / ${height}`;
  }
  destroy() { this.running = false; cancelAnimationFrame(this.frame); }

  tick(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    this.current = interpolate(this.current, this.target, dt, this.lambda);
    let blink = 0;
    if (this.idle) {
      // AU 43: ventana de cierre/apertura de exactamente 150 ms, intervalos de 3–6 s.
      if (now >= this.blinkAt) {
        const elapsed = now - this.blinkAt;
        if (elapsed < 150) blink = Math.sin(elapsed / 150 * Math.PI);
        else this.blinkAt = now + this.blinkDelay();
      }
      if (now >= this.saccadeAt) {
        this.gazeTarget = [(Math.random() - 0.5) * 7, (Math.random() - 0.5) * 4];
        this.saccadeAt = now + 700 + Math.random() * 1800;
      }
    } else this.gazeTarget = [0, 0];
    this.gaze = interpolate(this.gaze, this.gazeTarget, dt, 12);
    this.draw(now, blink);
    if (this.onFrame && now - this.lastNotify > 100) {
      this.lastNotify = now;
      this.onFrame(this.current, geometry(this.current));
    }
    this.frame = requestAnimationFrame(this.tick);
  }

  draw(now, blink) {
    const c = this.ctx, g = geometry(this.current), au = g.aus;
    const { width, height } = this.canvas;
    c.clearRect(0, 0, width, height);
    c.fillStyle = `rgb(${g.color.join(',')})`;
    c.fillRect(0, 0, width, height);
    const scale = Math.min(width / 800, height / 480);
    c.save();
    c.translate((width - 800 * scale) / 2, (height - 480 * scale) / 2);
    c.scale(scale, scale);

    // Marcas discretas del panel cefálico.
    c.strokeStyle = '#33453622'; c.lineWidth = 1;
    for (const [x, y, dx, dy] of [[32, 32, 1, 1], [768, 32, -1, 1], [32, 448, 1, -1], [768, 448, -1, -1]]) {
      c.beginPath(); c.moveTo(x, y + dy * 15); c.lineTo(x, y); c.lineTo(x + dx * 15, y); c.stroke();
    }
    c.fillStyle = '#33453670'; c.font = '10px monospace';
    c.fillText('R O F E E', 51, 53);
    c.textAlign = 'right'; c.fillText('EXPRESSION / 01', 748, 53); c.textAlign = 'left';

    const breathing = this.idle ? Math.sin(now / 1900) * 1.6 : 0;
    c.translate(400, 235 + breathing);
    c.scale(1 + g.d * 0.035, 1 + g.d * 0.035);
    c.rotate(-g.d * (au[1] || 0) * 0.025);
    const ink = '#293e36';
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const side of [-1, 1]) {
      c.save();
      c.translate(side * 92, -23);
      const h = Math.max(5, g.eyeHeight * (1 - 0.5 * (au[6] || 0) - 0.55 * (au[43] || 0) - 0.3 * (au[7] || 0))) * (1 - blink * 0.97);
      const eyeWidth = 48 + 3 * (au[5] || 0);
      c.fillStyle = ink;
      c.beginPath(); c.roundRect(-eyeWidth / 2 + this.gaze[0], -h / 2 + this.gaze[1], eyeWidth, Math.max(3, h), [eyeWidth / 2]); c.fill();
      if (h > 22) {
        c.fillStyle = '#ffffffc9';
        c.beginPath(); c.ellipse(-7 + this.gaze[0], -h / 2 + 13 + this.gaze[1], 4.5, 6, -0.4, 0, Math.PI * 2); c.fill();
      }
      // θ(P,D) invierte la inclinación entre los lados izquierdo y derecho.
      c.strokeStyle = ink; c.lineWidth = 9;
      const browY = -67 - 13 * (au[1] || 0) - 14 * (au[2] || 0);
      const angle = g.browAngle * 60 - 15 * (au[1] || 0) + 5 * (au[4] || 0);
      c.beginPath();
      c.moveTo(-31, browY + side * angle);
      c.quadraticCurveTo(0, browY - 7, 31, browY - side * angle);
      c.stroke();
      c.restore();
    }

    // Mejillas, nariz arrugada (AU 9) y tensión labial (AU 23).
    const blush = (au[6] || 0) * 0.4;
    c.fillStyle = `rgba(203, 127, 102, ${blush})`;
    for (const side of [-1, 1]) {
      c.beginPath(); c.ellipse(side * 128, 39, 22, 10, 0, 0, Math.PI * 2); c.fill();
    }
    if ((au[9] || 0) > 0.05) {
      c.strokeStyle = `rgba(41,62,54,${au[9]})`; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-9, 17); c.lineTo(0, 11); c.lineTo(9, 17); c.moveTo(-8, 24); c.lineTo(0, 19); c.lineTo(8, 24); c.stroke();
    }
    const mw = 79 + 35 * (au[20] || 0) - 16 * (au[23] || 0);
    const curve = g.mouthCurve;
    const open = 29 * (au[25] || 0) + 62 * (au[26] || 0);
    const mouthY = 78;
    c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = 8;
    if (open > 12) {
      c.beginPath(); c.moveTo(-mw / 2, mouthY);
      c.bezierCurveTo(-mw / 3, mouthY + curve * 0.45 - open * 0.24, mw / 3, mouthY + curve * 0.45 - open * 0.24, mw / 2, mouthY);
      c.bezierCurveTo(mw / 3, mouthY + curve * 0.65 + open, -mw / 3, mouthY + curve * 0.65 + open, -mw / 2, mouthY);
      c.fill();
      if ((au[12] || 0) > 0.4) {
        c.save(); c.clip(); c.fillStyle = '#dc947f';
        c.beginPath(); c.ellipse(8, mouthY + curve * 0.5 + open * 0.82, 23, 9, 0, 0, Math.PI * 2); c.fill(); c.restore();
      }
    } else {
      c.beginPath(); c.moveTo(-mw / 2, mouthY);
      c.quadraticCurveTo(0, mouthY + curve, mw / 2, mouthY - 8 * (au[10] || 0)); c.stroke();
    }
    c.restore();
  }
}
