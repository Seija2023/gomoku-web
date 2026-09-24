import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.Gomoku = {};

await import('../js/app/render-flags.js');
await import('../js/services/request-gate.js');

const G = globalThis.Gomoku;

test('RenderFlags 可以独立组合和检测区域刷新', () => {
  const { RenderFlags, hasRenderFlag } = G.AppCore;
  const mask = RenderFlags.BOARD | RenderFlags.STATUS;
  assert.equal(hasRenderFlag(mask, RenderFlags.BOARD), true);
  assert.equal(hasRenderFlag(mask, RenderFlags.STATUS), true);
  assert.equal(hasRenderFlag(mask, RenderFlags.ANALYSIS), false);
  assert.equal((mask & RenderFlags.ALL), mask);
});

test('RequestGate 会让旧请求自动失效', () => {
  const gate = new G.Services.RequestGate();
  const first = gate.next('ai');
  assert.equal(gate.isCurrent('ai', first), true);
  const second = gate.next('ai');
  assert.equal(gate.isCurrent('ai', first), false);
  assert.equal(gate.isCurrent('ai', second), true);
  gate.invalidate('ai');
  assert.equal(gate.isCurrent('ai', second), false);
});

test('DerivedService 复用历史派生数据并单独刷新训练统计', async () => {
  let puzzleCalls = 0;
  let profileCalls = 0;
  let openingCalls = 0;
  let trainingCalls = 0;
  let mistakeCalls = 0;
  let adaptiveCalls = 0;

  G.MistakeMiner = { mine: () => { mistakeCalls += 1; return []; } };
  G.AdaptiveTraining = { summary: () => {
    adaptiveCalls += 1;
    return { categories: [], recentMistakes: [], trainableMistakes: 0, totalMistakes: 0, totalAttempts: 0, accuracy: 0 };
  } };

  G.Puzzles = { generate: records => { puzzleCalls += 1; return records.map(r => ({ id: r.id })); } };
  G.Profile = { compute: () => { profileCalls += 1; return { games: 1 }; } };
  G.Openings = { build: () => { openingCalls += 1; return [{ label: 'H8' }]; } };
  G.TrainingScheduler = { stats: (puzzles, progress) => {
    trainingCalls += 1;
    return { total: puzzles.length, due: Object.keys(progress).length, weak: 0, mastered: 0 };
  } };

  await import('../js/services/derived-service.js');
  const service = new G.Services.DerivedService();
  const records = [{ id: 'a', finishedAt: 'x', moves: [{ r: 7, c: 7 }], winner: 1, mode: 'ai' }];

  const first = service.training(records, {});
  const second = service.training(records, {});
  assert.deepEqual(second.profile, first.profile);
  assert.equal(puzzleCalls, 1);
  assert.equal(profileCalls, 1);
  assert.equal(openingCalls, 1);
  assert.equal(trainingCalls, 1);
  assert.equal(mistakeCalls, 1);
  assert.equal(adaptiveCalls, 1);

  service.invalidateTraining();
  service.training(records, { p1: { dueAt: 1 } });
  assert.equal(puzzleCalls, 1);
  assert.equal(profileCalls, 1);
  assert.equal(openingCalls, 1);
  assert.equal(trainingCalls, 2);
  assert.equal(mistakeCalls, 1);
  assert.equal(adaptiveCalls, 2);

  service.invalidateHistory();
  service.training([{ ...records[0], id: 'b' }], {});
  assert.equal(puzzleCalls, 2);
  assert.equal(profileCalls, 2);
  assert.equal(openingCalls, 2);
  assert.equal(mistakeCalls, 2);
});
