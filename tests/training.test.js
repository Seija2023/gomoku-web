import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/ai/evaluator.js');
await import('../js/game/history.js');
await import('../js/analysis/analyzer.js');
await import('../js/training/puzzles.js');
await import('../js/training/profile.js');

const { Config, Puzzles, Profile } = globalThis.Gomoku;

function record() {
  return {
    id: 'demo',
    mode: Config.MODES.AI,
    winner: Config.BLACK,
    winningLine: [{r:7,c:3},{r:7,c:4},{r:7,c:5},{r:7,c:6},{r:7,c:7}],
    moves: [
      {r:7,c:3,player:Config.BLACK},{r:0,c:0,player:Config.WHITE},
      {r:7,c:4,player:Config.BLACK},{r:0,c:1,player:Config.WHITE},
      {r:7,c:5,player:Config.BLACK},{r:0,c:2,player:Config.WHITE},
      {r:7,c:6,player:Config.BLACK},{r:0,c:3,player:Config.WHITE},
      {r:7,c:7,player:Config.BLACK}
    ],
  };
}

test('历史棋局可以生成残局训练题', () => {
  const puzzles = Puzzles.generate([record()]);
  assert.ok(puzzles.length > 0);
  const puzzle = puzzles.at(-1);
  assert.ok(puzzle.prefixMoves.length < record().moves.length);
  assert.equal(Puzzles.check(puzzle, puzzle.expected.r, puzzle.expected.c).correct, true);
});

test('玩家画像按人机历史统计', () => {
  const profile = Profile.compute([record()]);
  assert.equal(profile.games, 1);
  assert.equal(profile.wins, 1);
  assert.ok(profile.centerRate >= 0 && profile.centerRate <= 100);
});
