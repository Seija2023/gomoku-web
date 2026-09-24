import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/game/position.js');

const { Config, Position } = globalThis.Gomoku;

test('Position 生成稳定局面 key 与下一手', () => {
  const moves = [
    { r: 7, c: 7, player: Config.BLACK },
    { r: 7, c: 8, player: Config.WHITE },
  ];
  const position = Position.fromMoves(moves);
  assert.ok(position);
  assert.equal(position.currentPlayer, Config.BLACK);
  assert.equal(position.board[7][7], Config.BLACK);
  assert.equal(position.board[7][8], Config.WHITE);
  assert.equal(Position.keyFromMoves(moves, Config.BLACK), position.key);
});

test('Position 拒绝错误轮次和终局后的额外落子', () => {
  assert.equal(Position.validateMoves([
    { r: 7, c: 7, player: Config.WHITE },
  ]).ok, false);

  const winning = [
    {r:7,c:3,player:Config.BLACK},{r:0,c:0,player:Config.WHITE},
    {r:7,c:4,player:Config.BLACK},{r:0,c:1,player:Config.WHITE},
    {r:7,c:5,player:Config.BLACK},{r:0,c:2,player:Config.WHITE},
    {r:7,c:6,player:Config.BLACK},{r:0,c:3,player:Config.WHITE},
    {r:7,c:7,player:Config.BLACK},
    {r:1,c:1,player:Config.WHITE},
  ];
  const result = Position.validateMoves(winning);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'moves-after-terminal');
});


test('Position 支持直接从 board 构造自由局面并检测终局', () => {
  const board = Position.emptyBoard();
  board[7][7] = Config.BLACK;
  board[8][8] = Config.WHITE;

  const position = Position.fromBoard(board, Config.WHITE);
  assert.ok(position);
  assert.equal(position.currentPlayer, Config.WHITE);
  assert.equal(position.board[7][7], Config.BLACK);
  assert.equal(Position.countStones(position.board), 2);
  assert.equal(position.key, Position.boardKey(position.board, Config.WHITE));

  for (let c = 3; c <= 6; c += 1) board[7][c] = Config.BLACK;
  const inspection = Position.inspectBoard(board);
  assert.equal(inspection.terminal, true);
  assert.equal(inspection.winner, Config.BLACK);
});

test('Position 拒绝尺寸错误或非法棋子值的自定义棋盘', () => {
  assert.equal(Position.validateBoard([[0]]).ok, false);
  const board = Position.emptyBoard();
  board[0][0] = 9;
  assert.equal(Position.validateBoard(board).ok, false);
  assert.equal(Position.fromBoard(board, Config.BLACK), null);
});
