import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.location = { href: 'https://example.test/game#old' };
globalThis.Gomoku = {
  ShareCodec: {
    makeHash: () => '#share-payload',
  },
};

await import('../js/platform/share-adapter.js');
await import('../js/controllers/share-controller.js');

const { Platform, Controllers } = globalThis.Gomoku;

test('ShareAdapter prefers Clipboard API when available', async () => {
  let copied = null;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText: async value => { copied = value; },
      },
    },
  });

  const adapter = new Platform.ShareAdapter();
  assert.equal(await adapter.copyText('hello'), true);
  assert.equal(copied, 'hello');
});

test('ShareAdapter reports native share success and cancellation separately', async () => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      share: async () => {},
    },
  });

  const adapter = new Platform.ShareAdapter();
  assert.deepEqual(
    await adapter.share({ title: 'x', text: 'y', url: 'https://example.test' }),
    { handled: true, shared: true },
  );

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      share: async () => {
        const error = new Error('cancel');
        error.name = 'AbortError';
        throw error;
      },
    },
  });

  assert.deepEqual(
    await adapter.share({ title: 'x', text: 'y', url: 'https://example.test' }),
    { handled: true, shared: false },
  );
});

test('ShareController delegates platform behavior instead of touching DOM itself', async () => {
  const notices = [];
  const adapter = {
    share: async () => ({ handled: false, shared: false }),
    copyText: async value => value.endsWith('#share-payload'),
  };
  const controller = new Controllers.ShareController({
    adapter,
    insights: { showShareNotice: value => notices.push(value) },
  });

  assert.equal(await controller.share({ kind: 'game' }, '测试'), true);
  assert.deepEqual(notices, ['分享链接已复制。']);
});
