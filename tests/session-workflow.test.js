import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.location = { hash: '', pathname: '/', search: '' };
globalThis.history = { replaceState: () => {} };
globalThis.Gomoku = {
  Config: {
    WHITE: 2,
    MODES: { PVP: 'pvp', AI: 'ai' },
  },
  AppCore: {
    Activities: {
      GAME: 'game',
      REVIEW: 'review',
      BRANCH: 'branch',
      TRAINING: 'training',
      POSITION_EDITOR: 'position-editor',
      VARIATION: 'variation',
    },
  },
};

await import('../js/app/session-workflow.js');
const G = globalThis.Gomoku;

function fixture() {
  let refreshes = 0;
  let aiSchedules = 0;
  let mode = G.Config.MODES.PVP;
  const game = {
    mode,
    currentPlayer: 1,
    gameOver: false,
    customPosition: false,
    resetCalls: 0,
    reset() { this.resetCalls += 1; },
    setMode(next) { this.mode = next; },
    loadPosition() { return true; },
    snapshot: () => ({ moves: [], customPosition: true }),
  };
  const workspace = {
    activity: G.AppCore.Activities.GAME,
    canEnterFromGame() { return this.activity === G.AppCore.Activities.GAME; },
    isActivity(value) { return this.activity === value; },
    resetSpecialModesCalls: 0,
    resetSpecialModes() { this.resetSpecialModesCalls += 1; this.activity = G.AppCore.Activities.GAME; },
  };
  const reviewController = {
    startCalls: 0,
    resetCalls: 0,
    start() { this.startCalls += 1; workspace.activity = G.AppCore.Activities.REVIEW; },
    reset() { this.resetCalls += 1; workspace.activity = G.AppCore.Activities.GAME; },
    exit: () => ({ exited: true, shared: false }),
    resume: () => { workspace.activity = G.AppCore.Activities.REVIEW; },
  };
  const branchController = {
    startShared: () => { workspace.activity = G.AppCore.Activities.BRANCH; return true; },
    exit: () => ({ exited: true, shared: true }),
  };
  const positionEditorController = {
    state: { comparing: false },
    start: () => { workspace.activity = G.AppCore.Activities.POSITION_EDITOR; return true; },
    exit: () => { workspace.activity = G.AppCore.Activities.GAME; return true; },
    canStart: () => true,
    target: () => ({ board: [], currentPlayer: 1 }),
  };
  const workflow = new G.AppCore.SessionWorkflow({
    game,
    gameController: {
      clearTimers: () => {},
      resetMetadata: () => {},
      scheduleAiMove: () => { aiSchedules += 1; },
    },
    workspace,
    reviewController,
    branchController,
    positionEditorController,
    panel: { hideResult: () => {}, showResult: () => {} },
    boardView: { clearGhost: () => {} },
    storage: { clearCurrent: () => {}, saveCurrent: () => {} },
    refresh: () => { refreshes += 1; },
  });
  return { workflow, game, workspace, reviewController, values: () => ({ refreshes, aiSchedules }) };
}

test('SessionWorkflow blocks normal transitions while special activity is active', () => {
  const { workflow, workspace, reviewController } = fixture();
  workspace.activity = G.AppCore.Activities.TRAINING;
  assert.equal(workflow.startReview(), false);
  assert.equal(workflow.setMode(G.Config.MODES.AI), false);
  assert.equal(reviewController.startCalls, 0);
});

test('SessionWorkflow enters review and editor through unified workspace gate', () => {
  const { workflow, workspace, reviewController } = fixture();
  assert.equal(workflow.startReview(), true);
  assert.equal(reviewController.startCalls, 1);
  assert.equal(workspace.activity, G.AppCore.Activities.REVIEW);

  workspace.activity = G.AppCore.Activities.GAME;
  assert.equal(workflow.startPositionEditor(), true);
  assert.equal(workspace.activity, G.AppCore.Activities.POSITION_EDITOR);
});

test('SessionWorkflow restart centrally resets special modes and game state', () => {
  const { workflow, game, workspace, values } = fixture();
  workspace.activity = G.AppCore.Activities.VARIATION;
  assert.equal(workflow.restart(), true);
  assert.equal(workspace.resetSpecialModesCalls, 1);
  assert.equal(game.resetCalls, 1);
  assert.ok(values().refreshes >= 1);
});

test('exiting to an AI white turn resumes local AI exactly once', () => {
  const { workflow, game, workspace, values } = fixture();
  workspace.activity = G.AppCore.Activities.POSITION_EDITOR;
  game.mode = G.Config.MODES.AI;
  game.currentPlayer = G.Config.WHITE;

  assert.equal(workflow.exitPositionEditor(), true);
  assert.equal(values().aiSchedules, 1);
});
