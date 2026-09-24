(function (G) {
  const { DIRECTIONS } = G.Config;

  function isInside(board, r, c) {
    const size = board.length;
    return r >= 0 && r < size && c >= 0 && c < size;
  }

  function countDirection(board, r, c, dr, dc, player) {
    let count = 0;
    let nr = r + dr;
    let nc = c + dc;

    while (isInside(board, nr, nc) && board[nr][nc] === player) {
      count += 1;
      nr += dr;
      nc += dc;
    }
    return count;
  }

  function hasWon(board, r, c, player) {
    if (!isInside(board, r, c) || board[r][c] !== player) return false;
    return DIRECTIONS.some(([dr, dc]) => {
      const count = 1
        + countDirection(board, r, c, dr, dc, player)
        + countDirection(board, r, c, -dr, -dc, player);
      return count >= 5;
    });
  }

  function isBoardFull(board) {
    return board.every(row => row.every(cell => cell !== 0));
  }

  G.Rules = Object.freeze({ isInside, countDirection, hasWon, isBoardFull });
})(window.Gomoku = window.Gomoku || {});
