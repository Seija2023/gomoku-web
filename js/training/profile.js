(function (G) {
  const { BLACK, MODES } = G.Config;

  function percent(value, total) {
    return total ? Math.round((value / total) * 100) : 0;
  }

  function compute(records, mistakes = null) {
    const aiGames = (records || []).filter(record => record.mode === MODES.AI);
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalMoves = 0;
    let playerMoves = 0;
    let centerMoves = 0;
    let attackMoments = 0;
    let defenseMoments = 0;
    let legacyMistakes = 0;

    for (const record of aiGames) {
      if (record.winner === BLACK) wins += 1;
      else if (record.winner === 0) draws += 1;
      else losses += 1;
      totalMoves += record.moves.length;

      for (const move of record.moves) {
        if (move.player !== BLACK) continue;
        playerMoves += 1;
        if (move.r >= 5 && move.r <= 9 && move.c >= 5 && move.c <= 9) centerMoves += 1;
      }

      const analysis = G.Analyzer.analyze(record);
      for (const moment of analysis.moments) {
        if (moment.player !== BLACK) continue;
        if (moment.type === 'attack' || moment.type === 'win') attackMoments += 1;
        if (moment.type === 'defense') defenseMoments += 1;
        if (moment.type === 'mistake') legacyMistakes += 1;
      }
    }

    let style = '均衡';
    if (attackMoments >= defenseMoments * 1.7 && attackMoments >= 2) style = '偏进攻';
    else if (defenseMoments >= attackMoments * 1.7 && defenseMoments >= 2) style = '偏防守';

    const errorCounts = {};
    let totalLoss = 0;
    let severeMistakes = 0;
    for (const mistake of mistakes || []) {
      errorCounts[mistake.type] = (errorCounts[mistake.type] || 0) + 1;
      totalLoss += mistake.scoreLoss || 0;
      if ((mistake.severity || 0) >= 4) severeMistakes += 1;
    }

    const weaknessRanking = Object.entries(errorCounts)
      .map(([type, count]) => ({
        type,
        label: G.ErrorTaxonomy.info(type).label,
        count,
        priority: G.ErrorTaxonomy.info(type).priority,
      }))
      .sort((a, b) => b.count - a.count || b.priority - a.priority);

    return {
      games: aiGames.length,
      wins,
      losses,
      draws,
      avgMoves: aiGames.length ? Math.round((totalMoves / aiGames.length) * 10) / 10 : 0,
      centerRate: percent(centerMoves, playerMoves),
      attackMoments,
      defenseMoments,
      mistakes: Array.isArray(mistakes) ? mistakes.length : legacyMistakes,
      severeMistakes: Array.isArray(mistakes) ? severeMistakes : legacyMistakes,
      avgScoreLoss: Array.isArray(mistakes) && mistakes.length ? Math.round(totalLoss / mistakes.length) : 0,
      errorCounts,
      weaknessRanking,
      topWeakness: weaknessRanking[0] || null,
      style,
    };
  }

  G.Profile = Object.freeze({ compute });
})(window.Gomoku = window.Gomoku || {});
