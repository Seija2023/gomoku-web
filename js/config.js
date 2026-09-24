(function (G) {
  const Config = {
    SIZE: 15,
    BLACK: 1,
    WHITE: 2,
    MODES: Object.freeze({ PVP: 'pvp', AI: 'ai' }),
    AI_DIFFICULTIES: Object.freeze({ EASY: 'easy', NORMAL: 'normal', HARD: 'hard' }),
    DIRECTIONS: Object.freeze([[1, 0], [0, 1], [1, 1], [1, -1]]),
    STAR_POINTS: Object.freeze([[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]]),
    AI_DELAY_MS: 360,
    RESULT_DELAY_MS: 160,
    REVIEW_STEP_MS: 650,
    MAX_TRAINING_PUZZLES: 12,
  };

  G.Config = Object.freeze(Config);
})(window.Gomoku = window.Gomoku || {});
