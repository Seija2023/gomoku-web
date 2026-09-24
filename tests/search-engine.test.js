import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/game/position.js');
await import('../js/ai/evaluator.js');
await import('../js/ai/search.js');

const G = globalThis.Gomoku;
const emptyBoard = () => G.Position.emptyBoard();

test('Local AI 2.0 迭代加深返回搜索统计和主变化', () => {
  const board = emptyBoard();
  board[7][7] = G.Config.BLACK;
  board[7][8] = G.Config.WHITE;
  board[8][7] = G.Config.BLACK;
  const moves = [];

  const result = G.AISearch.chooseMoveAdvanced(
    board,
    moves,
    G.Config.AI_DIFFICULTIES.NORMAL,
    G.Config.WHITE,
    G.Config.AI_PERSONAS.BALANCED,
    { timeBudgetMs: 120, maxDepth: 3, candidateLimit: 6 },
  );

  assert.ok(result.move);
  assert.equal(board[result.move.r][result.move.c], 0);
  assert.ok(result.search.depth >= 1);
  assert.ok(result.search.nodes >= 1);
  assert.ok(result.search.elapsedMs >= 0);
  assert.ok(Array.isArray(result.principalVariation));
  assert.ok(result.principalVariation.length >= 1);
});

test('战术搜索优先识别直接成五和强制封堵', () => {
  const winningBoard = emptyBoard();
  for (let c = 3; c <= 6; c += 1) winningBoard[7][c] = G.Config.WHITE;
  const winRanked = G.AI.rankMoves(
    winningBoard,
    [],
    G.Config.WHITE,
    G.Config.AI_PERSONAS.BALANCED,
  );
  const winning = G.AISearch.tacticalCandidates(winningBoard, winRanked, G.Config.WHITE);
  assert.equal(winning.kind, 'win');
  assert.ok(winning.moves.some(move => move.r === 7 && (move.c === 2 || move.c === 7)));

  const blockingBoard = emptyBoard();
  for (let c = 4; c <= 7; c += 1) blockingBoard[8][c] = G.Config.BLACK;
  const blockRanked = G.AI.rankMoves(
    blockingBoard,
    [],
    G.Config.WHITE,
    G.Config.AI_PERSONAS.BALANCED,
  );
  const blocking = G.AISearch.tacticalCandidates(blockingBoard, blockRanked, G.Config.WHITE);
  assert.equal(blocking.kind, 'block');
  assert.ok(blocking.moves.some(move => move.r === 8 && (move.c === 3 || move.c === 8)));
});

test('迭代搜索受时间预算约束并建立置换表', () => {
  const board = emptyBoard();
  for (const [r, c, player] of [
    [7, 7, G.Config.BLACK],
    [7, 8, G.Config.WHITE],
    [8, 7, G.Config.BLACK],
    [6, 7, G.Config.WHITE],
    [8, 8, G.Config.BLACK],
    [6, 8, G.Config.WHITE],
  ]) board[r][c] = player;

  const result = G.AISearch.iterativeSearch(
    board,
    [],
    G.Config.BLACK,
    G.Config.AI_PERSONAS.BALANCED,
    { timeBudgetMs: 45, maxDepth: 6, candidateLimit: 7 },
  );

  assert.ok(result.move);
  assert.ok(result.nodes > 0);
  assert.ok(result.tableEntries >= 0);
  assert.ok(result.elapsedMs < 500);
});

test('幽灵变化线可延伸到多步而不污染原棋盘', () => {
  const board = emptyBoard();
  board[7][7] = G.Config.BLACK;
  board[7][8] = G.Config.WHITE;
  const before = G.Position.cloneBoard(board);

  const preview = G.AISearch.previewLine(
    board,
    [],
    8,
    8,
    G.Config.BLACK,
    G.Config.AI_PERSONAS.BALANCED,
    5,
  );

  assert.ok(preview);
  assert.ok(preview.line.length >= 3);
  assert.ok(preview.line.length <= 5);
  assert.deepEqual(board, before);
});
