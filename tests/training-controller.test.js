import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.Gomoku = {};

await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/game/position.js');
await import('../js/game/history.js');
await import('../js/training/taxonomy.js');
await import('../js/training/scheduler.js');
await import('../js/training/adaptive-engine.js');
await import('../js/training/puzzles.js');
await import('../js/controllers/training-controller.js');

const G = globalThis.Gomoku;

function puzzle(id, expected, category = 'WIN_MISS') {
  return {
    id,
    sourceKind: 'mistake',
    moveIndex: 2,
    mode: G.Config.MODES.AI,
    player: G.Config.BLACK,
    expected,
    alternatives: [expected],
    prefixMoves: [
      { r: 7, c: 7, player: G.Config.BLACK },
      { r: 0, c: 0, player: G.Config.WHITE },
    ],
    prompt: '找到最佳手',
    category,
    severity: 5,
    confidence: 100,
    explanation: '本地训练解释',
  };
}

function storageStub() {
  let progress = {};
  return {
    loadTrainingProgress: () => structuredClone(progress),
    saveTrainingProgress: next => { progress = structuredClone(next); return true; },
    get: () => structuredClone(progress),
  };
}

test('TrainingController 运行有限自适应训练并记录分级结果', () => {
  const storage = storageStub();
  const controller = new G.Controllers.TrainingController({
    storage,
    refresh: () => {},
    onProgressChange: () => {},
  });
  const puzzles = [
    puzzle('a', { r: 7, c: 8 }),
    puzzle('b', { r: 8, c: 8 }, 'SHAPE_LOSS'),
  ];

  assert.equal(controller.start(puzzles, { mode: 'adaptive', limit: 2 }), true);
  assert.equal(controller.state.puzzles.length, 2);

  const first = controller.currentPuzzle();
  assert.equal(controller.handleMove(first.expected.r, first.expected.c), true);
  assert.equal(controller.state.result.grade, 'best');
  assert.equal(controller.state.sessionStats.best, 1);
  assert.equal(controller.next(), true);

  const second = controller.currentPuzzle();
  assert.equal(controller.handleMove(1, 1), true);
  assert.equal(controller.state.result.grade, 'wrong');
  assert.equal(controller.state.sessionStats.wrong, 1);
  assert.equal(controller.next(), 'done');
  assert.equal(controller.state.sessionDone, true);
  assert.equal(controller.next(), 'exit');

  const saved = storage.get();
  assert.equal(saved[first.id].best, 1);
  assert.equal(saved[second.id].wrong, 1);
});

test('TrainingController 可以从训练题暂停进入变化分析再恢复原题', () => {
  const controller = new G.Controllers.TrainingController({
    storage: storageStub(),
    refresh: () => {},
    onProgressChange: () => {},
  });
  const p = puzzle('one', { r: 7, c: 8 });
  controller.start([p], { puzzleId: 'one' });

  const before = controller.variationPosition();
  assert.equal(before.currentPlayer, G.Config.BLACK);
  assert.equal(before.board[7][7], G.Config.BLACK);

  assert.equal(controller.suspend(), true);
  assert.equal(controller.state.active, false);
  assert.equal(controller.state.suspended, true);
  assert.equal(controller.resume(), true);
  assert.equal(controller.state.active, true);
  assert.equal(controller.currentPuzzle().id, 'one');
});

test('错题单练只选择指定 puzzleId', () => {
  const controller = new G.Controllers.TrainingController({
    storage: storageStub(),
    refresh: () => {},
    onProgressChange: () => {},
  });
  const puzzles = [
    puzzle('a', { r: 7, c: 8 }),
    puzzle('b', { r: 8, c: 8 }),
  ];

  assert.equal(controller.start(puzzles, { mode: 'mistakes', puzzleId: 'b' }), true);
  assert.equal(controller.state.puzzles.length, 1);
  assert.equal(controller.currentPuzzle().id, 'b');
});
