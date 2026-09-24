(function (G) {
  const { BLACK, WHITE, DIRECTIONS } = G.Config;
  const { isInside, hasWon } = G.Rules;

  function countLine(board, r, c, dr, dc, player) {
    let count = 0;
    let nr = r + dr;
    let nc = c + dc;

    while (isInside(board, nr, nc) && board[nr][nc] === player) {
      count += 1;
      nr += dr;
      nc += dc;
    }

    return {
      count,
      open: isInside(board, nr, nc) && board[nr][nc] === 0,
    };
  }

  function patternScore(length, openEnds) {
    if (length >= 5) return 10_000_000;
    if (length === 4 && openEnds === 2) return 900_000;
    if (length === 4 && openEnds === 1) return 120_000;
    if (length === 3 && openEnds === 2) return 32_000;
    if (length === 3 && openEnds === 1) return 4_000;
    if (length === 2 && openEnds === 2) return 1_100;
    if (length === 2 && openEnds === 1) return 180;
    if (length === 1 && openEnds === 2) return 30;
    return 5;
  }

  function evaluateMove(board, r, c, player) {
    if (!isInside(board, r, c) || board[r][c] !== 0) return -Infinity;
    board[r][c] = player;
    let score = 0;

    try {
      for (const [dr, dc] of DIRECTIONS) {
        const forward = countLine(board, r, c, dr, dc, player);
        const backward = countLine(board, r, c, -dr, -dc, player);
        const length = 1 + forward.count + backward.count;
        const openEnds = Number(forward.open) + Number(backward.open);
        score += patternScore(length, openEnds);
      }
      return score;
    } finally {
      board[r][c] = 0;
    }
  }

  function isWinningMove(board, r, c, player) {
    if (!isInside(board, r, c) || board[r][c] !== 0) return false;
    board[r][c] = player;
    try {
      return hasWon(board, r, c, player);
    } finally {
      board[r][c] = 0;
    }
  }

  function getCandidateMoves(board, moves, radius = 2) {
    const size = board.length;
    if (moves.length === 0) {
      const center = Math.floor(size / 2);
      return [{ r: center, c: center }];
    }

    const set = new Set();
    for (const move of moves) {
      for (let dr = -radius; dr <= radius; dr += 1) {
        for (let dc = -radius; dc <= radius; dc += 1) {
          const r = move.r + dr;
          const c = move.c + dc;
          if (isInside(board, r, c) && board[r][c] === 0) set.add(`${r},${c}`);
        }
      }
    }

    return [...set].map(key => {
      const [r, c] = key.split(',').map(Number);
      return { r, c };
    });
  }

  function chooseMove(board, moves, rng = Math.random) {
    const candidates = getCandidateMoves(board, moves);
    if (candidates.length === 0) return null;

    const winning = candidates.find(({ r, c }) => isWinningMove(board, r, c, WHITE));
    if (winning) return winning;

    const mustBlock = candidates.find(({ r, c }) => isWinningMove(board, r, c, BLACK));
    if (mustBlock) return mustBlock;

    const center = Math.floor(board.length / 2);
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const move of candidates) {
      const attack = evaluateMove(board, move.r, move.c, WHITE);
      const defense = evaluateMove(board, move.r, move.c, BLACK);
      const centerDistance = Math.abs(move.r - center) + Math.abs(move.c - center);
      const centerBonus = Math.max(0, board.length - 1 - centerDistance) * 3;
      const score = attack + defense * 1.12 + centerBonus;

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [move];
      } else if (score === bestScore) {
        bestMoves.push(move);
      }
    }

    const index = Math.min(bestMoves.length - 1, Math.floor(rng() * bestMoves.length));
    return bestMoves[index] || candidates[0] || null;
  }

  G.AI = Object.freeze({ chooseMove, getCandidateMoves, isWinningMove, evaluateMove, patternScore });
})(window.Gomoku = window.Gomoku || {});
