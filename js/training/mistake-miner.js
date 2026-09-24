(function (G) {
  const { BLACK, WHITE, MODES, AI_PERSONAS } = G.Config;
  const MAX_MISTAKES = 48;

  function opponentOf(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function moveKey(move) {
    return move ? `${move.r},${move.c}` : '';
  }

  function findRanked(ranked, move) {
    const key = moveKey(move);
    return ranked.find(item => moveKey(item) === key) || null;
  }

  function tacticalWinningMoves(board, ranked, player) {
    return ranked.filter(item => G.AI.isWinningMove(board, item.r, item.c, player));
  }

  function lossRatio(bestScore, actualScore) {
    const gap = Math.max(0, bestScore - actualScore);
    return gap / Math.max(1000, Math.abs(bestScore));
  }

  function confidenceFor({ type, best, second, actual, ratio }) {
    if (type === 'WIN_MISS' || type === 'FORCED_DEFENSE_MISS') return 1;
    const bestScore = Math.abs(best?.score || 0);
    const margin = Math.max(0, (best?.score || 0) - (second?.score || 0));
    const separation = margin / Math.max(1000, bestScore);
    const actualGap = Math.max(0, (best?.score || 0) - (actual?.score || 0));
    const gapSignal = actualGap / Math.max(1000, bestScore);
    return Math.max(0.45, Math.min(0.96, 0.52 + gapSignal * 0.32 + separation * 0.22 + ratio * 0.16));
  }

  function classify({ board, ranked, actual, player }) {
    const opponent = opponentOf(player);
    const best = ranked[0];
    const second = ranked[1] || best;
    if (!best || !actual) return null;

    const ownWins = tacticalWinningMoves(board, ranked, player);
    if (ownWins.length && !G.AI.isWinningMove(board, actual.r, actual.c, player)) {
      return { type: 'WIN_MISS', expected: ownWins[0], alternatives: ownWins };
    }

    const opponentWins = tacticalWinningMoves(board, ranked, opponent);
    if (opponentWins.length === 1 && !G.AI.isWinningMove(board, actual.r, actual.c, opponent)) {
      return { type: 'FORCED_DEFENSE_MISS', expected: opponentWins[0], alternatives: opponentWins };
    }

    const gap = best.score - actual.score;
    const ratio = lossRatio(best.score, actual.score);
    const meaningfulGap = gap >= Math.max(4500, Math.abs(best.score) * 0.24);
    if (!meaningfulGap) return null;

    let type = 'SHAPE_LOSS';
    const bestTactical = best.attack >= 120_000 || best.defense >= 120_000;
    const bestDefense = best.defense >= 32_000;
    const actualAttackBiased = actual.attack >= Math.max(32_000, actual.defense * 1.35);

    if (bestTactical) type = 'TACTICAL_OVERSIGHT';
    else if (bestDefense && actualAttackBiased && best.defense > actual.defense * 1.6) type = 'DEFENSE_NEGLECT';

    const tolerance = Math.max(1200, Math.abs(best.score) * 0.08);
    const alternatives = ranked
      .filter(item => best.score - item.score <= tolerance)
      .slice(0, 3);

    return { type, expected: best, alternatives, ratio, second };
  }

  function explanation(type, expected, actual) {
    const expectedCoord = G.History.coordinate(expected);
    const actualCoord = G.History.coordinate(actual);
    if (type === 'WIN_MISS') return `${expectedCoord} 可以直接完成五连；实战 ${actualCoord} 错过了立即取胜。`;
    if (type === 'FORCED_DEFENSE_MISS') return `${expectedCoord} 是当前必须处理的直接五连威胁；实战 ${actualCoord} 没有完成封堵。`;
    if (type === 'TACTICAL_OVERSIGHT') return `${expectedCoord} 能形成或处理更强的强制棋形，战术价值明显高于实战 ${actualCoord}。`;
    if (type === 'DEFENSE_NEGLECT') return `${expectedCoord} 的限制和防守价值更高；实战 ${actualCoord} 更偏进攻，给对手留下了更强反击空间。`;
    return `${expectedCoord} 的综合棋形效率明显更高；实战 ${actualCoord} 没有直接战术错误，但损失了局面价值。`;
  }

  function mineRecord(record, options = {}) {
    if (!record?.moves?.length || record.mode !== MODES.AI) return [];
    const player = options.player || BLACK;
    const persona = options.persona || AI_PERSONAS.BALANCED;
    const results = [];

    for (let index = 0; index < record.moves.length; index += 1) {
      const move = record.moves[index];
      if (move.player !== player || index < 2) continue;

      const prefixMoves = record.moves.slice(0, index).map(item => ({ ...item }));
      const board = G.History.boardAt(record.moves, index);
      const ranked = G.AI.rankMoves(board, prefixMoves, player, persona);
      const actual = findRanked(ranked, move);
      if (!actual || !ranked.length) continue;

      const classified = classify({ board, ranked, actual, player });
      if (!classified) continue;

      const best = classified.expected;
      const second = classified.second || ranked[1] || best;
      const ratio = classified.ratio ?? lossRatio(best.score, actual.score);
      const confidence = confidenceFor({
        type: classified.type,
        best,
        second,
        actual,
        ratio,
      });
      const taxonomy = G.ErrorTaxonomy.info(classified.type);
      const scoreLoss = Math.max(0, Math.round(best.score - actual.score));
      const alternatives = classified.alternatives
        .map(item => ({ r: item.r, c: item.c, score: Math.round(item.score) }));

      results.push({
        id: `${record.id || 'game'}:mistake:${index}:${classified.type}`,
        sourceId: record.id || null,
        sourceFinishedAt: record.finishedAt || null,
        mode: record.mode,
        moveIndex: index,
        player,
        type: classified.type,
        label: taxonomy.label,
        severity: taxonomy.priority,
        confidence: Math.round(confidence * 100),
        scoreLoss,
        lossRatio: Math.round(ratio * 1000) / 1000,
        actual: { r: move.r, c: move.c },
        expected: { r: best.r, c: best.c },
        alternatives,
        prefixMoves,
        prompt: classified.type === 'WIN_MISS'
          ? '找到这里可以直接取胜的一手'
          : classified.type === 'FORCED_DEFENSE_MISS'
            ? '找到这里必须处理的防守点'
            : `重新判断这一步：找出比实战更好的${taxonomy.short}选择`,
        explanation: explanation(classified.type, best, move),
      });
    }

    return results;
  }

  function mine(records, options = {}) {
    const maxGames = options.maxGames || G.Config.MAX_MINED_GAMES || 12;
    const minConfidence = options.minConfidence ?? G.Config.MIN_TRAINING_CONFIDENCE ?? 0.62;
    const aiRecords = (records || []).filter(record => record.mode === MODES.AI).slice(0, maxGames);
    const mistakes = [];

    for (const record of aiRecords) {
      mistakes.push(...mineRecord(record, options));
      if (mistakes.length >= MAX_MISTAKES) break;
    }

    return mistakes
      .sort((a, b) => {
        if (b.severity !== a.severity) return b.severity - a.severity;
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return (b.sourceFinishedAt || '').localeCompare(a.sourceFinishedAt || '');
      })
      .map(item => ({
        ...item,
        trainable: item.confidence / 100 >= minConfidence || item.severity >= 5,
      }))
      .slice(0, MAX_MISTAKES);
  }

  G.MistakeMiner = Object.freeze({ mine, mineRecord, classify });
})(window.Gomoku = window.Gomoku || {});
