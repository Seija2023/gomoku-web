(function (G) {
  const { opponentOf, rankMoves } = G.AI;

  function cloneMoves(moves) {
    return moves.map(move => ({ ...move }));
  }

  function chooseHardMove(board, moves, player, ranked = rankMoves(board, moves, player)) {
    const opponent = opponentOf(player);
    const shortlist = ranked.slice(0, Math.min(12, ranked.length));
    let best = null;

    for (const candidate of shortlist) {
      board[candidate.r][candidate.c] = player;
      const nextMoves = [...cloneMoves(moves), { r: candidate.r, c: candidate.c, player }];

      try {
        const replies = rankMoves(board, nextMoves, opponent).slice(0, 8);
        const bestReply = replies[0] || null;
        let replyPressure = bestReply ? bestReply.score : 0;
        let followUp = 0;

        if (bestReply && board[bestReply.r][bestReply.c] === 0) {
          board[bestReply.r][bestReply.c] = opponent;
          try {
            const futureMoves = [...nextMoves, { r: bestReply.r, c: bestReply.c, player: opponent }];
            const nextAttack = rankMoves(board, futureMoves, player)[0];
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

  G.AISearch = Object.freeze({ chooseHardMove });
})(window.Gomoku = window.Gomoku || {});
