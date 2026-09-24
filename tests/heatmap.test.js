import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/ai/evaluator.js');
await import('../js/analysis/heatmap.js');

const { Config, Heatmap } = globalThis.Gomoku;
const emptyBoard = () => Array.from({ length: Config.SIZE }, () => Array(Config.SIZE).fill(0));

test('热力图只返回空交叉点并带等级', () => {
  const board = emptyBoard();
  board[7][7] = Config.BLACK;
  const moves = [{ r: 7, c: 7, player: Config.BLACK }];
  const points = Heatmap.generate(board, moves, 'combined');
  assert.ok(points.length > 0);
  for (const point of points) {
    assert.equal(board[point.r][point.c], 0);
    assert.ok(point.level >= 1 && point.level <= 4);
  }
});

test('热力图支持黑棋与白棋视角', () => {
  const board = emptyBoard();
  board[7][7] = Config.BLACK;
  const moves = [{ r: 7, c: 7, player: Config.BLACK }];
  assert.ok(Heatmap.generate(board, moves, 'black').length);
  assert.ok(Heatmap.generate(board, moves, 'white').length);
});
