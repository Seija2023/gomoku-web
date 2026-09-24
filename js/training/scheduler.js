(function (G) {
  const STEPS_DAYS = [1, 3, 7, 14, 30];

  function stateFor(progress, puzzleId) {
    return progress[puzzleId] || {
      repetitions: 0,
      intervalDays: 0,
      dueAt: 0,
      correct: 0,
      wrong: 0,
      mastered: false,
    };
  }

  function update(progress, puzzleId, correct, now = Date.now()) {
    const current = stateFor(progress, puzzleId);
    const next = { ...current };

    if (correct) {
      next.correct += 1;
      next.repetitions += 1;
      next.intervalDays = STEPS_DAYS[Math.min(next.repetitions - 1, STEPS_DAYS.length - 1)];
      next.dueAt = now + next.intervalDays * 24 * 60 * 60 * 1000;
      next.mastered = next.repetitions >= 4;
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
      return (sa.repetitions || 0) - (sb.repetitions || 0);
    });
  }

  function stats(puzzles, progress, now = Date.now()) {
    let due = 0;
    let weak = 0;
    let mastered = 0;

    for (const puzzle of puzzles) {
      const state = stateFor(progress, puzzle.id);
      if (!state.dueAt || state.dueAt <= now) due += 1;
      if (state.wrong > state.correct || (!state.mastered && state.wrong > 0)) weak += 1;
      if (state.mastered) mastered += 1;
    }

    return { total: puzzles.length, due, weak, mastered };
  }

  G.TrainingScheduler = Object.freeze({ stateFor, update, order, stats });
})(window.Gomoku = window.Gomoku || {});
