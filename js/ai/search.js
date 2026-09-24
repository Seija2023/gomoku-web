(function (G) {
  const { AI_PERSONAS } = G.Config;
  const { opponentOf, rankMoves } = G.AI;

  function cloneMoves(moves) {
    return moves.map(move => ({ ...move }));
  }

  function chooseHardMove(
    board,
    moves,
    player,
    ranked = rankMoves(board, moves, player),
    persona = AI_PERSONAS.BALANCED
  ) {
    const opponent = opponentOf(player);
    const shortlist = ranked.slice(0, Math.min(12, ranked.length));
    let best = null;

    for (const candidate of shortlist) {
      board[candidate.r][candidate.c] = player;
      const nextMoves = [...cloneMoves(moves), { r: candidate.r, c: candidate.c, player }];

      try {
        const replies = rankMoves(board, nextMoves, opponent, persona).slice(0, 8);
        const bestReply = replies[0] || null;
        const replyPressure = bestReply ? bestReply.score : 0;
        let followUp = 0;

        if (bestReply && board[bestReply.r][bestReply.c] === 0) {
          board[bestReply.r][bestReply.c] = opponent;
          try {
            const futureMoves = [...nextMoves, { r: bestReply.r, c: bestReply.c, player: opponent }];
            const nextAttack = rankMoves(board, futureMoves, player, persona)[0];
            followUp = nextAttack ? nextAttack.score : 0;
          } finally {
            board[bestReply.r][bestReply.c] = 0;
          }
        }

        const lookaheadScore = candidate.score - replyPressure * 0.82 + followUp * 0.16;
        const enriched = {
          ...candidate,
          hardScore: lookaheadScore,
          lookahead: bestReply
            ? `预估对手最强回应后仍保留 ${Math.max(0, Math.round(followUp))} 的后续进攻价值`
            : '未发现明显强制回应',
        };

        if (!best || enriched.hardScore > best.hardScore) best = enriched;
      } finally {
        board[candidate.r][candidate.c] = 0;
      }
    }

    return best || ranked[0] || null;
  }

  function previewLine(board, moves, r, c, player, persona = AI_PERSONAS.BALANCED) {
    if (!board?.[r] || board[r][c] !== 0) return null;

    const opponent = opponentOf(player);
    const line = [{ r, c, player, role: 'self' }];
    board[r][c] = player;
    const nextMoves = [...cloneMoves(moves), { r, c, player }];

    try {
      if (G.AI.isWinningMove && G.Rules.hasWon(board, r, c, player)) {
        return { line, reply: null, followUp: null };
      }

      const reply = rankMoves(board, nextMoves, opponent, persona)[0] || null;
      if (!reply) return { line, reply: null, followUp: null };

      line.push({ r: reply.r, c: reply.c, player: opponent, role: 'reply' });
      board[reply.r][reply.c] = opponent;

      try {
        const futureMoves = [...nextMoves, { r: reply.r, c: reply.c, player: opponent }];
        const followUp = rankMoves(board, futureMoves, player, persona)[0] || null;
        if (followUp) line.push({ r: followUp.r, c: followUp.c, player, role: 'follow' });
        return {
          line,
          reply: reply ? { r: reply.r, c: reply.c, score: Math.round(reply.score) } : null,
          followUp: followUp ? { r: followUp.r, c: followUp.c, score: Math.round(followUp.score) } : null,
        };
      } finally {
        board[reply.r][reply.c] = 0;
      }
    } finally {
      board[r][c] = 0;
    }
  }

  function enrichCandidates(board, moves, player, candidates, persona = AI_PERSONAS.BALANCED) {
    return candidates.map(candidate => {
      const preview = previewLine(board, moves, candidate.r, candidate.c, player, persona);
      return {
        ...candidate,
        reply: preview?.reply || null,
        followUp: preview?.followUp || null,
        line: preview?.line || [],
      };
    });
  }

  G.AISearch = Object.freeze({ chooseHardMove, previewLine, enrichCandidates });
})(window.Gomoku = window.Gomoku || {});
