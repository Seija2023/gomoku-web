(function (G) {
  const { BLACK, WHITE, DIRECTIONS } = G.Config;
  const { boardAt, coordinate } = G.History;
  const { isInside } = G.Rules;

  function opponentOf(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function lineProfile(board, r, c, player, dr, dc) {
    let count = 1;
    let nr = r + dr;
    let nc = c + dc;
    while (isInside(board, nr, nc) && board[nr][nc] === player) {
      count += 1;
      nr += dr;
      nc += dc;
    }
    const openA = isInside(board, nr, nc) && board[nr][nc] === 0;

    nr = r - dr;
    nc = c - dc;
    while (isInside(board, nr, nc) && board[nr][nc] === player) {
      count += 1;
      nr -= dr;
      nc -= dc;
    }
    const openB = isInside(board, nr, nc) && board[nr][nc] === 0;
    return { count, openEnds: Number(openA) + Number(openB) };
  }

  function winningMoves(board, player) {
    const result = [];
    for (let r = 0; r < board.length; r += 1) {
      for (let c = 0; c < board.length; c += 1) {
        if (board[r][c] === 0 && G.AI?.isWinningMove(board, r, c, player)) result.push({ r, c });
      }
    }
    return result;
  }

  function shapeAt(board, move) {
    let best = { count: 1, openEnds: 0 };
    for (const [dr, dc] of DIRECTIONS) {
      const profile = lineProfile(board, move.r, move.c, move.player, dr, dc);
      if (profile.count > best.count || (profile.count === best.count && profile.openEnds > best.openEnds)) best = profile;
    }
    return best;
  }

  function classifyMoveDetailed(moves, index) {
    const move = moves[index];
    if (!move) return null;

    const before = boardAt(moves, index);
    const opponent = opponentOf(move.player);
    const threatsBefore = winningMoves(before, opponent);

    const after = boardAt(moves, index + 1);
    const shape = shapeAt(after, move);
    const threatsAfter = winningMoves(after, opponent);

    let type = 'normal';
    let label = null;
    let severity = 0;

    if (shape.count >= 5) {
      type = 'win';
      label = '完成五连';
      severity = 5;
    } else if (threatsBefore.length && threatsAfter.length === 0) {
      type = 'defense';
      label = '关键防守';
      severity = 4;
    } else if (threatsBefore.length && threatsAfter.length > 0) {
      type = 'mistake';
      label = '漏防直接五连';
      severity = 5;
    } else if (shape.count === 4 && shape.openEnds === 2) {
      type = 'attack';
      label = '形成活四';
      severity = 4;
    } else if (shape.count === 4) {
      type = 'attack';
      label = '形成四连威胁';
      severity = 3;
    } else if (shape.count === 3 && shape.openEnds === 2) {
      type = 'attack';
      label = '形成活三';
      severity = 2;
    } else if (!threatsBefore.length && threatsAfter.length > 0) {
      type = 'mistake';
      label = '暴露致命威胁';
      severity = 4;
    }

    if (!label) return null;
    return {
      index,
      label,
      type,
      severity,
      coordinate: coordinate(move),
      player: move.player,
      move: { ...move },
      threatsBefore,
      threatsAfter,
    };
  }

  function classifyMove(moves, index) {
    return classifyMoveDetailed(moves, index)?.label || null;
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
      const moment = classifyMoveDetailed(moves, i);
      if (moment) moments.push(moment);
    }

    return {
      totalMoves: moves.length,
      winner,
      winnerText: winner === BLACK ? '黑棋获胜' : winner === WHITE ? '白棋获胜' : '平局',
      direction: directionName(gameLike.winningLine),
      moments,
      keyIndices: moments.map(item => item.index + 1),
      mistakes: moments.filter(item => item.type === 'mistake'),
    };
  }

  G.Analyzer = Object.freeze({
    analyze,
    classifyMove,
    classifyMoveDetailed,
    directionName,
    winningMoves,
  });
})(window.Gomoku = window.Gomoku || {});
