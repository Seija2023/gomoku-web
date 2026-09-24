(function (G) {
  const { SIZE, BLACK } = G.Config;
  function coordinate(move) {
    if (!move) return '';
    const col = String.fromCharCode(65 + move.c);
    return `${col}${move.r + 1}`;
  }
  function moveLabel(move, index) {
    const side = move.player === BLACK ? '黑' : '白';
    return `${index + 1}. ${side} ${coordinate(move)}`;
  }
  function boardAt(moves, index = moves.length) {
    const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    const capped = Math.max(0, Math.min(index, moves.length));
    for (let i = 0; i < capped; i += 1) {
      const move = moves[i];
      board[move.r][move.c] = move.player;
    }
    return board;
  }
  G.History = Object.freeze({ coordinate, moveLabel, boardAt });
})(window.Gomoku = window.Gomoku || {});
