(function (G) {
  const { DIRECTIONS } = G.Config;

  function isInside(board, r, c) {
    const size = board.length;
    return r >= 0 && r < size && c >= 0 && c < size;
  }

  function collectDirection(board, r, c, dr, dc, player) {
    const cells = [];
    let nr = r + dr;
    let nc = c + dc;
    while (isInside(board, nr, nc) && board[nr][nc] === player) {
      cells.push({ r: nr, c: nc });
      nr += dr;
      nc += dc;
    }
    return cells;
  }

  function countDirection(board, r, c, dr, dc, player) {
    return collectDirection(board, r, c, dr, dc, player).length;
  }

  function findWinningLine(board, r, c, player) {
    if (!isInside(board, r, c) || board[r][c] !== player) return null;
    for (const [dr, dc] of DIRECTIONS) {
      const backward = collectDirection(board, r, c, -dr, -dc, player).reverse();
      const forward = collectDirection(board, r, c, dr, dc, player);
      const line = [...backward, { r, c }, ...forward];
      if (line.length >= 5) return line;
    }
    return null;
  }

  function hasWon(board, r, c, player) {
    return Boolean(findWinningLine(board, r, c, player));
  }

  function isBoardFull(board) {
    return board.every(row => row.every(cell => cell !== 0));
  }

  G.Rules = Object.freeze({ isInside, collectDirection, countDirection, findWinningLine, hasWon, isBoardFull });
})(window.Gomoku = window.Gomoku || {});
