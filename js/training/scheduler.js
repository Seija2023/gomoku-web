(function (G) {
  const STEPS_DAYS = [1, 3, 7, 14, 30];

  function stateFor(progress, puzzleId) {
    const current = progress[puzzleId] || {};
    return {
      repetitions: current.repetitions || 0,
      intervalDays: current.intervalDays || 0,
      dueAt: current.dueAt || 0,
      correct: current.correct || 0,
      wrong: current.wrong || 0,
      mastered: Boolean(current.mastered),
      attempts: current.attempts || (current.correct || 0) + (current.wrong || 0),
      best: current.best || 0,
      good: current.good || 0,
      lastGrade: current.lastGrade || null,
      lastAnsweredAt: current.lastAnsweredAt || 0,
      category: current.category || null,
    };
  }

  function normalizeOutcome(outcome) {
    if (typeof outcome === 'boolean') return { grade: outcome ? 'best' : 'wrong', category: null };
    if (typeof outcome === 'string') return { grade: outcome, category: null };
    return {
      grade: outcome?.grade || (outcome?.correct ? 'best' : 'wrong'),
      category: outcome?.category || null,
    };
  }

  function update(progress, puzzleId, outcome, now = Date.now()) {
    const current = stateFor(progress, puzzleId);
    const result = normalizeOutcome(outcome);
    const next = {
      ...current,
      attempts: current.attempts + 1,
      lastGrade: result.grade,
      lastAnsweredAt: now,
      category: result.category || current.category,
    };

    if (result.grade === 'best') {
      next.best += 1;
      next.correct += 1;
      next.repetitions += 1;
      next.intervalDays = STEPS_DAYS[Math.min(next.repetitions - 1, STEPS_DAYS.length - 1)];
      next.dueAt = now + next.intervalDays * 24 * 60 * 60 * 1000;
      next.mastered = next.repetitions >= 4 && next.best >= 3;
    } else if (result.grade === 'good') {
      next.good += 1;
      next.correct += 1;
      next.repetitions = Math.max(1, next.repetitions + 1);
      const step = STEPS_DAYS[Math.min(Math.max(0, next.repetitions - 2), STEPS_DAYS.length - 1)];
      next.intervalDays = Math.max(1, Math.round(step / 2));
      next.dueAt = now + next.intervalDays * 24 * 60 * 60 * 1000;
      next.mastered = next.repetitions >= 5 && next.best >= 2;
    } else {
      next.wrong += 1;
      next.repetitions = 0;
      next.intervalDays = 0;
      next.dueAt = now + 5 * 60 * 1000;
      next.mastered = false;
    }

    return { ...progress, [puzzleId]: next };
  }

  function order(puzzles, progress, now = Date.now()) {
    return [...puzzles].sort((a, b) => {
      const sa = stateFor(progress, a.id);
      const sb = stateFor(progress, b.id);
      const dueA = !sa.dueAt || sa.dueAt <= now ? 0 : sa.dueAt;
      const dueB = !sb.dueAt || sb.dueAt <= now ? 0 : sb.dueAt;
      if (dueA !== dueB) return dueA - dueB;
      if ((sa.wrong || 0) !== (sb.wrong || 0)) return (sb.wrong || 0) - (sa.wrong || 0);
      return (sa.repetitions || 0) - (sb.repetitions || 0);
    });
  }

  function stats(puzzles, progress, now = Date.now()) {
    let due = 0;
    let weak = 0;
    let mastered = 0;
    let attempts = 0;
    let best = 0;
    let good = 0;
    let wrong = 0;

    for (const puzzle of puzzles) {
      const state = stateFor(progress, puzzle.id);
      if (!state.dueAt || state.dueAt <= now) due += 1;
      if (state.wrong > state.correct || (!state.mastered && state.wrong > 0)) weak += 1;
      if (state.mastered) mastered += 1;
      attempts += state.attempts;
      best += state.best;
      good += state.good;
      wrong += state.wrong;
    }

    return {
      total: puzzles.length,
      due,
      weak,
      mastered,
      attempts,
      best,
      good,
      wrong,
      accuracy: attempts ? Math.round(((best + good) / attempts) * 100) : 0,
    };
  }

  G.TrainingScheduler = Object.freeze({ stateFor, update, order, stats });
})(window.Gomoku = window.Gomoku || {});
