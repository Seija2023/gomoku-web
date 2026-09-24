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
await import('../js/training/scheduler.js');

const { Config, Puzzles, Profile, TrainingScheduler } = globalThis.Gomoku;

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

test('间隔复习答错会很快再出现，连续答对会拉长间隔', () => {
  const now = 1_000_000;
  let progress = {};
  progress = TrainingScheduler.update(progress, 'p1', false, now);
  assert.equal(progress.p1.dueAt, now + 5 * 60 * 1000);
  progress = TrainingScheduler.update(progress, 'p1', true, now);
  const firstDue = progress.p1.dueAt;
  progress = TrainingScheduler.update(progress, 'p1', true, now);
  assert.ok(progress.p1.dueAt > firstDue);
});
