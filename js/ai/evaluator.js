(function (G) {
  const { BLACK, WHITE, DIRECTIONS, AI_DIFFICULTIES } = G.Config;
  const { isInside, hasWon } = G.Rules;

  function opponentOf(player) {
    return player === BLACK ? WHITE : BLACK;
  }

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

  function grade(score) {
    if (score >= 900_000) return '极高';
    if (score >= 32_000) return '很高';
    if (score >= 4_000) return '较高';
    if (score >= 1_100) return '中等';
    return '一般';
  }

  function explainCandidate(board, move, player, attack, defense) {
    const opponent = opponentOf(player);
    let reason = '兼顾进攻与防守，并优先选择更有连接潜力的位置';
    if (isWinningMove(board, move.r, move.c, player)) reason = '完成自己的五连，直接结束对局';
    else if (isWinningMove(board, move.r, move.c, opponent)) reason = '阻止对手下一手直接完成五连';
    else if (attack >= 900_000) reason = '形成活四，制造非常强的连续进攻';
    else if (attack >= 120_000) reason = '形成四连威胁，迫使对手优先处理';
    else if (defense >= 900_000) reason = '压制对手即将形成的活四威胁';
    else if (defense >= 120_000) reason = '优先封堵对手的四连进攻点';
    else if (attack >= 32_000) reason = '形成活三，继续扩大进攻空间';
    else if (defense >= 32_000) reason = '限制对手形成活三并兼顾己方发展';

    return {
      reason,
      attackLevel: grade(attack),
      defenseLevel: grade(defense),
    };
  }

  function rankMoves(board, moves, player = WHITE) {
    const opponent = opponentOf(player);
    const center = Math.floor(board.length / 2);
    return getCandidateMoves(board, moves).map(move => {
      const attack = evaluateMove(board, move.r, move.c, player);
      const defense = evaluateMove(board, move.r, move.c, opponent);
      const centerDistance = Math.abs(move.r - center) + Math.abs(move.c - center);
      const centerBonus = Math.max(0, board.length - 1 - centerDistance) * 3;
      const score = attack + defense * 1.12 + centerBonus;
      const explanation = explainCandidate(board, move, player, attack, defense);
      return { ...move, attack, defense, centerBonus, score, ...explanation };
    }).sort((a, b) => b.score - a.score);
  }

  function chooseFromPool(pool, rng) {
    if (!pool.length) return null;
    const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
    return pool[index];
  }

  function chooseMoveDetailed(board, moves, difficulty = AI_DIFFICULTIES.NORMAL, player = WHITE, rng = Math.random) {
    const ranked = rankMoves(board, moves, player);
    if (!ranked.length) return { move: null, candidates: [], explanation: null };

    const opponent = opponentOf(player);
    const winning = ranked.find(item => isWinningMove(board, item.r, item.c, player));
    const mustBlock = ranked.find(item => isWinningMove(board, item.r, item.c, opponent));

    let selected;
    if (winning) selected = winning;
    else if (mustBlock) selected = mustBlock;
    else if (difficulty === AI_DIFFICULTIES.EASY) selected = chooseFromPool(ranked.slice(0, Math.min(6, ranked.length)), rng);
    else if (difficulty === AI_DIFFICULTIES.HARD && G.AISearch?.chooseHardMove) selected = G.AISearch.chooseHardMove(board, moves, player, ranked) || ranked[0];
    else {
      const best = ranked[0].score;
      selected = chooseFromPool(ranked.filter(item => item.score === best), rng) || ranked[0];
    }

    const move = selected ? { r: selected.r, c: selected.c } : null;
    const candidates = ranked.slice(0, 3).map(item => ({
      r: item.r,
      c: item.c,
      score: Math.round(item.score),
      reason: item.reason,
    }));

    return {
      move,
      candidates,
      explanation: selected ? {
        reason: selected.reason,
        attackLevel: selected.attackLevel,
        defenseLevel: selected.defenseLevel,
        score: Math.round(selected.score),
        lookahead: selected.lookahead || null,
      } : null,
    };
  }

  function chooseMove(board, moves, rng = Math.random) {
    return chooseMoveDetailed(board, moves, AI_DIFFICULTIES.NORMAL, WHITE, rng).move;
  }

  G.AI = Object.freeze({
    opponentOf,
    chooseMove,
    chooseMoveDetailed,
    rankMoves,
    getCandidateMoves,
    isWinningMove,
    evaluateMove,
    patternScore,
    grade,
  });
})(window.Gomoku = window.Gomoku || {});
