(function (G) {
  class MainThreadAIClient {
    constructor(analysisService, requestGate = new G.Services.RequestGate()) {
      this.analysis = analysisService;
      this.gate = requestGate;
      this.metrics = { chooseRequests: 0, staleResults: 0, cancellations: 0 };
    }

    async chooseMove(context, channel = 'ai') {
      const version = this.gate.next(channel);
      this.metrics.chooseRequests += 1;

      await Promise.resolve();
      if (!this.gate.isCurrent(channel, version)) {
        this.metrics.staleResults += 1;
        return { stale: true, result: null, version };
      }

      const result = this.analysis.chooseMove(
        context.board,
        context.moves,
        context.difficulty,
        context.player,
        context.persona,
        context.rng || Math.random,
      );

      const stale = !this.gate.isCurrent(channel, version);
      if (stale) this.metrics.staleResults += 1;
      return { stale, result: stale ? null : result, version };
    }

    candidates(context) {
      return this.analysis.candidates(
        context.board,
        context.moves,
        context.player,
        context.persona,
        context.limit || 3,
      );
    }

    preview(context) {
      return this.analysis.ghost(
        context.board,
        context.moves,
        context.r,
        context.c,
        context.player,
        context.persona,
      );
    }

    heatmap(context) {
      return this.analysis.heatmap(context.board, context.moves, context.mode);
    }

    advantage(moves) {
      return this.analysis.advantage(moves);
    }

    cancel(channel) {
      this.metrics.cancellations += 1;
      return this.gate.invalidate(channel);
    }

    current(channel) {
      return this.gate.current(channel);
    }

    stats() {
      return {
        ...this.metrics,
        requests: {
          ai: this.gate.current('ai'),
          branch: this.gate.current('branch'),
        },
      };
    }
  }

  G.Services = G.Services || {};
  G.Services.MainThreadAIClient = MainThreadAIClient;
})(window.Gomoku = window.Gomoku || {});
