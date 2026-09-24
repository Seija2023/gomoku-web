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
        state?.attempts || 0,
        state?.best || 0,
        state?.good || 0,
        state?.lastGrade || '',
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
      const mistakes = G.MistakeMiner?.mine?.(records) || [];
      const puzzles = G.Puzzles.generate(records, G.Config?.MAX_TRAINING_PUZZLES, mistakes);
      const value = Object.freeze({
        mistakes,
        puzzles,
        profile: G.Profile.compute(records, mistakes),
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
      const adaptive = G.AdaptiveTraining?.summary?.(history.puzzles, progress, history.mistakes) || {
        categories: [],
        topWeakness: null,
        recentMistakes: [],
        trainableMistakes: 0,
        totalMistakes: history.mistakes.length,
        totalAttempts: 0,
        accuracy: trainingStats.accuracy || 0,
      };
      const trainingValue = Object.freeze({ trainingStats, adaptive });
      this.trainingCache = { key, value: trainingValue };
      return { ...history, ...trainingValue };
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
