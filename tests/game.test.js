import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/game/game.js');

const { Game, Config } = globalThis.Gomoku;

test('落子后轮到另一方且不能重复占位', () => {
  const game = new Game.Game();
  assert.equal(game.play(7, 7).ok, true);
  assert.equal(game.currentPlayer, Config.WHITE);
  assert.equal(game.play(7, 7).ok, false);
});

test('双人模式悔棋恢复被撤销方行动', () => {
  const game = new Game.Game();
  game.play(7, 7);
  game.play(7, 8);
  assert.equal(game.undo(), 1);
  assert.equal(game.currentPlayer, Config.WHITE);
  assert.equal(game.board[7][8], 0);
});

test('人机模式悔棋回退玩家和电脑一整轮', () => {
  const game = new Game.Game();
  game.setMode(Config.MODES.AI);
  game.play(7, 7);
  game.play(7, 8);
  assert.equal(game.undo(), 2);
  assert.equal(game.moves.length, 0);
  assert.equal(game.currentPlayer, Config.BLACK);
});

test('完成五连后游戏结束', () => {
  const game = new Game.Game();
  const black = [[7,3],[7,4],[7,5],[7,6],[7,7]];
  const white = [[0,0],[0,1],[0,2],[0,3]];
  let result;
  for (let i = 0; i < black.length; i += 1) {
    result = game.play(...black[i]);
    if (i < white.length) game.play(...white[i]);
  }
  assert.equal(result.win, true);
  assert.equal(game.gameOver, true);
});
