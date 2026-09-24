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
      this.traces = new Map();
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
        let timer = null;
        const settle = value => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
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

        timer = setTimeout(() => {
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
      const fallbackTrace = this.fallback.searchTrace?.(item.channel) || [];
      this.traces.set(item.channel, fallbackTrace.map(entry => ({
        ...entry,
        bestMove: entry.bestMove ? { ...entry.bestMove } : null,
      })));
      const fallbackProgress = this.fallback.progress?.();
      if (fallbackProgress) this.latest = { ...fallbackProgress, mode: 'main-thread' };
      const stale = !this.gate.isCurrent(item.channel, item.version);
      if (stale) this.metrics.staleResults += 1;
      item.resolve({
        stale,
        result: stale ? null : response.result,
        version: item.version,
        fallback: true,
      });
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
        this.recordTrace(item.channel, progress);
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

      const summary = message.result?.search?.recommendation
        || message.result?.search
        || message.result?.recommendedLine?.search
        || null;
      if (summary) {
        this.latest = {
          channel: item.channel,
          active: false,
          mode: 'worker',
          ...summary,
          bestMove: message.result?.move || message.result?.recommendedLine || null,
        };
        this.recordTrace(item.channel, this.latest);
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
      this.beginTrace(channel);
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
      if (this.latest?.channel === channel) this.latest = { ...this.latest, active: false };

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

  function createAIClient(analysisService, requestGate) {
    return new WorkerAIClient(analysisService, requestGate);
  }

  G.Services = G.Services || {};
  G.Services.WorkerAIClient = WorkerAIClient;
  G.Services.createAIClient = createAIClient;
})(window.Gomoku = window.Gomoku || {});
