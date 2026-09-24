(function (G) {
  function historyKey(records) {
    return (records || []).map(record =>
      [
        record.id || '',
        record.finishedAt || '',
        record.moves?.length || 0,
        record.winner || 0,
        record.mode || '',
      ].join(':')
    ).join('|');
  }

  function progressKey(progress) {
    const entries = Object.entries(progress || {}).sort(([a], [b]) => a.localeCompare(b));
    return entries.map(([id, state]) =>
      [
        id,
        state?.repetitions || 0,
        state?.correct || 0,
        state?.wrong || 0,
        state?.dueAt || 0,
        state?.mastered ? 1 : 0,
      ].join(':')
    ).join('|');
  }

  class DerivedService {
    constructor() {
      this.historyCache = { key: null, value: null };
      this.trainingCache = { key: null, value: null };
      this.metrics = { historyHits: 0, historyMisses: 0, trainingHits: 0, trainingMisses: 0 };
    }

    history(records) {
      const key = historyKey(records);
      if (key === this.historyCache.key && this.historyCache.value) {
        this.metrics.historyHits += 1;
        return this.historyCache.value;
      }

      this.metrics.historyMisses += 1;
      const puzzles = G.Puzzles.generate(records);
      const value = Object.freeze({
        puzzles,
        profile: G.Profile.compute(records),
        openings: G.Openings.build(records),
      });
      this.historyCache = { key, value };
      this.trainingCache = { key: null, value: null };
      return value;
    }

    training(records, progress) {
      const history = this.history(records);
      const key = `${this.historyCache.key}::${progressKey(progress)}`;
      if (key === this.trainingCache.key && this.trainingCache.value) {
        this.metrics.trainingHits += 1;
        return { ...history, trainingStats: this.trainingCache.value };
      }

      this.metrics.trainingMisses += 1;
      const trainingStats = G.TrainingScheduler.stats(history.puzzles, progress);
      this.trainingCache = { key, value: trainingStats };
      return { ...history, trainingStats };
    }

    invalidateHistory() {
      this.historyCache = { key: null, value: null };
      this.trainingCache = { key: null, value: null };
    }

    invalidateTraining() {
      this.trainingCache = { key: null, value: null };
    }

    stats() {
      return {
        ...this.metrics,
        historyCached: Boolean(this.historyCache.value),
        trainingCached: Boolean(this.trainingCache.value),
      };
    }
  }

  G.Services = G.Services || {};
  G.Services.DerivedService = DerivedService;
})(window.Gomoku = window.Gomoku || {});
