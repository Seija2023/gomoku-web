import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/ai/evaluator.js');
await import('../js/ai/search.js');

const { AI, Config } = globalThis.Gomoku;
const emptyBoard = () => Array.from({ length: Config.SIZE }, () => Array(Config.SIZE).fill(0));

test('AI 空棋盘选择中心点', () => {
  const move = AI.chooseMove(emptyBoard(), [], () => 0);
  assert.deepEqual(move, { r: 7, c: 7 });
});

test('AI 优先完成自己的五连', () => {
  const board = emptyBoard();
  const moves = [];
  for (let c = 3; c <= 6; c += 1) {
    board[7][c] = Config.WHITE;
    moves.push({ r: 7, c, player: Config.WHITE });
  }
  board[7][2] = Config.BLACK;
  moves.push({ r: 7, c: 2, player: Config.BLACK });
  const detail = AI.chooseMoveDetailed(board, moves, Config.AI_DIFFICULTIES.HARD, Config.WHITE, () => 0);
  assert.deepEqual(detail.move, { r: 7, c: 7 });
  assert.match(detail.explanation.reason, /五连/);
});

test('AI 会阻挡玩家直接五连并给出解释', () => {
  const board = emptyBoard();
  const moves = [];
  for (let c = 4; c <= 7; c += 1) {
    board[8][c] = Config.BLACK;
    moves.push({ r: 8, c, player: Config.BLACK });
  }
  board[8][3] = Config.WHITE;
  moves.push({ r: 8, c: 3, player: Config.WHITE });
  const detail = AI.chooseMoveDetailed(board, moves, Config.AI_DIFFICULTIES.NORMAL, Config.WHITE, () => 0);
  assert.deepEqual(detail.move, { r: 8, c: 8 });
  assert.match(detail.explanation.reason, /阻止/);
  assert.equal(detail.candidates.length > 0, true);
});

test('简单与困难模式都只返回空位置', () => {
  const board = emptyBoard();
  board[7][7] = Config.BLACK;
  const moves = [{ r: 7, c: 7, player: Config.BLACK }];
  for (const difficulty of [Config.AI_DIFFICULTIES.EASY, Config.AI_DIFFICULTIES.HARD]) {
    const detail = AI.chooseMoveDetailed(board, moves, difficulty, Config.WHITE, () => 0);
    assert.equal(board[detail.move.r][detail.move.c], 0);
  }
});

test('AI 可以为黑棋进行分支推演', () => {
  const board = emptyBoard();
  board[7][7] = Config.WHITE;
  const moves = [{ r: 7, c: 7, player: Config.WHITE }];
  const detail = AI.chooseMoveDetailed(board, moves, Config.AI_DIFFICULTIES.NORMAL, Config.BLACK, () => 0);
  assert.ok(detail.move);
  assert.equal(board[detail.move.r][detail.move.c], 0);
});
