import test from 'node:test';
import assert from 'node:assert/strict';

const data = new Map();
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: key => data.has(key) ? data.get(key) : null,
  setItem: (key, value) => data.set(key, String(value)),
  removeItem: key => data.delete(key),
};
await import('../js/config.js');
await import('../js/storage/storage.js');

const { Storage, Config } = globalThis.Gomoku;

test('未完成棋局可以保存与读取', () => {
  const snapshot = { moves: [{ r: 7, c: 7, player: 1 }], gameOver: false };
  assert.equal(Storage.saveCurrent(snapshot), true);
  assert.deepEqual(Storage.loadCurrent(), snapshot);
});

test('完成棋局不会留在当前存档', () => {
  Storage.saveCurrent({ moves: [{ r: 7, c: 7, player: 1 }], gameOver: false });
  Storage.saveCurrent({ moves: [{ r: 7, c: 7, player: 1 }], gameOver: true });
  assert.equal(Storage.loadCurrent(), null);
});

test('历史记录可写入和删除', () => {
  const record = { id: 'x', moves: [], winner: 1 };
  Storage.saveFinished(record);
  assert.equal(Storage.listHistory()[0].id, 'x');
  Storage.removeHistory('x');
  assert.equal(Storage.listHistory().some(item => item.id === 'x'), false);
});

test('智能分析设置可以持久化', () => {
  const settings = { difficulty: Config.AI_DIFFICULTIES.HARD, heatmap: true, heatmapMode: 'black' };
  assert.equal(Storage.saveSettings(settings), true);
  assert.deepEqual(Storage.loadSettings(), settings);
});
