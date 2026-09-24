import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/ai/evaluator.js');
await import('../js/game/history.js');
await import('../js/analysis/analyzer.js');

const { Config, History, Analyzer } = globalThis.Gomoku;

test('棋谱坐标使用 A-O 和 1-15', () => {
  assert.equal(History.coordinate({ r: 0, c: 0 }), 'A1');
  assert.equal(History.coordinate({ r: 14, c: 14 }), 'O15');
});

test('复盘棋盘只重建到指定手数', () => {
  const moves = [
    { r: 7, c: 7, player: Config.BLACK },
    { r: 8, c: 8, player: Config.WHITE },
  ];
  const board = History.boardAt(moves, 1);
  assert.equal(board[7][7], Config.BLACK);
  assert.equal(board[8][8], 0);
});

test('分析器能识别最终五连并生成关键手索引', () => {
  const moves = [
    {r:7,c:3,player:Config.BLACK},{r:0,c:0,player:Config.WHITE},
    {r:7,c:4,player:Config.BLACK},{r:0,c:1,player:Config.WHITE},
    {r:7,c:5,player:Config.BLACK},{r:0,c:2,player:Config.WHITE},
    {r:7,c:6,player:Config.BLACK},{r:0,c:3,player:Config.WHITE},
    {r:7,c:7,player:Config.BLACK}
  ];
  const analysis = Analyzer.analyze({ moves, winner: Config.BLACK, winningLine: [{r:7,c:3},{r:7,c:4},{r:7,c:5},{r:7,c:6},{r:7,c:7}] });
  assert.equal(analysis.winnerText, '黑棋获胜');
  assert.equal(analysis.direction, '横向');
  assert.equal(analysis.moments.at(-1).label, '完成五连');
  assert.equal(analysis.keyIndices.includes(9), true);
});
