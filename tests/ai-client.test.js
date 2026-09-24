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


test('AIClient exposes asynchronous counterfactual comparison through the same boundary', async () => {
  G.Services.CounterfactualService = class {
    compare(context) {
      return {
        userLine: { ...context.userMove, adjustedScore: 10 },
        recommendedLine: { r: 7, c: 7, adjustedScore: 20 },
        scoreDelta: 10,
      };
    }
  };

  const gate = new G.Services.RequestGate();
  const client = new G.Services.MainThreadAIClient({}, gate);
  const response = await client.compareMove({
    board: [],
    moves: [],
    player: 1,
    persona: 'balanced',
    userMove: { r: 6, c: 6 },
  });

  assert.equal(response.stale, false);
  assert.equal(response.result.scoreDelta, 10);
  assert.equal(client.stats().compareRequests, 1);
  assert.equal(client.stats().requests.counterfactual, 1);
});


test('MainThreadAIClient records iterative depth history for Search Inspector', async () => {
  const analysis = {
    chooseMove: (board, moves, difficulty, player, persona, rng, options) => {
      options.onProgress?.({
        depth: 1,
        nodes: 20,
        elapsedMs: 2,
        score: 100,
        bestMove: { r: 7, c: 7 },
      });
      options.onProgress?.({
        depth: 2,
        nodes: 90,
        elapsedMs: 5,
        score: 130,
        bestMove: { r: 7, c: 8 },
      });
      return {
        move: { r: 7, c: 8 },
        search: { depth: 2, nodes: 90, elapsedMs: 5, cacheHits: 3, cutoffs: 4 },
      };
    },
  };
  const client = new G.Services.MainThreadAIClient(analysis, new G.Services.RequestGate());
  await client.chooseMove({
    board: [],
    moves: [],
    difficulty: 'normal',
    player: 2,
    persona: 'balanced',
  }, 'variation');

  const trace = client.searchTrace('variation');
  assert.equal(trace.length, 2);
  assert.equal(trace[0].depth, 1);
  assert.equal(trace[1].depth, 2);
  assert.equal(trace[1].score, 130);
  assert.equal(client.stats().requests.variation, 1);
});
