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

const { Config, Services } = globalThis.Gomoku;
const emptyBoard = () => Array.from({ length: Config.SIZE }, () => Array(Config.SIZE).fill(0));

test('AnalysisService 会复用同一局面的候选分析缓存', () => {
  const board = emptyBoard();
  board[7][7] = Config.BLACK;
  const moves = [{ r: 7, c: 7, player: Config.BLACK }];
  const service = new Services.AnalysisService();

  const first = service.candidates(board, moves, Config.WHITE, Config.AI_PERSONAS.BALANCED, 3);
  const before = service.stats();
  const second = service.candidates(board, moves, Config.WHITE, Config.AI_PERSONAS.BALANCED, 3);
  const after = service.stats();

  assert.deepEqual(second, first);
  assert.ok(after.resultHits > before.resultHits);
  assert.equal(after.rankMisses, before.rankMisses);
});

test('AI 落子通过 Local AI 2.0 搜索返回深度、节点和主变化', () => {
  const board = emptyBoard();
  board[7][7] = Config.BLACK;
  const moves = [{ r: 7, c: 7, player: Config.BLACK }];
  const service = new Services.AnalysisService();

  const result = service.chooseMove(
    board,
    moves,
    Config.AI_DIFFICULTIES.NORMAL,
    Config.WHITE,
    Config.AI_PERSONAS.ATTACK,
    () => 0,
    { timeBudgetMs: 80, maxDepth: 3, candidateLimit: 6 },
  );

  assert.ok(result.move);
  assert.ok(result.search);
  assert.ok(result.search.depth >= 1);
  assert.ok(result.search.nodes >= 1);
  assert.ok(Array.isArray(result.principalVariation));
});

test('热力图和优势曲线重复请求命中结果缓存', () => {
  const board = emptyBoard();
  board[7][7] = Config.BLACK;
  const moves = [{ r: 7, c: 7, player: Config.BLACK }];
  const service = new Services.AnalysisService();

  service.heatmap(board, moves, 'combined');
  service.advantage(moves);
  const before = service.stats();
  service.heatmap(board, moves, 'combined');
  service.advantage(moves);
  const after = service.stats();

  assert.ok(after.resultHits >= before.resultHits + 2);
});
