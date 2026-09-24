(function (G) {
  function categoryStats(puzzles, progress, mistakes = []) {
    const map = new Map();

    function ensure(type) {
      if (!map.has(type)) {
        const info = G.ErrorTaxonomy.info(type);
        map.set(type, {
          type,
          label: info.label,
          priority: info.priority,
          mistakes: 0,
          puzzles: 0,
          attempts: 0,
          correct: 0,
          wrong: 0,
          mastered: 0,
          mastery: 0,
          weakness: 0,
        });
      }
      return map.get(type);
    }

    for (const mistake of mistakes || []) ensure(mistake.type).mistakes += 1;

    for (const puzzle of puzzles || []) {
      const row = ensure(puzzle.category || puzzle.type || 'SHAPE_LOSS');
      row.puzzles += 1;
      const state = G.TrainingScheduler.stateFor(progress, puzzle.id);
      const best = state.best || 0;
      const good = state.good || 0;
      row.attempts += state.attempts || state.correct + state.wrong || 0;
      row.correct += best + good;
      row.wrong += state.wrong || 0;
      if (state.mastered) row.mastered += 1;
    }

    for (const row of map.values()) {
      row.mastery = row.puzzles ? Math.round((row.mastered / row.puzzles) * 100) : 0;
      const errorPressure = row.mistakes * 2 + row.wrong * 3;
      const learningCredit = row.correct + row.mastered * 2;
      row.weakness = Math.max(0, errorPressure - learningCredit + row.priority);
    }

    return [...map.values()].sort((a, b) =>
      b.weakness - a.weakness || b.mistakes - a.mistakes || b.priority - a.priority
    );
  }

  function scorePuzzle(puzzle, progress, categoryMap, now, mode) {
    const state = G.TrainingScheduler.stateFor(progress, puzzle.id);
    const category = categoryMap.get(puzzle.category || puzzle.type) || { weakness: 0 };
    const due = !state.dueAt || state.dueAt <= now;
    const overdueHours = state.dueAt && state.dueAt < now ? Math.min(72, (now - state.dueAt) / 3_600_000) : 0;
    const novelty = state.attempts ? 0 : 26;
    const weakness = category.weakness * 5;
    const severity = (puzzle.severity || 1) * 11;
    const confidence = (puzzle.confidence || 60) * 0.18;
    const wrongPressure = (state.wrong || 0) * 18;
    const masteredPenalty = state.mastered ? 55 : 0;
    const dueBonus = due ? 80 : 0;
    const modeBonus = mode === 'mistakes' ? (puzzle.sourceKind === 'mistake' ? 50 : -80) : 0;
    return dueBonus + overdueHours + novelty + weakness + severity + confidence + wrongPressure + modeBonus - masteredPenalty;
  }

  function plan(puzzles, progress, options = {}) {
    const mode = options.mode || 'adaptive';
    const limit = options.limit || G.Config.TRAINING_SESSION_SIZE || 8;
    const now = options.now || Date.now();
    const mistakes = options.mistakes || [];
    const categories = categoryStats(puzzles, progress, mistakes);
    const categoryMap = new Map(categories.map(item => [item.type, item]));

    return [...(puzzles || [])]
      .filter(puzzle => mode !== 'mistakes' || puzzle.sourceKind === 'mistake')
      .map(puzzle => ({
        puzzle,
        score: scorePuzzle(puzzle, progress, categoryMap, now, mode),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.puzzle);
  }

  function summary(puzzles, progress, mistakes = []) {
    const categories = categoryStats(puzzles, progress, mistakes);
    const trainableMistakes = (mistakes || []).filter(item => item.trainable);
    const totalAttempts = Object.values(progress || {}).reduce((sum, item) => sum + (item.attempts || item.correct + item.wrong || 0), 0);
    const best = Object.values(progress || {}).reduce((sum, item) => sum + (item.best || 0), 0);
    const good = Object.values(progress || {}).reduce((sum, item) => sum + (item.good || 0), 0);
    const accuracy = totalAttempts ? Math.round(((best + good) / totalAttempts) * 100) : 0;
    return {
      categories,
      topWeakness: categories[0] || null,
      recentMistakes: trainableMistakes.slice(0, 6),
      trainableMistakes: trainableMistakes.length,
      totalMistakes: (mistakes || []).length,
      totalAttempts,
      accuracy,
    };
  }

  G.AdaptiveTraining = Object.freeze({ categoryStats, plan, summary });
})(window.Gomoku = window.Gomoku || {});
