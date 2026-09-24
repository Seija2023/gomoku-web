import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../js/config.js');
await import('../js/core/rules.js');

const { Rules, Config } = globalThis.Gomoku;
const emptyBoard = () => Array.from({ length: Config.SIZE }, () => Array(Config.SIZE).fill(0));

test('横向五连判胜并返回胜利线', () => {
  const board = emptyBoard();
  for (let c = 2; c <= 6; c += 1) board[7][c] = Config.BLACK;
  assert.equal(Rules.hasWon(board, 7, 4, Config.BLACK), true);
  assert.equal(Rules.findWinningLine(board, 7, 4, Config.BLACK).length, 5);
});

test('纵向五连判胜', () => {
  const board = emptyBoard();
  for (let r = 1; r <= 5; r += 1) board[r][9] = Config.WHITE;
  assert.equal(Rules.hasWon(board, 3, 9, Config.WHITE), true);
});

test('两种斜线均可判胜', () => {
  const boardA = emptyBoard();
  const boardB = emptyBoard();
  for (let i = 0; i < 5; i += 1) {
    boardA[3 + i][4 + i] = Config.BLACK;
    boardB[3 + i][10 - i] = Config.WHITE;
  }
  assert.equal(Rules.hasWon(boardA, 5, 6, Config.BLACK), true);
  assert.equal(Rules.hasWon(boardB, 5, 8, Config.WHITE), true);
});

test('四连不会误判为胜利', () => {
  const board = emptyBoard();
  for (let c = 0; c < 4; c += 1) board[0][c] = Config.BLACK;
  assert.equal(Rules.hasWon(board, 0, 2, Config.BLACK), false);
  assert.equal(Rules.findWinningLine(board, 0, 2, Config.BLACK), null);
});
