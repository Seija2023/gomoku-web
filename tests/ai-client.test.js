import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.Gomoku = { Services: {} };

await import('../js/services/request-gate.js');
await import('../js/services/ai-client.js');

const G = globalThis.Gomoku;

test('AIClient returns analysis result through stable interface', async () => {
  const analysis = {
    chooseMove: () => ({ move: { r: 7, c: 7 }, explanation: { reason: 'test' } }),
  };
  const gate = new G.Services.RequestGate();
  const client = new G.Services.MainThreadAIClient(analysis, gate);

  const response = await client.chooseMove({
    board: [],
    moves: [],
    difficulty: 'normal',
    player: 2,
    persona: 'balanced',
  });

  assert.equal(response.stale, false);
  assert.deepEqual(response.result.move, { r: 7, c: 7 });
  assert.equal(client.stats().chooseRequests, 1);
});

test('AIClient cancellation invalidates an older pending request', async () => {
  let calls = 0;
  const analysis = {
    chooseMove: () => {
      calls += 1;
      return { move: { r: 7, c: 7 } };
    },
  };
  const gate = new G.Services.RequestGate();
  const client = new G.Services.MainThreadAIClient(analysis, gate);

  const pending = client.chooseMove({
    board: [],
    moves: [],
    difficulty: 'hard',
    player: 2,
    persona: 'attack',
  }, 'ai');

  client.cancel('ai');
  const response = await pending;

  assert.equal(response.stale, true);
  assert.equal(response.result, null);
  assert.equal(calls, 0);
  assert.equal(client.stats().staleResults, 1);
});
