(function (G) {
  const { SIZE, BLACK, WHITE } = G.Config;

  function emptyBoard() {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  }

  function cloneMoves(moves = []) {
    return moves.map(move => ({ r: move.r, c: move.c, player: move.player }));
  }

  function cloneBoard(board = emptyBoard()) {
    return board.map(row => row.slice());
  }

  function countStones(board, player = null) {
    if (!Array.isArray(board)) return 0;
    let count = 0;
    for (const row of board) {
      if (!Array.isArray(row)) continue;
      for (const value of row) {
        if (player == null ? value === BLACK || value === WHITE : value === player) count += 1;
      }
    }
    return count;
  }

  function boardKey(board, nextPlayer = null) {
    const body = (board || []).map(row => (row || []).join('')).join('');
    return `${body}:${nextPlayer || 0}`;
  }

  function validateBoard(board) {
    if (!Array.isArray(board) || board.length !== SIZE) return { ok: false, reason: 'invalid-board-size' };
    for (let r = 0; r < SIZE; r += 1) {
      if (!Array.isArray(board[r]) || board[r].length !== SIZE) {
        return { ok: false, reason: 'invalid-board-row', index: r };
      }
      for (let c = 0; c < SIZE; c += 1) {
        if (![0, BLACK, WHITE].includes(board[r][c])) {
          return { ok: false, reason: 'invalid-board-value', r, c };
        }
      }
    }
    return { ok: true };
  }

  function inspectBoard(board) {
    const validation = validateBoard(board);
    if (!validation.ok) return { ...validation, terminal: false, winner: 0, winningLine: null, full: false };

    const winners = new Set();
    let winningLine = null;
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        const player = board[r][c];
        if (!player) continue;
        const line = G.Rules.findWinningLine(board, r, c, player);
        if (line) {
          winners.add(player);
          if (!winningLine) winningLine = line;
        }
      }
    }

    const full = countStones(board) === SIZE * SIZE;
    const winner = winners.size === 1 ? [...winners][0] : 0;
    return {
      ok: true,
      terminal: winners.size > 0 || full,
      winner,
      winners: [...winners],
      winningLine,
      full,
    };
  }

  function fromBoard(board, currentPlayer = BLACK) {
    const validation = validateBoard(board);
    if (!validation.ok || ![BLACK, WHITE].includes(currentPlayer)) return null;
    const cloned = cloneBoard(board);
    const inspection = inspectBoard(cloned);
    return Object.freeze({
      board: cloned,
      moves: [],
      currentPlayer,
      gameOver: inspection.terminal,
      winner: inspection.winner,
      winningLine: inspection.winningLine,
      key: boardKey(cloned, currentPlayer),
      source: 'custom',
    });
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
    cloneBoard,
    countStones,
    boardKey,
    validateBoard,
    inspectBoard,
    fromBoard,
    keyFromMoves,
    nextPlayerFor,
    validateMoves,
    fromMoves,
    fromGame,
  });
})(window.Gomoku = window.Gomoku || {});
