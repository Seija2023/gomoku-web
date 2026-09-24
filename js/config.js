(function (G) {
  const Config = {
    SIZE: 15,
    BLACK: 1,
    WHITE: 2,
    MODES: Object.freeze({ PVP: 'pvp', AI: 'ai' }),
    DIRECTIONS: Object.freeze([[1, 0], [0, 1], [1, 1], [1, -1]]),
    STAR_POINTS: Object.freeze([[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]]),
    AI_DELAY_MS: 360,
    RESULT_DELAY_MS: 160,
  };

  G.Config = Object.freeze(Config);
})(window.Gomoku = window.Gomoku || {});
