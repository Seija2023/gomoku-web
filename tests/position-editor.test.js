import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.Gomoku = {};

await import('../js/config.js');
await import('../js/core/rules.js');
await import('../js/app/render-flags.js');
await import('../js/game/position.js');
await import('../js/game/editable-position.js');
await import('../js/controllers/position-editor-controller.js');

const G = globalThis.Gomoku;

test('EditablePosition 支持自由摆黑白棋、擦除、清空与恢复', () => {
  const board = G.Position.emptyBoard();
  board[7][7] = G.Config.BLACK;
  const editor = new G.EditablePosition({ board, currentPlayer: G.Config.WHITE });

  assert.equal(editor.place(7, 8, G.Config.WHITE), true);
  assert.equal(editor.board[7][8], G.Config.WHITE);
  assert.equal(editor.erase(7, 7), true);
  assert.equal(editor.board[7][7], 0);

  editor.clear();
  assert.equal(G.Position.countStones(editor.board), 0);

  assert.equal(editor.restore(), true);
  assert.equal(editor.board[7][7], G.Config.BLACK);
  assert.equal(editor.currentPlayer, G.Config.WHITE);
});

test('PositionEditorController 独立管理工具、下一手与分析开关', () => {
  let refreshes = 0;
  const controller = new G.Controllers.PositionEditorController({
    refresh: () => { refreshes += 1; },
    flags: G.AppCore.RenderFlags,
  });

  assert.equal(controller.start({
    board: G.Position.emptyBoard(),
    currentPlayer: G.Config.BLACK,
  }), true);

  controller.setTool('white');
  controller.handleCell(6, 6);
  assert.equal(controller.target().board[6][6], G.Config.WHITE);

  controller.setTool('erase');
  controller.handleCell(6, 6);
  assert.equal(controller.target().board[6][6], 0);

  controller.setNextPlayer(G.Config.WHITE);
  assert.equal(controller.target().currentPlayer, G.Config.WHITE);

  controller.toggleAnalysis();
  assert.equal(controller.state.analysisEnabled, true);
  assert.ok(refreshes >= 4);
});

test('已有五连的自由摆局仍可编辑，但不能直接开始对局', () => {
  const board = G.Position.emptyBoard();
  for (let c = 3; c <= 7; c += 1) board[7][c] = G.Config.BLACK;

  const controller = new G.Controllers.PositionEditorController({
    refresh: () => {},
    flags: G.AppCore.RenderFlags,
  });
  controller.start({ board, currentPlayer: G.Config.WHITE });

  assert.equal(controller.target().gameOver, false);
  assert.equal(controller.target().terminal, true);
  assert.equal(controller.canStart(), false);

  controller.setTool('erase');
  controller.handleCell(7, 7);
  assert.equal(controller.canStart(), true);
});


test('PositionEditorController 比较模式不会改棋盘，并保存异步分析结果', async () => {
  let refreshes = 0;
  const aiClient = {
    cancel: () => {},
    compareMove: async context => ({
      stale: false,
      result: {
        player: context.player,
        userLine: { r: context.userMove.r, c: context.userMove.c, adjustedScore: 100 },
        recommendedLine: { r: 7, c: 7, adjustedScore: 200 },
        scoreDelta: 100,
        reasons: ['推荐手综合评分更高。'],
        sameMove: false,
      },
    }),
  };
  const controller = new G.Controllers.PositionEditorController({
    refresh: () => { refreshes += 1; },
    flags: G.AppCore.RenderFlags,
    aiClient,
    settings: { persona: G.Config.AI_PERSONAS.BALANCED },
  });

  const board = G.Position.emptyBoard();
  board[6][6] = G.Config.BLACK;
  controller.start({ board, currentPlayer: G.Config.WHITE });
  controller.toggleCompareMode();

  const before = G.Position.cloneBoard(controller.target().board);
  assert.equal(await controller.handleCell(8, 8), true);
  assert.deepEqual(controller.target().board, before);
  assert.equal(controller.state.comparison.userLine.r, 8);
  assert.equal(controller.state.comparison.recommendedLine.r, 7);
  assert.equal(controller.state.comparing, false);
  assert.ok(refreshes >= 3);
});
