(function (G) {
  class WorkerAIClient {
    constructor(analysisService, requestGate = new G.Services.RequestGate(), options = {}) {
      this.analysis = analysisService;
      this.gate = requestGate;
      this.options = options;
      this.fallback = new G.Services.MainThreadAIClient(
        analysisService,
        new G.Services.RequestGate(),
      );
      this.worker = null;
      this.workerUrl = null;
      this.readyPromise = null;
      this.pending = new Map();
      this.nextId = 1;
      this.mode = 'starting';
      this.latest = null;
      this.metrics = {
        chooseRequests: 0,
        compareRequests: 0,
        staleResults: 0,
        cancellations: 0,
        workerRestarts: 0,
        fallbackRequests: 0,
        workerErrors: 0,
      };
      this.startWorker();
    }

    deviceFactor() {
      if (typeof navigator === 'undefined') return 1;
      const cores = Number(navigator.hardwareConcurrency || 4);
      const memory = Number(navigator.deviceMemory || 4);
      const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '');
      let factor = 1;
      if (cores <= 4 || memory <= 4) factor *= 0.72;
      else if (cores <= 6) factor *= 0.86;
      if (mobile) factor *= 0.82;
      return Math.max(0.55, Math.min(1, factor));
    }

    makeWorker() {
      if (this.options.workerFactory) return this.options.workerFactory();

      const EmbeddedWorker = typeof globalThis !== 'undefined'
        ? globalThis.GOMOKU_WORKER_SOURCE
        : null;
      if (EmbeddedWorker) {
        const blob = new Blob([EmbeddedWorker], { type: 'text/javascript' });
        this.workerUrl = URL.createObjectURL(blob);
        return new Worker(this.workerUrl);
      }

      return new Worker('js/ai/worker-entry.js');
    }

    startWorker() {
      if (typeof Worker === 'undefined' && !this.options.workerFactory) {
        this.mode = 'fallback';
        this.readyPromise = Promise.resolve(false);
        return this.readyPromise;
      }

      this.mode = 'starting';
      this.readyPromise = new Promise(resolve => {
        let settled = false;
        const settle = value => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        };

        try {
          const worker = this.makeWorker();
          this.worker = worker;

          const onMessage = event => {
            const message = event.data || {};
            if (message.type === 'ready') {
              this.mode = 'worker';
              settle(true);
              return;
            }
            this.handleMessage(message);
          };
          const onError = () => {
            this.metrics.workerErrors += 1;
            this.switchToFallback('worker-error');
            settle(false);
          };

          worker.addEventListener('message', onMessage);
          worker.addEventListener('error', onError);
        } catch {
          this.metrics.workerErrors += 1;
          this.switchToFallback('worker-constructor');
          settle(false);
        }

        const timer = setTimeout(() => {
          this.metrics.workerErrors += 1;
          this.switchToFallback('worker-timeout');
          settle(false);
        }, 2200);
      });

      return this.readyPromise;
    }

    switchToFallback() {
      try { this.worker?.terminate(); } catch {}
      this.worker = null;
      if (this.workerUrl) {
        try { URL.revokeObjectURL(this.workerUrl); } catch {}
        this.workerUrl = null;
      }
      this.mode = 'fallback';

      for (const item of this.pending.values()) {
        this.runFallback(item);
      }
      this.pending.clear();
    }

    restartWorker() {
      try { this.worker?.terminate(); } catch {}
      this.worker = null;
      if (this.workerUrl) {
        try { URL.revokeObjectURL(this.workerUrl); } catch {}
        this.workerUrl = null;
      }
      this.metrics.workerRestarts += 1;
      this.startWorker();
    }

    async runFallback(item) {
      this.metrics.fallbackRequests += 1;
      const method = item.operation === 'choose' ? 'chooseMove' : 'compareMove';
      const response = await this.fallback[method](item.context, item.channel);
      const stale = !this.gate.isCurrent(item.channel, item.version);
      if (stale) this.metrics.staleResults += 1;
      item.resolve({
        stale,
        result: stale ? null : response.result,
        version: item.version,
        fallback: true,
      });
    }

    handleMessage(message) {
      if (message.type === 'progress') {
        const item = this.pending.get(message.id);
        if (!item) return;
        const progress = {
          channel: item.channel,
          active: true,
          mode: 'worker',
          ...message.progress,
        };
        this.latest = progress;
        item.context.onProgress?.({ ...progress });
        return;
      }

      const item = this.pending.get(message.id);
      if (!item) return;
      this.pending.delete(message.id);

      if (message.type === 'error') {
        this.metrics.workerErrors += 1;
        this.runFallback(item);
        return;
      }
      if (message.type !== 'result') return;

      const stale = !this.gate.isCurrent(item.channel, item.version);
      if (stale) this.metrics.staleResults += 1;

      const summary = message.result?.search
        || message.result?.search?.recommendation
        || message.result?.recommendedLine?.search
        || null;
      if (message.result?.search?.recommendation) {
        Object.assign(summary, message.result.search.recommendation);
      }
      if (summary) {
        this.latest = {
          channel: item.channel,
          active: false,
          mode: 'worker',
          ...summary,
          bestMove: message.result?.move || message.result?.recommendedLine || null,
        };
        item.context.onProgress?.({ ...this.latest });
      } else if (this.latest?.channel === item.channel) {
        this.latest = { ...this.latest, active: false };
      }

      item.resolve({
        stale,
        result: stale ? null : message.result,
        version: item.version,
        fallback: false,
      });
    }

    buildSearchOptions(context, operation) {
      const factor = this.deviceFactor();
      const analysis = operation === 'compare' || context.analysis === true;
      const difficulty = context.difficulty || G.Config.AI_DIFFICULTIES.HARD;
      const baseBudget = analysis
        ? G.Config.AI_BUDGET_MS.analysis
        : (G.Config.AI_BUDGET_MS[difficulty] || G.Config.AI_BUDGET_MS.normal);
      const baseDepth = analysis
        ? G.Config.AI_MAX_DEPTH.analysis
        : (G.Config.AI_MAX_DEPTH[difficulty] || G.Config.AI_MAX_DEPTH.normal);
      const baseLimit = analysis
        ? G.Config.AI_CANDIDATE_LIMIT.analysis
        : (G.Config.AI_CANDIDATE_LIMIT[difficulty] || G.Config.AI_CANDIDATE_LIMIT.normal);

      return {
        analysis,
        timeBudgetMs: Math.max(50, Math.round(
          (context.searchOptions?.timeBudgetMs || baseBudget) * factor
        )),
        maxDepth: Math.max(2, Math.min(
          context.searchOptions?.maxDepth || baseDepth,
          factor < 0.7 ? baseDepth - 1 : baseDepth,
        )),
        candidateLimit: context.searchOptions?.candidateLimit || baseLimit,
      };
    }

    async request(operation, context, channel) {
      const version = this.gate.next(channel);
      if (operation === 'choose') this.metrics.chooseRequests += 1;
      else this.metrics.compareRequests += 1;

      await this.readyPromise;
      if (!this.gate.isCurrent(channel, version)) {
        this.metrics.staleResults += 1;
        return { stale: true, result: null, version };
      }

      if (this.mode !== 'worker' || !this.worker) {
        return new Promise(resolve => {
          this.runFallback({ operation, context, channel, version, resolve });
        });
      }

      const id = this.nextId++;
      const searchOptions = this.buildSearchOptions(context, operation);
      const serializableContext = {
        ...context,
        onProgress: undefined,
        rng: undefined,
        searchOptions,
      };

      return new Promise(resolve => {
        this.pending.set(id, { id, operation, context, channel, version, resolve });
        this.worker.postMessage({
          type: 'request',
          id,
          operation,
          channel,
          context: serializableContext,
        });
      });
    }

    chooseMove(context, channel = 'ai') {
      return this.request('choose', context, channel);
    }

    compareMove(context, channel = 'counterfactual') {
      return this.request('compare', context, channel);
    }

    candidates(context) {
      return this.fallback.candidates(context);
    }

    preview(context) {
      return this.fallback.preview(context);
    }

    heatmap(context) {
      return this.fallback.heatmap(context);
    }

    advantage(moves) {
      return this.fallback.advantage(moves);
    }

    cancel(channel) {
      this.metrics.cancellations += 1;
      this.gate.invalidate(channel);

      let cancelledWorker = false;
      for (const [id, item] of this.pending.entries()) {
        if (item.channel !== channel) continue;
        this.pending.delete(id);
        this.metrics.staleResults += 1;
        item.resolve({ stale: true, result: null, version: item.version });
        cancelledWorker = true;
      }

      if (cancelledWorker && this.mode === 'worker') {
        for (const item of this.pending.values()) {
          this.metrics.staleResults += 1;
          item.resolve({ stale: true, result: null, version: item.version });
        }
        this.pending.clear();
        this.restartWorker();
      }

      if (this.mode === 'fallback') this.fallback.cancel(channel);
      return this.gate.current(channel);
    }

    current(channel) {
      return this.gate.current(channel);
    }

    progress() {
      return this.latest ? { ...this.latest } : null;
    }

    stats() {
      return {
        mode: this.mode,
        ...this.metrics,
        pending: this.pending.size,
        deviceFactor: this.deviceFactor(),
        latestProgress: this.progress(),
        requests: {
          ai: this.gate.current('ai'),
          branch: this.gate.current('branch'),
          counterfactual: this.gate.current('counterfactual'),
        },
      };
    }
  }

  function createAIClient(analysisService, requestGate) {
    return new WorkerAIClient(analysisService, requestGate);
  }

  G.Services = G.Services || {};
  G.Services.WorkerAIClient = WorkerAIClient;
  G.Services.createAIClient = createAIClient;
})(window.Gomoku = window.Gomoku || {});
