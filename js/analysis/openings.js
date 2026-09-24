(function (G) {
  const { BLACK, OPENING_DEPTH } = G.Config;

  function signature(moves, depth = OPENING_DEPTH) {
    return moves.slice(0, depth).map(move => `${move.r},${move.c},${move.player}`).join('|');
  }

  function label(moves, depth = OPENING_DEPTH) {
    return moves.slice(0, depth).map(move => G.History.coordinate(move)).join(' → ');
  }

  function build(records, depth = OPENING_DEPTH) {
    const groups = new Map();

    for (const record of records) {
      if (!record.moves?.length) continue;
      const sig = signature(record.moves, depth);
      if (!sig) continue;
      const item = groups.get(sig) || {
        signature: sig,
        label: label(record.moves, depth),
        uses: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalMoves: 0,
      };

      item.uses += 1;
      item.totalMoves += record.moves.length;
      if (record.winner === BLACK) item.wins += 1;
      else if (record.winner === 0) item.draws += 1;
      else item.losses += 1;
      groups.set(sig, item);
    }

    return [...groups.values()]
      .map(item => ({
        ...item,
        avgMoves: Math.round((item.totalMoves / item.uses) * 10) / 10,
      }))
      .sort((a, b) => b.uses - a.uses || b.wins - a.wins)
      .slice(0, 6);
  }

  G.Openings = Object.freeze({ signature, label, build });
})(window.Gomoku = window.Gomoku || {});
