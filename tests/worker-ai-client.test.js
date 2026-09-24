import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.Gomoku = { Services: {} };

await import('../js/config.js');
await import('../js/services/request-gate.js');
await import('../js/services/ai-client.js');
await import('../js/services/worker-ai-client.js');

const G = globalThis.Gomoku;

class FakeWorker {
  constructor({ slow = false } = {}) {
    this.listeners = { message: [], error: [] };
    this.slow = slow;
    this.terminated = false;
    queueMicrotask(() => this.emit('message', { data: { type: 'ready' } }));
  }

  addEventListener(type, handler) {
    this.listeners[type]?.push(handler);
  }

  emit(type, event) {
    for (const handler of this.listeners[type] || []) handler(event);
  }

  postMessage(message) {
    if (message.type !== 'request' || this.slow) return;
    queueMicrotask(() => {
      this.emit('message', {
        data: {
          type: 'progress',
          id: message.id,
          channel: message.channel,
          progress: {
            depth: 3,
            nodes: 240,
            elapsedMs: 18,
            bestMove: { r: 7, c: 7 },
            cacheHits: 4,
            tacticalNodes: 2,
          },
        },
      });
      this.emit('message', {
        data: {
          type: 'result',
          id: message.id,
          channel: message.channel,
          result: {
            move: { r: 7, c: 7 },
            search: { depth: 3, nodes: 240, elapsedMs: 18, cacheHits: 4, tacticalNodes: 2 },
          },
        },
      });
    });
  }

  terminate() {
    this.terminated = true;
  }
}

function analysisStub() {
  return {
    chooseMove: () => ({
      move: { r: 6, c: 6 },
      search: { depth: 1, nodes: 1, elapsedMs: 0 },
    }),
    candidates: () => [],
    ghost: () => null,
    heatmap: () => [],
    advantage: () => [],
  };
}

test('WorkerAIClient 使用 Worker 返回结果并上报搜索进度', async () => {
  let worker;
  const progress = [];
  const client = new G.Services.WorkerAIClient(
    analysisStub(),
    new G.Services.RequestGate(),
    {
      workerFactory: () => {
        worker = new FakeWorker();
        return worker;
      },
    },
  );

  const response = await client.chooseMove({
    board: [],
    moves: [],
    difficulty: G.Config.AI_DIFFICULTIES.NORMAL,
    player: G.Config.WHITE,
    persona: G.Config.AI_PERSONAS.BALANCED,
    onProgress: item => progress.push(item),
  });

  assert.equal(response.stale, false);
  assert.deepEqual(response.result.move, { r: 7, c: 7 });
  assert.equal(client.stats().mode, 'worker');
  assert.equal(client.stats().fallbackRequests, 0);
  assert.ok(progress.some(item => item.active && item.depth === 3));
  assert.equal(client.progress().active, false);
  assert.equal(worker.terminated, false);
});

test('WorkerAIClient 取消请求会真实终止旧 Worker 并返回 stale', async () => {
  const workers = [];
  const client = new G.Services.WorkerAIClient(
    analysisStub(),
    new G.Services.RequestGate(),
    {
      workerFactory: () => {
        const worker = new FakeWorker({ slow: true });
        workers.push(worker);
        return worker;
      },
    },
  );

  const pending = client.chooseMove({
    board: [],
    moves: [],
    difficulty: G.Config.AI_DIFFICULTIES.HARD,
    player: G.Config.WHITE,
    persona: G.Config.AI_PERSONAS.BALANCED,
  }, 'ai');

  await new Promise(resolve => setTimeout(resolve, 0));
  client.cancel('ai');
  const response = await pending;

  assert.equal(response.stale, true);
  assert.equal(response.result, null);
  assert.equal(workers[0].terminated, true);
  assert.ok(client.stats().workerRestarts >= 1);
});

test('Worker 初始化失败时自动回退 MainThreadAIClient', async () => {
  const client = new G.Services.WorkerAIClient(
    analysisStub(),
    new G.Services.RequestGate(),
    { workerFactory: () => { throw new Error('worker unavailable'); } },
  );

  const response = await client.chooseMove({
    board: [],
    moves: [],
    difficulty: G.Config.AI_DIFFICULTIES.NORMAL,
    player: G.Config.WHITE,
    persona: G.Config.AI_PERSONAS.BALANCED,
  });

  assert.equal(response.stale, false);
  assert.deepEqual(response.result.move, { r: 6, c: 6 });
  assert.equal(client.stats().mode, 'fallback');
  assert.ok(client.stats().fallbackRequests >= 1);
});
