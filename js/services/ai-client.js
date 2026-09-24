(function (G) {
  class MainThreadAIClient {
    constructor(analysisService, requestGate = new G.Services.RequestGate()) {
      this.analysis = analysisService;
      this.counterfactual = G.Services.CounterfactualService
        ? new G.Services.CounterfactualService(analysisService)
        : null;
      this.gate = requestGate;
      this.latest = null;
      this.traces = new Map();
      this.metrics = { chooseRequests: 0, compareRequests: 0, staleResults: 0, cancellations: 0 };
    }

    beginTrace(channel) {
      this.traces.set(channel, []);
    }

    recordTrace(channel, progress) {
      if (!progress?.depth) return;
      const trace = this.traces.get(channel) || [];
      const existing = trace.findIndex(item => item.depth === progress.depth);
      const previous = existing >= 0 ? trace[existing] : null;
      const entry = {
        depth: progress.depth,
        nodes: progress.nodes ?? previous?.nodes ?? 0,
        elapsedMs: progress.elapsedMs ?? previous?.elapsedMs ?? 0,
        score: progress.score ?? previous?.score ?? null,
        cacheHits: progress.cacheHits ?? previous?.cacheHits ?? 0,
        tacticalNodes: progress.tacticalNodes ?? previous?.tacticalNodes ?? 0,
        cutoffs: progress.cutoffs ?? previous?.cutoffs ?? 0,
        tableEntries: progress.tableEntries ?? previous?.tableEntries ?? 0,
        bestMove: progress.bestMove
          ? { ...progress.bestMove }
          : previous?.bestMove ? { ...previous.bestMove } : null,
      };
      if (existing >= 0) trace[existing] = entry;
      else trace.push(entry);
      trace.sort((a, b) => a.depth - b.depth);
      this.traces.set(channel, trace.slice(-12));
    }

    searchTrace(channel = null) {
      const key = channel || this.latest?.channel;
      return key ? (this.traces.get(key) || []).map(item => ({
        ...item,
        bestMove: item.bestMove ? { ...item.bestMove } : null,
      })) : [];
    }

    async chooseMove(context, channel = 'ai') {
      const version = this.gate.next(channel);
      this.beginTrace(channel);
      this.metrics.chooseRequests += 1;

      await Promise.resolve();
      if (!this.gate.isCurrent(channel, version)) {
        this.metrics.staleResults += 1;
        return { stale: true, result: null, version };
      }

      const searchOptions = {
        ...(context.searchOptions || {}),
        onProgress: progress => {
          this.latest = { channel, active: true, mode: 'main-thread', ...progress };
          this.recordTrace(channel, this.latest);
          context.onProgress?.(this.latest);
        },
      };
      const result = this.analysis.chooseMove(
        context.board,
        context.moves,
        context.difficulty,
        context.player,
        context.persona,
        context.rng || Math.random,
        searchOptions,
      );
      if (result?.search) {
        this.latest = { channel, active: false, mode: 'main-thread', ...result.search, bestMove: result.move };
        this.recordTrace(channel, this.latest);
        context.onProgress?.(this.latest);
      }

      const stale = !this.gate.isCurrent(channel, version);
      if (stale) this.metrics.staleResults += 1;
      return { stale, result: stale ? null : result, version };
    }

    async compareMove(context, channel = 'counterfactual') {
      const version = this.gate.next(channel);
      this.beginTrace(channel);
      this.metrics.compareRequests += 1;

      await Promise.resolve();
      if (!this.gate.isCurrent(channel, version)) {
        this.metrics.staleResults += 1;
        return { stale: true, result: null, version };
      }

      const result = this.counterfactual?.compare({
        ...context,
        searchOptions: {
          ...(context.searchOptions || {}),
          onProgress: progress => {
            this.latest = { channel, active: true, mode: 'main-thread', ...progress };
            this.recordTrace(channel, this.latest);
            context.onProgress?.(this.latest);
          },
        },
      }) || null;
      const summary = result?.search?.recommendation || result?.recommendedLine?.search || null;
      if (summary) {
        this.latest = { channel, active: false, mode: 'main-thread', ...summary, bestMove: result.recommendedLine };
        this.recordTrace(channel, this.latest);
        context.onProgress?.(this.latest);
      }
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
      if (this.latest?.channel === channel) this.latest = { ...this.latest, active: false };
      return this.gate.invalidate(channel);
    }

    current(channel) {
      return this.gate.current(channel);
    }

    progress() {
      return this.latest ? { ...this.latest } : null;
    }

    stats() {
      return {
        mode: 'main-thread',
        ...this.metrics,
        latestProgress: this.progress(),
        searchTrace: this.searchTrace(),
        requests: {
          ai: this.gate.current('ai'),
          branch: this.gate.current('branch'),
          counterfactual: this.gate.current('counterfactual'),
          variation: this.gate.current('variation'),
        },
      };
    }
  }

  G.Services = G.Services || {};
  G.Services.MainThreadAIClient = MainThreadAIClient;
})(window.Gomoku = window.Gomoku || {});
