(function (G) {
  const { AI_PERSONAS, AI_DIFFICULTIES } = G.Config;
  const { opponentOf, rankMoves, isWinningMove } = G.AI;

  const WIN_SCORE = 1_000_000_000;
  const FORCE_THRESHOLD = 120_000;

  function now() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  function cloneMoves(moves = []) {
    return moves.map(move => ({ ...move }));
  }

  function budgetFor(difficulty, analysis = false) {
    if (analysis) return G.Config.AI_BUDGET_MS.analysis;
    return G.Config.AI_BUDGET_MS[difficulty] || G.Config.AI_BUDGET_MS.normal;
  }

  function depthFor(difficulty, analysis = false) {
    if (analysis) return G.Config.AI_MAX_DEPTH.analysis;
    return G.Config.AI_MAX_DEPTH[difficulty] || G.Config.AI_MAX_DEPTH.normal;
  }

  function candidateLimitFor(difficulty, analysis = false) {
    if (analysis) return G.Config.AI_CANDIDATE_LIMIT.analysis;
    return G.Config.AI_CANDIDATE_LIMIT[difficulty] || G.Config.AI_CANDIDATE_LIMIT.normal;
  }

  function boardKey(board, player) {
    if (G.Position?.boardKey) return G.Position.boardKey(board, player);
    return `${board.map(row => row.join('')).join('')}:${player}`;
  }

  function tacticalCandidates(board, ranked, player) {
    const opponent = opponentOf(player);
    const wins = ranked.filter(item => isWinningMove(board, item.r, item.c, player));
    if (wins.length) return { moves: wins, forced: true, kind: 'win' };

    const blocks = ranked.filter(item => isWinningMove(board, item.r, item.c, opponent));
    if (blocks.length) return { moves: blocks, forced: true, kind: 'block' };

    const forcing = ranked.filter(item =>
      item.attack >= FORCE_THRESHOLD || item.defense >= FORCE_THRESHOLD
    );
    if (forcing.length) return { moves: forcing, forced: true, kind: 'forcing' };

    return { moves: ranked, forced: false, kind: 'normal' };
  }

  function orderedMoves(board, moves, player, persona, limit) {
    const ranked = rankMoves(board, moves, player, persona);
    const tactical = tacticalCandidates(board, ranked, player);
    return {
      forced: tactical.forced,
      kind: tactical.kind,
      moves: tactical.moves.slice(0, Math.max(1, limit)),
    };
  }

  function evaluatePerspective(board, moves, rootPlayer, persona) {
    const opponent = opponentOf(rootPlayer);
    const own = rankMoves(board, moves, rootPlayer, persona)[0]?.score || 0;
    const theirs = rankMoves(board, moves, opponent, persona)[0]?.score || 0;
    return own - theirs * 1.04;
  }

  function shouldStop(ctx) {
    return ctx.cancelled?.() || now() >= ctx.deadline;
  }

  function terminalScore(board, lastMove, rootPlayer, depth) {
    if (!lastMove) return null;
    if (!G.Rules.hasWon(board, lastMove.r, lastMove.c, lastMove.player)) return null;
    return lastMove.player === rootPlayer
      ? WIN_SCORE + depth
      : -WIN_SCORE - depth;
  }

  function minimax(board, moves, toMove, rootPlayer, depth, alpha, beta, persona, ctx, lastMove = null) {
    ctx.nodes += 1;
    if ((ctx.nodes & 63) === 0 && shouldStop(ctx)) return { aborted: true };

    const terminal = terminalScore(board, lastMove, rootPlayer, depth);
    if (terminal != null) return { score: terminal, line: [] };
    if (depth <= 0) {
      return { score: evaluatePerspective(board, moves, rootPlayer, persona), line: [] };
    }

    const key = `${boardKey(board, toMove)}|${rootPlayer}|${persona}`;
    const cached = ctx.table.get(key);
    if (cached && cached.depth >= depth) {
      ctx.cacheHits += 1;
      return { score: cached.score, line: cached.line.map(move => ({ ...move })) };
    }

    const generated = orderedMoves(board, moves, toMove, persona, ctx.candidateLimit);
    if (!generated.moves.length) return { score: 0, line: [] };
    if (generated.forced) ctx.tacticalNodes += 1;

    const maximizing = toMove === rootPlayer;
    let bestScore = maximizing ? -Infinity : Infinity;
    let bestLine = [];

    for (const candidate of generated.moves) {
      if (shouldStop(ctx)) return { aborted: true };

      board[candidate.r][candidate.c] = toMove;
      const move = { r: candidate.r, c: candidate.c, player: toMove };
      const nextMoves = [...moves, move];
      let child;
      try {
        child = minimax(
          board,
          nextMoves,
          opponentOf(toMove),
          rootPlayer,
          depth - 1,
          alpha,
          beta,
          persona,
          ctx,
          move,
        );
      } finally {
        board[candidate.r][candidate.c] = 0;
      }
      if (child.aborted) return child;

      if (maximizing) {
        if (child.score > bestScore) {
          bestScore = child.score;
          bestLine = [move, ...(child.line || [])];
        }
        alpha = Math.max(alpha, bestScore);
      } else {
        if (child.score < bestScore) {
          bestScore = child.score;
          bestLine = [move, ...(child.line || [])];
        }
        beta = Math.min(beta, bestScore);
      }
      if (beta <= alpha) {
        ctx.cutoffs += 1;
        break;
      }
    }

    const entry = { depth, score: bestScore, line: bestLine.map(move => ({ ...move })) };
    ctx.table.set(key, entry);
    return { score: bestScore, line: bestLine };
  }

  function createContext(options = {}) {
    const started = now();
    return {
      started,
      deadline: started + Math.max(10, options.timeBudgetMs || 300),
      candidateLimit: Math.max(3, options.candidateLimit || 8),
      cancelled: options.cancelled || null,
      onProgress: options.onProgress || null,
      table: options.table || new Map(),
      nodes: 0,
      tacticalNodes: 0,
      cacheHits: 0,
      cutoffs: 0,
    };
  }

  function rootSearch(board, moves, player, persona, depth, ctx) {
    const generated = orderedMoves(board, moves, player, persona, ctx.candidateLimit);
    if (!generated.moves.length) return { move: null, score: 0, line: [] };
    if (generated.forced) ctx.tacticalNodes += 1;

    let best = null;
    let alpha = -Infinity;
    const beta = Infinity;

    for (const candidate of generated.moves) {
      if (shouldStop(ctx)) return { aborted: true };

      const move = { r: candidate.r, c: candidate.c, player };
      board[candidate.r][candidate.c] = player;
      let child;
      try {
        child = minimax(
          board,
          [...moves, move],
          opponentOf(player),
          player,
          Math.max(0, depth - 1),
          alpha,
          beta,
          persona,
          ctx,
          move,
        );
      } finally {
        board[candidate.r][candidate.c] = 0;
      }
      if (child.aborted) return child;

      if (!best || child.score > best.score) {
        best = {
          move: { r: candidate.r, c: candidate.c },
          score: child.score,
          line: [move, ...(child.line || [])],
          candidate,
        };
      }
      alpha = Math.max(alpha, best.score);
    }

    return best || { move: null, score: 0, line: [] };
  }

  function iterativeSearch(board, moves, player, persona = AI_PERSONAS.BALANCED, options = {}) {
    const difficulty = options.difficulty || AI_DIFFICULTIES.NORMAL;
    const maxDepth = options.maxDepth || depthFor(difficulty, options.analysis);
    const ctx = createContext({
      ...options,
      timeBudgetMs: options.timeBudgetMs || budgetFor(difficulty, options.analysis),
      candidateLimit: options.candidateLimit || candidateLimitFor(difficulty, options.analysis),
    });

    let completedDepth = 0;
    let best = null;
    let timedOut = false;

    for (let depth = 1; depth <= maxDepth; depth += 1) {
      if (shouldStop(ctx)) {
        timedOut = true;
        break;
      }

      const result = rootSearch(board, moves, player, persona, depth, ctx);
      if (result.aborted) {
        timedOut = true;
        break;
      }
      if (result?.move) {
        best = result;
        completedDepth = depth;
        ctx.onProgress?.({
          depth,
          nodes: ctx.nodes,
          elapsedMs: Math.round(now() - ctx.started),
          bestMove: { ...result.move },
          score: Math.round(result.score),
          cacheHits: ctx.cacheHits,
          tacticalNodes: ctx.tacticalNodes,
        });
      }

      if (Math.abs(result?.score || 0) >= WIN_SCORE) break;
    }

    const elapsedMs = Math.round(now() - ctx.started);
    return {
      ...best,
      depth: completedDepth,
      nodes: ctx.nodes,
      elapsedMs,
      cacheHits: ctx.cacheHits,
      tacticalNodes: ctx.tacticalNodes,
      cutoffs: ctx.cutoffs,
      tableEntries: ctx.table.size,
      timedOut,
    };
  }

  function chooseMoveAdvanced(
    board,
    moves,
    difficulty = AI_DIFFICULTIES.NORMAL,
    player,
    persona = AI_PERSONAS.BALANCED,
    options = {},
  ) {
    const ranked = rankMoves(board, moves, player, persona);
    if (!ranked.length) {
      return {
        move: null,
        candidates: [],
        explanation: null,
        search: { depth: 0, nodes: 0, elapsedMs: 0, cacheHits: 0, tacticalNodes: 0 },
      };
    }

    const opponent = opponentOf(player);
    const winning = ranked.find(item => isWinningMove(board, item.r, item.c, player));
    const mustBlock = ranked.find(item => isWinningMove(board, item.r, item.c, opponent));

    let selected = winning || mustBlock || null;
    let search = null;

    if (!selected) {
      search = iterativeSearch(board, moves, player, persona, {
        difficulty,
        ...options,
      });
      if (search.move) {
        selected = ranked.find(item => item.r === search.move.r && item.c === search.move.c) || ranked[0];
      }
    }

    selected ||= ranked[0];
    const candidates = ranked.slice(0, 3).map(item => ({
      r: item.r,
      c: item.c,
      score: Math.round(item.score),
      attackLevel: item.attackLevel,
      defenseLevel: item.defenseLevel,
      reason: item.reason,
    }));

    const move = { r: selected.r, c: selected.c };
    const fallbackSearch = search || {
      move,
      score: selected.score,
      line: [{ r: move.r, c: move.c, player }],
      depth: 1,
      nodes: 1,
      elapsedMs: 0,
      cacheHits: 0,
      tacticalNodes: winning || mustBlock ? 1 : 0,
      cutoffs: 0,
      tableEntries: 0,
      timedOut: false,
    };

    const pv = (fallbackSearch.line || []).slice(0, 7).map(item => ({ ...item }));
    return {
      move,
      candidates,
      principalVariation: pv,
      explanation: {
        reason: selected.reason,
        attackLevel: selected.attackLevel,
        defenseLevel: selected.defenseLevel,
        score: Math.round(selected.score),
        lookahead: pv.length > 1
          ? `主变化预计延伸 ${pv.length} 手，搜索深度 ${fallbackSearch.depth}`
          : selected.lookahead || null,
        personaLabel: selected.personaLabel,
      },
      search: {
        depth: fallbackSearch.depth,
        nodes: fallbackSearch.nodes,
        elapsedMs: fallbackSearch.elapsedMs,
        cacheHits: fallbackSearch.cacheHits,
        tacticalNodes: fallbackSearch.tacticalNodes,
        cutoffs: fallbackSearch.cutoffs,
        tableEntries: fallbackSearch.tableEntries,
        timedOut: fallbackSearch.timedOut,
      },
    };
  }

  function analyzeMove(board, moves, move, player, persona = AI_PERSONAS.BALANCED, options = {}) {
    if (!board?.[move.r] || board[move.r][move.c] !== 0) return null;

    const ranked = rankMoves(board, moves, player, persona);
    const candidate = ranked.find(item => item.r === move.r && item.c === move.c);
    if (!candidate) return null;

    const placed = { r: move.r, c: move.c, player };
    board[move.r][move.c] = player;
    const nextMoves = [...cloneMoves(moves), placed];

    try {
      if (G.Rules.hasWon(board, move.r, move.c, player)) {
        return {
          candidate,
          score: WIN_SCORE,
          line: [placed],
          search: { depth: 1, nodes: 1, elapsedMs: 0, cacheHits: 0, tacticalNodes: 1 },
        };
      }

      const ctx = createContext({
        timeBudgetMs: options.timeBudgetMs || 240,
        candidateLimit: options.candidateLimit || 9,
        cancelled: options.cancelled,
      });
      const depth = Math.max(1, (options.maxDepth || 5) - 1);
      const result = minimax(
        board,
        nextMoves,
        opponentOf(player),
        player,
        depth,
        -Infinity,
        Infinity,
        persona,
        ctx,
        placed,
      );

      return {
        candidate,
        score: result.aborted ? candidate.score : result.score,
        line: [placed, ...((result.line || []).slice(0, 6))],
        search: {
          depth: result.aborted ? 1 : depth + 1,
          nodes: ctx.nodes,
          elapsedMs: Math.round(now() - ctx.started),
          cacheHits: ctx.cacheHits,
          tacticalNodes: ctx.tacticalNodes,
          cutoffs: ctx.cutoffs,
          tableEntries: ctx.table.size,
          timedOut: Boolean(result.aborted),
        },
      };
    } finally {
      board[move.r][move.c] = 0;
    }
  }

  function chooseHardMove(
    board,
    moves,
    player,
    ranked = rankMoves(board, moves, player),
    persona = AI_PERSONAS.BALANCED,
  ) {
    const result = iterativeSearch(board, moves, player, persona, {
      difficulty: AI_DIFFICULTIES.HARD,
      timeBudgetMs: Math.min(500, G.Config.AI_BUDGET_MS.hard),
      maxDepth: 4,
      candidateLimit: 10,
    });
    if (!result.move) return ranked[0] || null;
    const selected = ranked.find(item => item.r === result.move.r && item.c === result.move.c) || ranked[0];
    return {
      ...selected,
      hardScore: result.score,
      lookahead: `搜索深度 ${result.depth} · ${result.nodes} 节点`,
    };
  }

  function previewLine(board, moves, r, c, player, persona = AI_PERSONAS.BALANCED, maxPlies = 5) {
    if (!board?.[r] || board[r][c] !== 0) return null;

    const line = [{ r, c, player, role: 'self' }];
    board[r][c] = player;
    const workingMoves = [...cloneMoves(moves), { r, c, player }];

    try {
      if (G.Rules.hasWon(board, r, c, player)) {
        return { line, reply: null, followUp: null };
      }

      let side = opponentOf(player);
      for (let ply = 1; ply < maxPlies; ply += 1) {
        const ranked = rankMoves(board, workingMoves, side, persona);
        if (!ranked.length) break;
        const tactical = tacticalCandidates(board, ranked, side);
        const best = tactical.moves[0] || ranked[0];
        const role = side === player ? 'follow' : 'reply';
        const next = { r: best.r, c: best.c, player: side, role };
        line.push(next);
        board[best.r][best.c] = side;
        workingMoves.push({ r: best.r, c: best.c, player: side });
        if (G.Rules.hasWon(board, best.r, best.c, side)) break;
        side = opponentOf(side);
      }

      const reply = line.find(item => item.role === 'reply') || null;
      const followUp = line.find(item => item.role === 'follow') || null;
      return {
        line: line.map(item => ({ ...item })),
        reply: reply ? { r: reply.r, c: reply.c } : null,
        followUp: followUp ? { r: followUp.r, c: followUp.c } : null,
      };
    } finally {
      for (let i = workingMoves.length - 1; i >= (moves?.length || 0); i -= 1) {
        const move = workingMoves[i];
        board[move.r][move.c] = 0;
      }
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

  G.AISearch = Object.freeze({
    WIN_SCORE,
    chooseHardMove,
    chooseMoveAdvanced,
    iterativeSearch,
    analyzeMove,
    previewLine,
    enrichCandidates,
    tacticalCandidates,
  });
})(window.Gomoku = window.Gomoku || {});
