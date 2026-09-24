(function (G) {
  const { MAX_TRAINING_PUZZLES } = G.Config;

  function promptFor(moment) {
    if (moment.type === 'defense') return '找到这一局面最关键的防守点';
    if (moment.type === 'mistake') return '原棋谱这里出现漏防：找到必须封堵的位置';
    if (moment.label === '完成五连') return '找到可以直接完成五连的位置';
    if (moment.label === '形成活四') return '找到形成活四的强攻位置';
    if (moment.label === '形成四连威胁') return '找到制造四连威胁的位置';
    return '找到这一局面的关键进攻点';
  }

  function generate(records, maxCount = MAX_TRAINING_PUZZLES) {
    const puzzles = [];
    const seen = new Set();

    for (const record of records) {
      const analysis = G.Analyzer.analyze(record);
      for (const moment of analysis.moments) {
        if (moment.index < 1 || moment.type === 'normal') continue;

        let expected = record.moves[moment.index];
        if (moment.type === 'mistake') {
          if (moment.threatsBefore?.length !== 1) continue;
          expected = { ...moment.threatsBefore[0], player: record.moves[moment.index].player };
        }
        if (!expected) continue;

        const key = `${record.id || 'game'}:${moment.index}:${expected.r},${expected.c}`;
        if (seen.has(key)) continue;
        seen.add(key);

        puzzles.push({
          id: key,
          sourceId: record.id || null,
          mode: record.mode,
          moveIndex: moment.index,
          player: record.moves[moment.index].player,
          expected: { r: expected.r, c: expected.c },
          prefixMoves: record.moves.slice(0, moment.index).map(move => ({ ...move })),
          prompt: promptFor(moment),
          label: moment.label,
          type: moment.type,
        });

        if (puzzles.length >= maxCount) return puzzles;
      }
    }

    return puzzles;
  }

  function check(puzzle, r, c) {
    const correct = puzzle && puzzle.expected.r === r && puzzle.expected.c === c;
    return {
      correct,
      message: correct
        ? `正确：${G.History.coordinate(puzzle.expected)} 是这个局面的关键点。`
        : `这一步不是目标关键点。参考答案：${G.History.coordinate(puzzle.expected)}。`,
    };
  }

  G.Puzzles = Object.freeze({ generate, check });
})(window.Gomoku = window.Gomoku || {});
