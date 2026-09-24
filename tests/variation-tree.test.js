import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.Gomoku = {};

await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/game/position.js');
await import('../js/game/history.js');
await import('../js/lab/variation-tree.js');

const G = globalThis.Gomoku;

function rootPosition() {
  const board = G.Position.emptyBoard();
  board[7][7] = G.Config.BLACK;
  return { board, currentPlayer: G.Config.WHITE };
}

test('VariationTree 支持同一父节点保存多个独立分支', () => {
  const tree = new G.Lab.VariationTree(rootPosition(), { rootLabel: '测试根局面' });
  const a = tree.addChild('root', { r: 7, c: 8, player: G.Config.WHITE }, { label: 'A线' });
  const b = tree.addChild('root', { r: 8, c: 8, player: G.Config.WHITE }, { label: 'B线' });

  assert.ok(a);
  assert.ok(b);
  assert.equal(tree.children('root').length, 2);

  tree.select(a.id);
  const a2 = tree.addChild(a.id, { r: 8, c: 8, player: G.Config.BLACK }, { label: 'A后续' });
  assert.ok(a2);

  const posA = tree.position(a2.id);
  const posB = tree.position(b.id);
  assert.equal(posA.board[7][8], G.Config.WHITE);
  assert.equal(posA.board[8][8], G.Config.BLACK);
  assert.equal(posB.board[8][8], G.Config.WHITE);
  assert.equal(posB.board[7][8], 0);
});

test('VariationTree 的命名、收藏和当前节点可无损持久化恢复', () => {
  const tree = new G.Lab.VariationTree(rootPosition());
  const child = tree.addChild('root', { r: 6, c: 7, player: G.Config.WHITE });
  tree.rename(child.id, '防守分支');
  tree.toggleFavorite(child.id);
  tree.select(child.id);

  const restored = G.Lab.VariationTree.restore(tree.serialize());
  assert.ok(restored);
  assert.equal(restored.currentId, child.id);
  assert.equal(restored.current().label, '防守分支');
  assert.equal(restored.current().favorite, true);
  assert.equal(restored.position().board[6][7], G.Config.WHITE);
});

test('VariationTree 拒绝循环或父子关系损坏的持久化数据', () => {
  const tree = new G.Lab.VariationTree(rootPosition());
  const child = tree.addChild('root', { r: 7, c: 8, player: G.Config.WHITE });
  const payload = tree.serialize();
  const raw = payload.nodes.find(node => node.id === child.id);
  raw.children = [child.id];

  assert.equal(G.Lab.VariationTree.restore(payload), null);
});

test('VariationTree 会复用同一父节点的相同落子而不是制造重复节点', () => {
  const tree = new G.Lab.VariationTree(rootPosition());
  const move = { r: 7, c: 8, player: G.Config.WHITE };
  const a = tree.addChild('root', move, { source: 'ai', score: 100 });
  const b = tree.addChild('root', move, { source: 'ai', score: 200 });

  assert.equal(a.id, b.id);
  assert.equal(tree.children('root').length, 1);
  assert.equal(tree.node(a.id).score, 200);
});
