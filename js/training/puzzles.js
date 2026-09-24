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

  function moveKey(move) {
    return move ? `${move.r},${move.c}` : '';
  }

  function puzzleFromMistake(mistake) {
    const alternatives = (mistake.alternatives || [])
      .map(item => ({ r: item.r, c: item.c, score: item.score ?? null }));
    if (!alternatives.some(item => moveKey(item) === moveKey(mistake.expected))) {
      alternatives.unshift({ ...mistake.expected, score: null });
    }

    return {
      id: mistake.id,
      sourceId: mistake.sourceId,
      sourceFinishedAt: mistake.sourceFinishedAt,
      sourceKind: 'mistake',
      mode: mistake.mode,
      moveIndex: mistake.moveIndex,
      player: mistake.player,
      expected: { ...mistake.expected },
      alternatives,
      actual: { ...mistake.actual },
      prefixMoves: G.Position.cloneMoves(mistake.prefixMoves),
      prompt: mistake.prompt,
      label: mistake.label,
      type: 'adaptive',
      category: mistake.type,
      severity: mistake.severity,
      confidence: mistake.confidence,
      scoreLoss: mistake.scoreLoss,
      explanation: mistake.explanation,
    };
  }

  function legacyCategory(moment) {
    if (moment.type === 'mistake') return 'FORCED_DEFENSE_MISS';
    if (moment.type === 'defense') return 'DEFENSE_NEGLECT';
    if (moment.type === 'win' || moment.type === 'attack') return 'TACTICAL_OVERSIGHT';
    return 'SHAPE_LOSS';
  }

  function generate(records, maxCount = MAX_TRAINING_PUZZLES, suppliedMistakes = null) {
    const puzzles = [];
    const seen = new Set();
    const mistakes = suppliedMistakes || G.MistakeMiner?.mine(records) || [];

    for (const mistake of mistakes) {
      if (!mistake.trainable) continue;
      const puzzle = puzzleFromMistake(mistake);
      if (seen.has(puzzle.id)) continue;
      seen.add(puzzle.id);
      puzzles.push(puzzle);
      if (puzzles.length >= maxCount) return puzzles;
    }

    for (const record of records || []) {
      const analysis = G.Analyzer.analyze(record);
      for (const moment of analysis.moments) {
        if (moment.index < 1 || moment.type === 'normal') continue;

        let expected = record.moves[moment.index];
        if (moment.type === 'mistake') {
          if (moment.threatsBefore?.length !== 1) continue;
          expected = { ...moment.threatsBefore[0], player: record.moves[moment.index].player };
        }
        if (!expected) continue;

        const key = `${record.id || 'game'}:legacy:${moment.index}:${expected.r},${expected.c}`;
        if (seen.has(key)) continue;
        seen.add(key);

        puzzles.push({
          id: key,
          sourceId: record.id || null,
          sourceFinishedAt: record.finishedAt || null,
          sourceKind: 'tactical',
          mode: record.mode,
          moveIndex: moment.index,
          player: record.moves[moment.index].player,
          expected: { r: expected.r, c: expected.c },
          alternatives: [{ r: expected.r, c: expected.c }],
          actual: null,
          prefixMoves: record.moves.slice(0, moment.index).map(move => ({ ...move })),
          prompt: promptFor(moment),
          label: moment.label,
          type: moment.type,
          category: legacyCategory(moment),
          severity: moment.severity || 2,
          confidence: moment.type === 'mistake' || moment.type === 'win' ? 100 : 82,
          scoreLoss: 0,
          explanation: `来自历史棋局的${moment.label}局面。`,
        });

        if (puzzles.length >= maxCount) return puzzles;
      }
    }

    return puzzles;
  }

  function check(puzzle, r, c) {
    if (!puzzle) return { correct: false, grade: 'wrong', message: '训练题不可用。' };
    const selected = { r, c };
    const expectedKey = moveKey(puzzle.expected);
    const selectedKey = moveKey(selected);

    if (selectedKey === expectedKey) {
      return {
        correct: true,
        grade: 'best',
        selected,
        category: puzzle.category,
        message: `最佳：${G.History.coordinate(puzzle.expected)} 是当前首选。`,
        explanation: puzzle.explanation || '',
      };
    }

    const alternative = (puzzle.alternatives || []).find(item => moveKey(item) === selectedKey);
    if (alternative) {
      return {
        correct: true,
        grade: 'good',
        selected,
        category: puzzle.category,
        message: `可接受：${G.History.coordinate(selected)} 也是合理候选，但首选仍是 ${G.History.coordinate(puzzle.expected)}。`,
        explanation: puzzle.explanation || '',
      };
    }

    const repeatedOriginal = puzzle.actual && selectedKey === moveKey(puzzle.actual);
    return {
      correct: false,
      grade: 'wrong',
      selected,
      category: puzzle.category,
      message: repeatedOriginal
        ? `这正是原对局中的实战选择。更好的首选是 ${G.History.coordinate(puzzle.expected)}。`
        : `这一步没有进入当前可接受候选。首选：${G.History.coordinate(puzzle.expected)}。`,
      explanation: puzzle.explanation || '',
    };
  }

  G.Puzzles = Object.freeze({ generate, check });
})(window.Gomoku = window.Gomoku || {});
