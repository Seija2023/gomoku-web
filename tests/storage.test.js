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
await import('../js/storage/migrations.js');
await import('../js/storage/storage.js');

const { Storage, StorageMigrations, Config } = globalThis.Gomoku;

test('存储 schema 会迁移到当前版本', () => {
  assert.equal(Storage.SCHEMA_VERSION, StorageMigrations.CURRENT_SCHEMA);
  assert.equal(JSON.parse(data.get(StorageMigrations.SCHEMA_KEY)), StorageMigrations.CURRENT_SCHEMA);
});

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

test('v2.3 设置保持兼容并可持久化', () => {
  const settings = {
    difficulty: Config.AI_DIFFICULTIES.HARD,
    persona: Config.AI_PERSONAS.ATTACK,
    heatmap: true,
    heatmapMode: 'black',
    ghost: false,
  };
  assert.equal(Storage.saveSettings(settings), true);
  const loaded = Storage.loadSettings();
  assert.equal(loaded.difficulty, settings.difficulty);
  assert.equal(loaded.persona, settings.persona);
  assert.equal(loaded.ghost, false);
});

test('训练间隔复习进度可以持久化', () => {
  const progress = { p1: { repetitions: 2, dueAt: 123 } };
  assert.equal(Storage.saveTrainingProgress(progress), true);
  assert.deepEqual(Storage.loadTrainingProgress(), progress);
});


test('自定义局面即使 continuation moves 为空也会保存', () => {
  const board = Array.from({ length: 15 }, () => Array(15).fill(0));
  board[7][7] = 1;
  const snapshot = {
    version: 1,
    mode: 'pvp',
    currentPlayer: 2,
    moves: [],
    gameOver: false,
    winner: 0,
    customPosition: true,
    initialBoard: board,
    initialPlayer: 2,
  };

  assert.equal(Storage.saveCurrent(snapshot), true);
  assert.deepEqual(Storage.loadCurrent(), snapshot);
});


test('变化树会独立持久化并可清除', () => {
  const payload = {
    version: 1,
    rootBoard: Array.from({ length: 15 }, () => Array(15).fill(0)),
    rootPlayer: Config.BLACK,
    nodes: [{ id: 'root', parentId: null, children: [] }],
  };
  assert.equal(Storage.saveVariationTree(payload), true);
  assert.deepEqual(Storage.loadVariationTree(), payload);
  assert.equal(Storage.clearVariationTree(), true);
  assert.equal(Storage.loadVariationTree(), null);
});
