import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.Gomoku = {};

await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/game/position.js');
await import('../js/game/game.js');
await import('../js/game/history.js');

const G = globalThis.Gomoku;
G.Analyzer = {
  analyze: target => ({
    totalMoves: target.moves.length,
    winner: target.winner || 0,
    winnerText: '测试',
    direction: '',
    moments: [],
    keyIndices: [],
  }),
};
G.Puzzles = {
  check: (puzzle, r, c) => ({
    correct: r === puzzle.expected.r && c === puzzle.expected.c,
    message: r === puzzle.expected.r && c === puzzle.expected.c ? '正确' : '再想想',
  }),
};
G.TrainingScheduler = {
  order: puzzles => [...puzzles],
  stateFor: () => ({ dueAt: 0 }),
  update: (progress, id, correct) => ({ ...progress, [id]: { correct: Number(correct) } }),
};

await import('../js/controllers/review-controller.js');
await import('../js/controllers/training-controller.js');
await import('../js/controllers/game-controller.js');

test('ReviewController 管理复盘状态而不依赖 main.js 内部变量', () => {
  const refreshes = [];
  const analysisClient = { advantage: moves => moves.map((_, i) => ({ index: i + 1, value: 0 })) };
  const flags = { BOARD: 1, ANALYSIS: 2, REVIEW: 4 };
  const controller = new G.Controllers.ReviewController({
    analysisClient,
    refresh: mask => refreshes.push(mask),
    flags,
  });

  const source = {
    mode: G.Config.MODES.PVP,
    moves: [
      { r: 7, c: 7, player: G.Config.BLACK },
      { r: 7, c: 8, player: G.Config.WHITE },
    ],
    winner: 0,
  };

  controller.start(source);
  assert.equal(controller.state.active, true);
  assert.equal(controller.state.index, 2);
  controller.seek(1);
  assert.equal(controller.state.index, 1);
  assert.equal(refreshes.at(-1), flags.BOARD | flags.ANALYSIS | flags.REVIEW);

  controller.deactivateForBranch();
  assert.equal(controller.state.active, false);
  controller.resume();
  assert.equal(controller.state.active, true);

  const result = controller.exit();
  assert.equal(result.exited, true);
  assert.equal(controller.state.active, false);
});

test('TrainingController 独立维护训练题、反馈和进度', () => {
  const saved = [];
  let progressChanges = 0;
  let refreshes = 0;
  const storage = {
    loadTrainingProgress: () => ({}),
    saveTrainingProgress: value => saved.push(value),
  };
  const controller = new G.Controllers.TrainingController({
    storage,
    refresh: () => { refreshes += 1; },
    onProgressChange: () => { progressChanges += 1; },
  });

  const puzzles = [{
    id: 'p1',
    mode: G.Config.MODES.PVP,
    prefixMoves: [{ r: 7, c: 7, player: G.Config.BLACK }],
    player: G.Config.WHITE,
    expected: { r: 7, c: 8 },
  }];

  assert.equal(controller.start(puzzles), true);
  assert.equal(controller.state.active, true);
  assert.equal(controller.handleMove(7, 8), true);
  assert.equal(controller.state.feedback, '正确');
  assert.equal(saved.length, 1);
  assert.equal(progressChanges, 1);
  assert.equal(refreshes, 1);
  assert.equal(controller.exit(), true);
  assert.equal(controller.state.active, false);
});

test('GameController 承担普通对局落子和存档职责', () => {
  const game = new G.Game.Game();
  const storageWrites = [];
  const controller = new G.Controllers.GameController({
    game,
    settings: { difficulty: 'normal', persona: 'balanced' },
    aiClient: { cancel() {}, chooseMove: async () => ({ stale: true, result: null }) },
    audio: { playMove() {}, playWin() {}, playDraw() {} },
    panel: { hideResult() {}, showResult() {} },
    storage: {
      saveCurrent: snapshot => storageWrites.push(snapshot),
      clearCurrent() {},
      saveFinished() {},
      removeHistory() {},
    },
    refresh() {},
    flags: { BOARD: 1, STATUS: 2 },
    isSpecialActive: () => false,
    onHistoryChanged() {},
  });

  assert.equal(controller.performMove(7, 7), true);
  assert.equal(game.moves.length, 1);
  assert.equal(storageWrites.length, 1);
  assert.equal(storageWrites[0].moves.length, 1);

  controller.undo();
  assert.equal(game.moves.length, 0);
});
