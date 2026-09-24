import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/game/position.js');
await import('../js/ai/evaluator.js');
await import('../js/ai/search.js');
await import('../js/analysis/heatmap.js');
await import('../js/analysis/advantage.js');
await import('../js/services/analysis-service.js');
await import('../js/services/counterfactual-service.js');

const G = globalThis.Gomoku;
const emptyBoard = () => G.Position.emptyBoard();

test('反事实分析会识别错过的直接胜手且不修改原棋盘', () => {
  const board = emptyBoard();
  for (let c = 3; c <= 6; c += 1) board[7][c] = G.Config.BLACK;
  board[0][1] = G.Config.WHITE;
  const before = G.Position.cloneBoard(board);
  const analysis = new G.Services.AnalysisService();
  const service = new G.Services.CounterfactualService(analysis);

  const result = service.compare({
    board,
    moves: [],
    player: G.Config.BLACK,
    persona: G.Config.AI_PERSONAS.BALANCED,
    userMove: { r: 0, c: 0 },
    searchOptions: { timeBudgetMs: 100, maxDepth: 3, candidateLimit: 6 },
  });

  assert.ok(result);
  assert.equal(result.recommendedLine.winsImmediately, true);
  assert.equal(result.userLine.winsImmediately, false);
  assert.match(result.reasons.join(''), /直接取胜|五连/);
  assert.deepEqual(board, before);
});

test('反事实分析会识别必须封堵的对手五连', () => {
  const board = emptyBoard();
  for (let c = 4; c <= 7; c += 1) board[8][c] = G.Config.WHITE;
  board[0][1] = G.Config.BLACK;
  const analysis = new G.Services.AnalysisService();
  const service = new G.Services.CounterfactualService(analysis);

  const result = service.compare({
    board,
    moves: [],
    player: G.Config.BLACK,
    persona: G.Config.AI_PERSONAS.BALANCED,
    userMove: { r: 0, c: 0 },
    searchOptions: { timeBudgetMs: 100, maxDepth: 3, candidateLimit: 6 },
  });

  assert.ok(result);
  assert.equal(result.recommendedLine.blocksImmediateWin, true);
  assert.equal(result.userLine.blocksImmediateWin, false);
  assert.match(result.reasons.join(''), /封住|强制威胁/);
});

test('选择本身就是推荐手时返回一致结论', () => {
  const board = emptyBoard();
  board[7][7] = G.Config.BLACK;
  board[7][8] = G.Config.WHITE;
  const analysis = new G.Services.AnalysisService();
  const service = new G.Services.CounterfactualService(analysis);
  const recommended = analysis.chooseMove(
    board,
    [],
    G.Config.AI_DIFFICULTIES.HARD,
    G.Config.BLACK,
    G.Config.AI_PERSONAS.BALANCED,
    Math.random,
    { timeBudgetMs: 80, maxDepth: 3, candidateLimit: 6 },
  ).move;

  const result = service.compare({
    board,
    moves: [],
    player: G.Config.BLACK,
    persona: G.Config.AI_PERSONAS.BALANCED,
    userMove: { r: recommended.r, c: recommended.c },
    searchOptions: { timeBudgetMs: 100, maxDepth: 3, candidateLimit: 6 },
  });

  assert.equal(result.sameMove, true);
  assert.equal(result.scoreDelta, 0);
  assert.match(result.reasons[0], /推荐手一致/);
});

test('终局或已占用点不会进入反事实比较', () => {
  const board = emptyBoard();
  board[7][7] = G.Config.BLACK;
  const analysis = new G.Services.AnalysisService();
  const service = new G.Services.CounterfactualService(analysis);

  assert.equal(service.compare({
    board,
    moves: [],
    player: G.Config.WHITE,
    persona: G.Config.AI_PERSONAS.BALANCED,
    userMove: { r: 7, c: 7 },
  }), null);

  for (let c = 3; c <= 6; c += 1) board[6][c] = G.Config.BLACK;
  board[6][7] = G.Config.BLACK;
  assert.equal(service.compare({
    board,
    moves: [],
    player: G.Config.WHITE,
    persona: G.Config.AI_PERSONAS.BALANCED,
    userMove: { r: 5, c: 5 },
  }), null);
});
