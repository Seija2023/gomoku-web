import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.Gomoku = {};

await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/app/render-flags.js');
await import('../js/game/position.js');
await import('../js/game/history.js');
await import('../js/lab/variation-tree.js');
await import('../js/controllers/variation-controller.js');

const G = globalThis.Gomoku;

function makeRoot() {
  const board = G.Position.emptyBoard();
  board[7][7] = G.Config.BLACK;
  return { board, currentPlayer: G.Config.WHITE };
}

function makeStorage() {
  let value = null;
  return {
    saveVariationTree: payload => { value = structuredClone(payload); return true; },
    loadVariationTree: () => structuredClone(value),
    clearVariationTree: () => { value = null; return true; },
  };
}

test('VariationController 手动落子会新增节点、切换当前节点并持久化', () => {
  const storage = makeStorage();
  let refreshes = 0;
  const controller = new G.Controllers.VariationController({
    settings: { persona: G.Config.AI_PERSONAS.BALANCED },
    aiClient: { cancel: () => {} },
    storage,
    refresh: () => { refreshes += 1; },
    flags: G.AppCore.RenderFlags,
  });

  assert.equal(controller.start(makeRoot(), { rootLabel: '局面' }), true);
  assert.equal(controller.handleMove(7, 8), true);
  assert.equal(controller.state.tree.size, 2);
  assert.equal(controller.target().board[7][8], G.Config.WHITE);
  assert.notEqual(controller.state.tree.currentId, 'root');
  assert.ok(storage.loadVariationTree());
  assert.ok(refreshes >= 1);
});

test('VariationController AI 扩展一次生成多个候选分支并保存主变化', async () => {
  const storage = makeStorage();
  const aiClient = {
    cancel: () => {},
    candidates: () => [
      {
        r: 7, c: 8, score: 300,
        line: [
          { r: 7, c: 8, player: G.Config.WHITE },
          { r: 8, c: 8, player: G.Config.BLACK },
          { r: 6, c: 8, player: G.Config.WHITE },
        ],
      },
      {
        r: 6, c: 7, score: 250,
        line: [
          { r: 6, c: 7, player: G.Config.WHITE },
          { r: 6, c: 8, player: G.Config.BLACK },
        ],
      },
      {
        r: 8, c: 7, score: 200,
        line: [
          { r: 8, c: 7, player: G.Config.WHITE },
          { r: 8, c: 8, player: G.Config.BLACK },
        ],
      },
    ],
    chooseMove: async context => {
      context.onProgress?.({ depth: 3, nodes: 1200, bestMove: { r: 7, c: 8 } });
      return {
        stale: false,
        result: {
          move: { r: 7, c: 8 },
          principalVariation: [
            { r: 7, c: 8, player: G.Config.WHITE },
            { r: 8, c: 8, player: G.Config.BLACK },
            { r: 6, c: 8, player: G.Config.WHITE },
            { r: 6, c: 9, player: G.Config.BLACK },
          ],
          explanation: { score: 300 },
          search: { depth: 4, nodes: 2400 },
        },
      };
    },
  };

  const controller = new G.Controllers.VariationController({
    settings: { persona: G.Config.AI_PERSONAS.BALANCED },
    aiClient,
    storage,
    refresh: () => {},
    flags: G.AppCore.RenderFlags,
  });

  controller.start(makeRoot());
  assert.equal(await controller.expand(), true);

  const children = controller.state.tree.children('root');
  assert.equal(children.length, 3);
  assert.equal(children[0].source, 'ai');
  assert.match(children[0].label, /AI A/);
  assert.equal(controller.state.lastExpansion.depth, 4);
  assert.equal(controller.state.lastExpansion.nodes, 2400);
  assert.ok(controller.state.tree.size > 4);
  assert.ok(storage.loadVariationTree());
});

test('VariationController 可以恢复最近保存的变化树', () => {
  const storage = makeStorage();
  const client = { cancel: () => {} };
  const a = new G.Controllers.VariationController({
    settings: {},
    aiClient: client,
    storage,
    refresh: () => {},
    flags: G.AppCore.RenderFlags,
  });
  a.start(makeRoot());
  a.handleMove(7, 8);

  const b = new G.Controllers.VariationController({
    settings: {},
    aiClient: client,
    storage,
    refresh: () => {},
    flags: G.AppCore.RenderFlags,
  });
  assert.equal(b.resumeSaved(), true);
  assert.equal(b.state.tree.size, 2);
  assert.equal(b.target().board[7][8], G.Config.WHITE);
});
