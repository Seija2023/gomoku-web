(function (G) {
  const { BLACK, WHITE, AI_PERSONAS } = G.Config;

  function topScore(board, moves, player) {
    const best = G.AI.rankMoves(board, moves, player, AI_PERSONAS.BALANCED)[0];
    return best ? best.score : 0;
  }

  function scorePosition(board, moves) {
    if (!moves.length) return 0;
    const black = topScore(board, moves, BLACK);
    const white = topScore(board, moves, WHITE);
    const raw = black - white;
    return Math.max(-100, Math.min(100, Math.round(Math.tanh(raw / 120000) * 100)));
  }

  function series(moves) {
    const points = [{ index: 0, value: 0 }];
    const board = Array.from({ length: G.Config.SIZE }, () => Array(G.Config.SIZE).fill(0));
    const prefix = [];

    for (let i = 0; i < moves.length; i += 1) {
      const move = moves[i];
      board[move.r][move.c] = move.player;
      prefix.push(move);
      points.push({ index: i + 1, value: scorePosition(board, prefix) });
    }

    return points;
  }

  G.Advantage = Object.freeze({ scorePosition, series });
})(window.Gomoku = window.Gomoku || {});
