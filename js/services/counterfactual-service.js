(function (G) {
  const { BLACK, WHITE } = G.Config;

  function opponentOf(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function scoreCandidate(board, move, player, persona) {
    const opponent = opponentOf(player);
    const attack = G.AI.evaluateMove(board, move.r, move.c, player);
    const defense = G.AI.evaluateMove(board, move.r, move.c, opponent);
    const weights = G.AI.personaWeights(persona);
    const center = Math.floor(board.length / 2);
    const centerDistance = Math.abs(move.r - center) + Math.abs(move.c - center);
    const centerBonus = Math.max(0, board.length - 1 - centerDistance) * weights.center;

    return {
      r: move.r,
      c: move.c,
      attack,
      defense,
      attackLevel: G.AI.grade(attack),
      defenseLevel: G.AI.grade(defense),
      centerBonus,
      score: attack * weights.attack + defense * weights.defense + centerBonus,
      blocksImmediateWin: G.AI.isWinningMove(board, move.r, move.c, opponent),
      winsImmediately: G.AI.isWinningMove(board, move.r, move.c, player),
    };
  }

  class CounterfactualService {
    constructor(analysisService) {
      this.analysis = analysisService;
    }

    branch(board, moves, move, player, persona, searchOptions = {}) {
      if (!G.Rules.isInside(board, move.r, move.c) || board[move.r][move.c] !== 0) return null;

      const base = scoreCandidate(board, move, player, persona);
      const child = G.Position.cloneBoard(board);
      child[move.r][move.c] = player;
      const nextMoves = [...G.Position.cloneMoves(moves || []), { r: move.r, c: move.c, player }];
      const winningLine = G.Rules.findWinningLine(child, move.r, move.c, player);

      if (winningLine) {
        return {
          ...base,
          score: Math.round(base.score),
          adjustedScore: Math.round(base.score),
          reply: null,
          replyScore: 0,
          followUp: null,
          followUpScore: 0,
          line: [{ r: move.r, c: move.c, player, role: 'self' }],
          outcome: 'win',
        };
      }

      const opponent = opponentOf(player);
      const replies = this.analysis.ranked(child, nextMoves, opponent, persona);
      const reply = replies[0] || null;
      let followUp = null;

      if (reply && child[reply.r][reply.c] === 0) {
        child[reply.r][reply.c] = opponent;
        const futureMoves = [...nextMoves, { r: reply.r, c: reply.c, player: opponent }];
        followUp = this.analysis.ranked(child, futureMoves, player, persona)[0] || null;
      }

      const replyScore = reply ? reply.score : 0;
      const followUpScore = followUp ? followUp.score : 0;
      const adjustedScore = base.score - replyScore * 0.82 + followUpScore * 0.16;
      const line = [{ r: move.r, c: move.c, player, role: 'self' }];
      if (reply) line.push({ r: reply.r, c: reply.c, player: opponent, role: 'reply' });
      if (followUp) line.push({ r: followUp.r, c: followUp.c, player, role: 'follow' });

      const deep = G.AISearch?.analyzeMove?.(
        G.Position.cloneBoard(board),
        moves,
        move,
        player,
        persona,
        searchOptions,
      );
      const deepLine = deep?.line?.length
        ? deep.line.map((item, index) => ({
            ...item,
            role: index === 0 ? 'self' : (item.player === player ? 'follow' : 'reply'),
          }))
        : line;

      return {
        ...base,
        score: Math.round(base.score),
        adjustedScore: Math.round(deep?.score ?? adjustedScore),
        reply: deepLine[1]
          ? { r: deepLine[1].r, c: deepLine[1].c, score: Math.round(replyScore) }
          : (reply ? { r: reply.r, c: reply.c, score: Math.round(reply.score) } : null),
        replyScore: Math.round(replyScore),
        followUp: deepLine[2]
          ? { r: deepLine[2].r, c: deepLine[2].c, score: Math.round(followUpScore) }
          : (followUp ? { r: followUp.r, c: followUp.c, score: Math.round(followUp.score) } : null),
        followUpScore: Math.round(followUpScore),
        line: deepLine,
        search: deep?.search || null,
        outcome: 'open',
      };
    }

    explain(userLine, recommendedLine) {
      if (!userLine || !recommendedLine) return [];
      if (userLine.r === recommendedLine.r && userLine.c === recommendedLine.c) {
        return ['你的选择与当前 AI 推荐手一致。'];
      }

      const reasons = [];
      if (recommendedLine.winsImmediately && !userLine.winsImmediately) {
        reasons.push('推荐手可以立即完成五连，而当前选择错过了直接取胜机会。');
      }
      if (recommendedLine.blocksImmediateWin && !userLine.blocksImmediateWin) {
        reasons.push('推荐手能封住对手下一手的直接五连，当前选择没有处理这个强制威胁。');
      }

      const attackGap = recommendedLine.attack - userLine.attack;
      const defenseGap = recommendedLine.defense - userLine.defense;
      const replyGap = userLine.replyScore - recommendedLine.replyScore;
      const followGap = recommendedLine.followUpScore - userLine.followUpScore;

      if (attackGap > Math.max(1000, Math.abs(userLine.attack) * 0.35)) {
        reasons.push('推荐手形成的即时进攻棋形更强。');
      }
      if (defenseGap > Math.max(1000, Math.abs(userLine.defense) * 0.35)) {
        reasons.push('推荐手同时承担了更高价值的防守或限制作用。');
      }
      if (replyGap > Math.max(1000, Math.abs(recommendedLine.replyScore) * 0.25)) {
        reasons.push('当前选择给了对手更强的最佳回应。');
      }
      if (followGap > Math.max(1000, Math.abs(userLine.followUpScore) * 0.35)) {
        reasons.push('推荐手在对手回应后保留了更强的后续进攻。');
      }

      const delta = recommendedLine.adjustedScore - userLine.adjustedScore;
      if (!reasons.length) {
        reasons.push(delta > 0
          ? '两手没有明显强制战术差异，但推荐手的综合棋形与后续变化评分更高。'
          : '两手当前评估非常接近，差异主要来自启发式棋形评分。');
      }
      return reasons.slice(0, 3);
    }

    compare({ board, moves = [], player, persona, userMove, searchOptions = {} }) {
      if (!board || ![BLACK, WHITE].includes(player) || !userMove) return null;
      const inspection = G.Position.inspectBoard(board);
      if (!inspection.ok || inspection.terminal) return null;
      if (!G.Rules.isInside(board, userMove.r, userMove.c) || board[userMove.r][userMove.c] !== 0) return null;

      const totalBudget = searchOptions.timeBudgetMs || Math.min(420, G.Config.AI_BUDGET_MS.analysis);
      const maxDepth = searchOptions.maxDepth || G.Config.AI_MAX_DEPTH.analysis;
      const recommendation = this.analysis.chooseMove(
        board,
        moves,
        G.Config.AI_DIFFICULTIES.HARD,
        player,
        persona,
        Math.random,
        {
          ...searchOptions,
          analysis: true,
          timeBudgetMs: Math.max(100, Math.round(totalBudget * 0.38)),
          maxDepth,
        },
      );
      const recommendedMove = recommendation?.move;
      if (!recommendedMove) return null;

      const branchOptions = {
        ...searchOptions,
        timeBudgetMs: Math.max(80, Math.round(totalBudget * 0.28)),
        maxDepth: Math.max(3, maxDepth - 1),
      };
      const userLine = this.branch(board, moves, userMove, player, persona, branchOptions);
      const recommendedLine = this.branch(board, moves, recommendedMove, player, persona, branchOptions);
      if (!userLine || !recommendedLine) return null;

      const scoreDelta = recommendedLine.adjustedScore - userLine.adjustedScore;
      return {
        player,
        userLine,
        recommendedLine,
        scoreDelta,
        reasons: this.explain(userLine, recommendedLine),
        sameMove: userLine.r === recommendedLine.r && userLine.c === recommendedLine.c,
        search: {
          recommendation: recommendation.search || null,
          user: userLine.search || null,
          recommended: recommendedLine.search || null,
        },
      };
    }
  }

  G.Services = G.Services || {};
  G.Services.CounterfactualService = CounterfactualService;
})(window.Gomoku = window.Gomoku || {});
