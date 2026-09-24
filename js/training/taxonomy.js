(function (G) {
  const TYPES = Object.freeze({
    WIN_MISS: Object.freeze({
      id: 'WIN_MISS',
      label: '错过直接胜',
      short: '胜着',
      description: '当前存在直接五连，但实战没有选择取胜点。',
      priority: 5,
    }),
    FORCED_DEFENSE_MISS: Object.freeze({
      id: 'FORCED_DEFENSE_MISS',
      label: '漏防强制威胁',
      short: '漏防',
      description: '对手下一手存在直接五连，实战没有完成必要封堵。',
      priority: 5,
    }),
    TACTICAL_OVERSIGHT: Object.freeze({
      id: 'TACTICAL_OVERSIGHT',
      label: '战术机会漏算',
      short: '战术',
      description: '存在明显的四连、活四或高价值战术点，但实战选择明显较弱。',
      priority: 4,
    }),
    DEFENSE_NEGLECT: Object.freeze({
      id: 'DEFENSE_NEGLECT',
      label: '防守优先级不足',
      short: '防守',
      description: '实战偏重进攻，却放弃了明显更高价值的限制或防守点。',
      priority: 4,
    }),
    SHAPE_LOSS: Object.freeze({
      id: 'SHAPE_LOSS',
      label: '棋形效率损失',
      short: '棋形',
      description: '没有直接战术失误，但落子使局面综合棋形明显低于更好的候选。',
      priority: 2,
    }),
  });

  function info(type) {
    return TYPES[type] || Object.freeze({
      id: type || 'UNKNOWN',
      label: '综合判断',
      short: '综合',
      description: '来自本地棋形评分的综合差异。',
      priority: 1,
    });
  }

  G.ErrorTaxonomy = Object.freeze({ TYPES, info });
})(window.Gomoku = window.Gomoku || {});
