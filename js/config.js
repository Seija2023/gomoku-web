(function (G) {
  const Config = {
    SIZE: 15,
    BLACK: 1,
    WHITE: 2,
    MODES: Object.freeze({ PVP: 'pvp', AI: 'ai' }),
    AI_DIFFICULTIES: Object.freeze({ EASY: 'easy', NORMAL: 'normal', HARD: 'hard' }),
    AI_PERSONAS: Object.freeze({
      BALANCED: 'balanced',
      ATTACK: 'attack',
      DEFENSE: 'defense',
      RISKY: 'risky',
    }),
    DIRECTIONS: Object.freeze([[1, 0], [0, 1], [1, 1], [1, -1]]),
    STAR_POINTS: Object.freeze([[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]]),
    AI_DELAY_MS: 220,
    AI_BUDGET_MS: Object.freeze({ easy: 90, normal: 320, hard: 900, analysis: 1400 }),
    AI_MAX_DEPTH: Object.freeze({ easy: 2, normal: 4, hard: 6, analysis: 7 }),
    AI_CANDIDATE_LIMIT: Object.freeze({ easy: 6, normal: 8, hard: 10, analysis: 12 }),
    RESULT_DELAY_MS: 160,
    REVIEW_STEP_MS: 650,
    GHOST_HOLD_MS: 360,
    GHOST_THROTTLE_MS: 120,
    MAX_TRAINING_PUZZLES: 12,
    OPENING_DEPTH: 5,
  };

  G.Config = Object.freeze(Config);
})(window.Gomoku = window.Gomoku || {});
