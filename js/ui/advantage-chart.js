(function (G) {
  class AdvantageChart {
    constructor(canvas, label, onSeek) {
      this.canvas = canvas;
      this.label = label;
      this.onSeek = onSeek;
      this.points = [];
      this.index = 0;
      this.resizeObserver = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => this.draw())
        : null;
      this.resizeObserver?.observe(canvas);
      canvas.addEventListener('pointerdown', event => this.seekFromEvent(event));
      canvas.addEventListener('pointermove', event => {
        if (event.buttons || event.pointerType !== 'mouse') this.seekFromEvent(event);
      });
    }

    set(points, index) {
      this.points = points || [];
      this.index = index || 0;
      this.draw();
    }

    seekFromEvent(event) {
      if (!this.points.length) return;
      const rect = this.canvas.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
      const index = Math.round(ratio * (this.points.length - 1));
      this.onSeek?.(index);
    }

    draw() {
      const canvas = this.canvas;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(280, Math.round(rect.width || 600));
      const height = Math.max(100, Math.round(rect.height || 130));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const pad = { l: 28, r: 10, t: 10, b: 20 };
      const w = width - pad.l - pad.r;
      const h = height - pad.t - pad.b;
      const yFor = value => pad.t + ((100 - value) / 200) * h;
      const xFor = index => pad.l + (index / Math.max(1, this.points.length - 1)) * w;

      ctx.strokeStyle = 'rgba(55,39,21,.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, yFor(0));
      ctx.lineTo(width - pad.r, yFor(0));
      ctx.stroke();

      ctx.fillStyle = 'rgba(55,39,21,.55)';
      ctx.font = '11px sans-serif';
      ctx.fillText('黑+', 3, pad.t + 8);
      ctx.fillText('0', 10, yFor(0) + 4);
      ctx.fillText('白+', 3, pad.t + h);

      if (this.points.length > 1) {
        ctx.strokeStyle = '#6f5131';
        ctx.lineWidth = 2;
        ctx.beginPath();
        this.points.forEach((point, i) => {
          const x = xFor(i);
          const y = yFor(point.value);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      const active = this.points[Math.max(0, Math.min(this.index, this.points.length - 1))];
      if (active) {
        const x = xFor(active.index);
        const y = yFor(active.value);
        ctx.strokeStyle = 'rgba(46,43,39,.25)';
        ctx.beginPath();
        ctx.moveTo(x, pad.t);
        ctx.lineTo(x, pad.t + h);
        ctx.stroke();

        ctx.fillStyle = '#2e2b27';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();

        this.label.textContent = `第 ${active.index} 手 · 棋形优势指数 ${active.value > 0 ? '+' : ''}${active.value}`;
      } else {
        this.label.textContent = '棋形优势指数：暂无数据';
      }
    }
  }

  G.UI = G.UI || {};
  G.UI.AdvantageChart = AdvantageChart;
})(window.Gomoku = window.Gomoku || {});
