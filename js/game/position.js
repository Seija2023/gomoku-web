(function (G) {
  const { SIZE, BLACK, WHITE } = G.Config;

  function emptyBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function cloneMoves(moves = []) {
    return moves.map(move => ({ r: move.r, c: move.c, player: move.player }));
  }

  function keyFromMoves(moves = [], nextPlayer = null) {
    const body = moves.map(move => `${move.r.toString(16)}${move.c.toString(16)}${move.player}`).join('');
    return `${body}:${nextPlayer || 0}`;
  }

  function nextPlayerFor(moves = []) {
    return moves.length % 2 === 0 ? BLACK : WHITE;
  }

  function validateMoves(moves, options = {}) {
    if (!Array.isArray(moves)) return { ok: false, reason: 'moves-not-array' };
    const { allowTerminalTail = false } = options;
    const board = emptyBoard();
    let expected = BLACK;
    let terminalAt = -1;

    for (let i = 0; i < moves.length; i += 1) {
      const move = moves[i];
      if (!move || !Number.isInteger(move.r) || !Number.isInteger(move.c)) {
        return { ok: false, reason: 'invalid-coordinate', index: i };
      }
      if (move.r < 0 || move.c < 0 || move.r >= SIZE || move.c >= SIZE) {
        return { ok: false, reason: 'out-of-range', index: i };
      }
      if (move.player !== expected) {
        return { ok: false, reason: 'turn-order', index: i };
      }
      if (board[move.r][move.c] !== 0) {
        return { ok: false, reason: 'occupied', index: i };
      }
      if (terminalAt >= 0 && !allowTerminalTail) {
        return { ok: false, reason: 'moves-after-terminal', index: i };
      }

      board[move.r][move.c] = move.player;
      if (G.Rules.findWinningLine(board, move.r, move.c, move.player)) terminalAt = i;
      expected = expected === BLACK ? WHITE : BLACK;
    }

    return { ok: true, board, nextPlayer: expected, terminalAt };
  }

  function fromMoves(moves = [], options = {}) {
    const validation = validateMoves(moves, options);
    if (!validation.ok) return null;
    const cloned = cloneMoves(moves);
    return Object.freeze({
      board: validation.board,
      moves: cloned,
      currentPlayer: validation.nextPlayer,
      key: keyFromMoves(cloned, validation.nextPlayer),
      terminalAt: validation.terminalAt,
    });
  }

  function fromGame(game) {
    if (!game) return null;
    return Object.freeze({
      board: game.board,
      moves: game.moves,
      currentPlayer: game.currentPlayer,
      gameOver: Boolean(game.gameOver),
      winner: game.winner || 0,
      winningLine: game.winningLine || null,
      key: keyFromMoves(game.moves, game.currentPlayer),
    });
  }

  G.Position = Object.freeze({
    emptyBoard,
    cloneMoves,
    keyFromMoves,
    nextPlayerFor,
    validateMoves,
    fromMoves,
    fromGame,
  });
})(window.Gomoku = window.Gomoku || {});
