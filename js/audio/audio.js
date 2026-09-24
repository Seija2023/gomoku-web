(function (G) {
  class AudioManager {
    constructor(enabled = true) {
      this.context = null;
      this.enabled = enabled !== false;
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (this.enabled) {
        this.ensureReady();
        this.playTone(500, 0.055, 0.02);
      }
      return this.enabled;
    }

    ensureReady() {
      if (!this.enabled) return null;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.context) this.context = new AudioCtx();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      return this.context;
    }

    playTone(frequency, duration, volume = 0.035, delay = 0) {
      const ctx = this.ensureReady();
      if (!ctx || !this.enabled) return;

      const start = ctx.currentTime + delay;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(Math.max(volume, 0.0001), start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    }

    playMove(player) {
      this.playTone(player === G.Config.BLACK ? 330 : 420, 0.065, 0.028);
    }

    playWin() {
      [523.25, 659.25, 783.99].forEach((f, i) => this.playTone(f, 0.22, 0.035, i * 0.1));
    }

    playDraw() {
      this.playTone(260, 0.13, 0.03);
      this.playTone(220, 0.18, 0.03, 0.12);
    }

    toggle() {
      return this.setEnabled(!this.enabled);
    }
  }

  G.Audio = Object.freeze({ AudioManager });
})(window.Gomoku = window.Gomoku || {});
