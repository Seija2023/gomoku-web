(function (G) {
  const { BLACK, WHITE } = G.Config;

  function normalizeMode(mode) {
    return ['black', 'white', 'combined'].includes(mode) ? mode : 'combined';
  }

  function generate(board, moves, mode = 'combined') {
    const actualMode = normalizeMode(mode);
    const candidates = G.AI.getCandidateMoves(board, moves, 2);
    const scored = candidates.map(move => {
      const black = G.AI.evaluateMove(board, move.r, move.c, BLACK);
      const white = G.AI.evaluateMove(board, move.r, move.c, WHITE);
      let score;
      if (actualMode === 'black') score = black;
      else if (actualMode === 'white') score = white;
      else score = Math.max(black, white) + Math.min(black, white) * 0.25;
      return { ...move, score, black, white };
    }).sort((a, b) => b.score - a.score);

    const top = scored.slice(0, 24);
    const max = top[0]?.score || 1;
    return top.map((item, index) => {
      const ratio = Math.max(0, item.score / max);
      let level = 1;
      if (index < 3 || ratio >= 0.75) level = 4;
      else if (index < 7 || ratio >= 0.45) level = 3;
      else if (index < 14 || ratio >= 0.2) level = 2;

      return {
        ...item,
        level,
        title: actualMode === 'black'
          ? `黑棋价值 ${Math.round(item.black)}`
          : actualMode === 'white'
            ? `白棋价值 ${Math.round(item.white)}`
            : `综合价值 ${Math.round(item.score)}`,
      };
    });
  }

  G.Heatmap = Object.freeze({ generate });
})(window.Gomoku = window.Gomoku || {});
