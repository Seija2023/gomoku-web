import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;

await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/game/position.js');
await import('../js/ai/evaluator.js');
await import('../js/ai/search.js');
await import('../js/game/history.js');
await import('../js/analysis/advantage.js');
await import('../js/analysis/openings.js');
await import('../js/training/scheduler.js');
await import('../js/share/codec.js');

const { Config, Advantage, Openings, ShareCodec } = globalThis.Gomoku;

const moves = [
  { r: 7, c: 7, player: Config.BLACK },
  { r: 7, c: 8, player: Config.WHITE },
  { r: 8, c: 7, player: Config.BLACK },
];

test('棋形优势曲线覆盖开局到当前每一手', () => {
  const points = Advantage.series(moves);
  assert.equal(points.length, moves.length + 1);
  assert.equal(points[0].value, 0);
  for (const point of points) assert.ok(point.value >= -100 && point.value <= 100);
});

test('个人开局库会合并相同前缀并统计结果', () => {
  const records = [
    { moves, winner: Config.BLACK },
    { moves: [...moves, { r: 8, c: 8, player: Config.WHITE }], winner: Config.WHITE },
  ];
  const openings = Openings.build(records, 3);
  assert.equal(openings[0].uses, 2);
  assert.equal(openings[0].wins, 1);
  assert.equal(openings[0].losses, 1);
});

test('分享棋局编码可以无损还原', () => {
  const encoded = ShareCodec.encode({
    kind: 'challenge',
    moves,
    index: 2,
    winner: 0,
    mode: Config.MODES.PVP,
  });
  const decoded = ShareCodec.decode(encoded);
  assert.equal(decoded.kind, 'challenge');
  assert.equal(decoded.index, 2);
  assert.deepEqual(decoded.moves, moves);
  assert.equal(ShareCodec.makeHash(decoded).startsWith('#challenge='), true);
});

test('分享解码拒绝重复落点和错误轮次', () => {
  const bad = ShareCodec.encode({
    kind: 'game',
    moves: [
      { r: 7, c: 7, player: Config.BLACK },
      { r: 7, c: 7, player: Config.WHITE },
    ],
    winner: 0,
  });
  assert.equal(ShareCodec.decode(bad), null);

  const badTurn = ShareCodec.encode({
    kind: 'game',
    moves: [
      { r: 7, c: 7, player: Config.WHITE },
    ],
    winner: 0,
  });
  assert.equal(ShareCodec.decode(badTurn), null);
});
