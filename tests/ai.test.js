import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/ai/evaluator.js');

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
  assert.deepEqual(AI.chooseMove(board, moves, () => 0), { r: 7, c: 7 });
});

test('AI 会阻挡玩家直接五连', () => {
  const board = emptyBoard();
  const moves = [];
  for (let c = 4; c <= 7; c += 1) {
    board[8][c] = Config.BLACK;
    moves.push({ r: 8, c, player: Config.BLACK });
  }
  board[8][3] = Config.WHITE;
  moves.push({ r: 8, c: 3, player: Config.WHITE });
  assert.deepEqual(AI.chooseMove(board, moves, () => 0), { r: 8, c: 8 });
});

test('AI 不会返回已占用位置', () => {
  const board = emptyBoard();
  board[7][7] = Config.BLACK;
  const move = AI.chooseMove(board, [{ r: 7, c: 7, player: Config.BLACK }], () => 0);
  assert.equal(board[move.r][move.c], 0);
});
