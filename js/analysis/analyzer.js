(function (G) {
  const { BLACK, WHITE, DIRECTIONS } = G.Config;
  const { boardAt, coordinate } = G.History;
  const { isInside } = G.Rules;
  function lineProfile(board, r, c, player, dr, dc) {
    let count = 1;
    let nr = r + dr;
    let nc = c + dc;
    while (isInside(board, nr, nc) && board[nr][nc] === player) { count += 1; nr += dr; nc += dc; }
    const openA = isInside(board, nr, nc) && board[nr][nc] === 0;
    nr = r - dr; nc = c - dc;
    while (isInside(board, nr, nc) && board[nr][nc] === player) { count += 1; nr -= dr; nc -= dc; }
    const openB = isInside(board, nr, nc) && board[nr][nc] === 0;
    return { count, openEnds: Number(openA) + Number(openB) };
  }
  function classifyMove(moves, index) {
    const move = moves[index];
    const board = boardAt(moves, index + 1);
    let best = { count: 1, openEnds: 0 };
    for (const [dr, dc] of DIRECTIONS) {
      const profile = lineProfile(board, move.r, move.c, move.player, dr, dc);
      if (profile.count > best.count || (profile.count === best.count && profile.openEnds > best.openEnds)) best = profile;
    }
    if (best.count >= 5) return '完成五连';
    if (best.count === 4 && best.openEnds === 2) return '形成活四';
    if (best.count === 4) return '形成四连威胁';
    if (best.count === 3 && best.openEnds === 2) return '形成活三';
    return null;
  }
  function directionName(line) {
    if (!line || line.length < 2) return '无';
    const dr = line[1].r - line[0].r;
    const dc = line[1].c - line[0].c;
    if (dr === 0) return '横向';
    if (dc === 0) return '纵向';
    return dr === dc ? '左上到右下斜线' : '右上到左下斜线';
  }
  function analyze(gameLike) {
    const moves = gameLike.moves || [];
    const winner = gameLike.winner || 0;
    const moments = [];
    for (let i = 0; i < moves.length; i += 1) {
      const label = classifyMove(moves, i);
      if (label) moments.push({ index: i, label, coordinate: coordinate(moves[i]), player: moves[i].player });
    }
    return {
      totalMoves: moves.length,
      winner,
      winnerText: winner === BLACK ? '黑棋获胜' : winner === WHITE ? '白棋获胜' : '平局',
      direction: directionName(gameLike.winningLine),
      moments: moments.slice(-8)
    };
  }
  G.Analyzer = Object.freeze({ analyze, classifyMove, directionName });
})(window.Gomoku = window.Gomoku || {});
