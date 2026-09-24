(function (G) {
  const { BLACK, MODES } = G.Config;

  function percent(value, total) {
    return total ? Math.round((value / total) * 100) : 0;
  }

  function compute(records) {
    const aiGames = records.filter(record => record.mode === MODES.AI);
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalMoves = 0;
    let playerMoves = 0;
    let centerMoves = 0;
    let attackMoments = 0;
    let defenseMoments = 0;
    let mistakes = 0;

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
        if (moment.type === 'mistake') mistakes += 1;
      }
    }

    let style = '均衡';
    if (attackMoments >= defenseMoments * 1.7 && attackMoments >= 2) style = '偏进攻';
    else if (defenseMoments >= attackMoments * 1.7 && defenseMoments >= 2) style = '偏防守';

    return {
      games: aiGames.length,
      wins,
      losses,
      draws,
      avgMoves: aiGames.length ? Math.round((totalMoves / aiGames.length) * 10) / 10 : 0,
      centerRate: percent(centerMoves, playerMoves),
      attackMoments,
      defenseMoments,
      mistakes,
      style,
    };
  }

  G.Profile = Object.freeze({ compute });
})(window.Gomoku = window.Gomoku || {});
