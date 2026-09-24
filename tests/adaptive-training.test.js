import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.Gomoku = {};

await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/game/position.js');
await import('../js/game/history.js');
await import('../js/ai/evaluator.js');
await import('../js/analysis/analyzer.js');
await import('../js/training/taxonomy.js');
await import('../js/training/mistake-miner.js');
await import('../js/training/scheduler.js');
await import('../js/training/adaptive-engine.js');
await import('../js/training/puzzles.js');
await import('../js/training/profile.js');

const G = globalThis.Gomoku;
const B = G.Config.BLACK;
const W = G.Config.WHITE;

function winMissRecord() {
  return {
    id: 'win-miss',
    finishedAt: '2026-09-24T12:00:00Z',
    mode: G.Config.MODES.AI,
    winner: W,
    moves: [
      { r: 7, c: 3, player: B }, { r: 0, c: 0, player: W },
      { r: 7, c: 4, player: B }, { r: 0, c: 2, player: W },
      { r: 7, c: 5, player: B }, { r: 0, c: 4, player: W },
      { r: 7, c: 6, player: B }, { r: 0, c: 6, player: W },
      { r: 1, c: 1, player: B },
    ],
  };
}

function forcedDefenseRecord() {
  return {
    id: 'forced-defense',
    finishedAt: '2026-09-23T12:00:00Z',
    mode: G.Config.MODES.AI,
    winner: W,
    moves: [
      { r: 8, c: 3, player: B }, { r: 8, c: 4, player: W },
      { r: 0, c: 0, player: B }, { r: 8, c: 5, player: W },
      { r: 0, c: 2, player: B }, { r: 8, c: 6, player: W },
      { r: 0, c: 4, player: B }, { r: 8, c: 7, player: W },
      { r: 1, c: 1, player: B },
    ],
  };
}

test('MistakeMiner 识别错过直接胜并生成高可信个人错题', () => {
  const mistakes = G.MistakeMiner.mine([winMissRecord()]);
  const miss = mistakes.find(item => item.type === 'WIN_MISS');
  assert.ok(miss);
  assert.equal(miss.confidence, 100);
  assert.equal(miss.trainable, true);
  assert.equal(miss.actual.r, 1);

  const puzzles = G.Puzzles.generate([winMissRecord()], 24, mistakes);
  const puzzle = puzzles.find(item => item.id === miss.id);
  assert.ok(puzzle);
  assert.equal(puzzle.sourceKind, 'mistake');
  assert.equal(puzzle.category, 'WIN_MISS');
});

test('MistakeMiner 只把唯一可封堵的直接威胁作为强制防守错题', () => {
  const mistakes = G.MistakeMiner.mine([forcedDefenseRecord()]);
  const miss = mistakes.find(item => item.type === 'FORCED_DEFENSE_MISS');
  assert.ok(miss);
  assert.deepEqual(miss.expected, { r: 8, c: 8 });
  assert.equal(miss.confidence, 100);
});

test('两个对手直接胜点同时存在时不伪造唯一防守答案', () => {
  const board = G.Position.emptyBoard();
  board[8][4] = W;
  board[8][5] = W;
  board[8][6] = W;
  board[8][7] = W;
  const ranked = G.AI.rankMoves(board, [], B, G.Config.AI_PERSONAS.BALANCED);
  const actual = ranked.find(item => item.r === 0 && item.c === 0) || ranked.at(-1);
  const result = G.MistakeMiner.classify({ board, ranked, actual, player: B });
  assert.notEqual(result?.type, 'FORCED_DEFENSE_MISS');
});

test('训练题区分最佳手、可接受次优手和错误手', () => {
  const puzzle = {
    expected: { r: 7, c: 7 },
    alternatives: [{ r: 7, c: 7 }, { r: 7, c: 8 }],
    actual: { r: 0, c: 0 },
    category: 'SHAPE_LOSS',
    explanation: 'test',
  };

  assert.equal(G.Puzzles.check(puzzle, 7, 7).grade, 'best');
  assert.equal(G.Puzzles.check(puzzle, 7, 8).grade, 'good');
  assert.equal(G.Puzzles.check(puzzle, 0, 0).grade, 'wrong');
});

test('间隔复习对最佳、次优和错误采用不同学习节奏', () => {
  const now = 10_000;
  let progress = {};
  progress = G.TrainingScheduler.update(progress, 'p', { grade: 'good', category: 'SHAPE_LOSS' }, now);
  assert.equal(progress.p.good, 1);
  assert.equal(progress.p.correct, 1);
  assert.ok(progress.p.dueAt > now);

  progress = G.TrainingScheduler.update(progress, 'p', { grade: 'wrong', category: 'SHAPE_LOSS' }, now);
  assert.equal(progress.p.repetitions, 0);
  assert.equal(progress.p.dueAt, now + 5 * 60 * 1000);

  progress = G.TrainingScheduler.update(progress, 'p', { grade: 'best', category: 'SHAPE_LOSS' }, now);
  assert.equal(progress.p.best, 1);
});

test('AdaptiveTraining 会优先安排错误压力更高的弱项', () => {
  const puzzles = [
    { id: 'a', category: 'WIN_MISS', severity: 5, confidence: 100, sourceKind: 'mistake' },
    { id: 'b', category: 'SHAPE_LOSS', severity: 2, confidence: 70, sourceKind: 'mistake' },
  ];
  const mistakes = [
    { type: 'SHAPE_LOSS', trainable: true },
    { type: 'SHAPE_LOSS', trainable: true },
    { type: 'SHAPE_LOSS', trainable: true },
    { type: 'WIN_MISS', trainable: true },
  ];
  const progress = {
    a: { attempts: 3, correct: 3, best: 3, wrong: 0, mastered: true, dueAt: Date.now() + 999999 },
    b: { attempts: 3, correct: 0, best: 0, wrong: 3, mastered: false, dueAt: 0 },
  };

  const plan = G.AdaptiveTraining.plan(puzzles, progress, { mistakes, limit: 2 });
  assert.equal(plan[0].id, 'b');
  const summary = G.AdaptiveTraining.summary(puzzles, progress, mistakes);
  assert.equal(summary.topWeakness.type, 'SHAPE_LOSS');
});

test('玩家画像包含自动错误分类和首要弱点', () => {
  const mistakes = G.MistakeMiner.mine([winMissRecord(), forcedDefenseRecord()]);
  const profile = G.Profile.compute([winMissRecord(), forcedDefenseRecord()], mistakes);
  assert.equal(profile.games, 2);
  assert.ok(profile.mistakes >= 2);
  assert.ok(profile.topWeakness);
  assert.ok(profile.errorCounts.WIN_MISS >= 1);
});
