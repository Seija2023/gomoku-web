import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.Gomoku = { AppCore: {} };

await import('../js/app/workspace-manager.js');

const G = globalThis.Gomoku;
const { Workspaces, Activities } = G.AppCore;

function controller(active = false) {
  return {
    state: { active },
    resets: 0,
    reset() {
      this.resets += 1;
      this.state.active = false;
    },
  };
}

function fixture(initialWorkspace = Workspaces.GAME) {
  const controllers = {
    review: controller(),
    branch: controller(),
    training: controller(),
    positionEditor: controller(),
    variation: controller(),
  };
  const changes = [];
  const manager = new G.AppCore.WorkspaceManager({
    controllers,
    initialWorkspace,
    onWorkspaceChange: value => changes.push(value),
  });
  return { manager, controllers, changes };
}

test('WorkspaceManager keeps normal workspace selection separate from special activity', () => {
  const { manager, controllers } = fixture(Workspaces.ANALYSIS);
  assert.equal(manager.activity(), Activities.GAME);
  assert.equal(manager.effectiveWorkspace(), Workspaces.ANALYSIS);

  controllers.training.state.active = true;
  assert.equal(manager.activity(), Activities.TRAINING);
  assert.equal(manager.effectiveWorkspace(), Workspaces.TRAINING);

  controllers.training.state.active = false;
  assert.equal(manager.effectiveWorkspace(), Workspaces.ANALYSIS);
});

test('special activity priority is deterministic', () => {
  const { manager, controllers } = fixture();
  controllers.review.state.active = true;
  controllers.training.state.active = true;
  controllers.positionEditor.state.active = true;
  controllers.variation.state.active = true;

  assert.equal(manager.activity(), Activities.VARIATION);
  assert.equal(manager.effectiveWorkspace(), Workspaces.LAB);

  controllers.variation.state.active = false;
  assert.equal(manager.activity(), Activities.POSITION_EDITOR);
});

test('workspace cannot be switched while a special activity owns the UI', () => {
  const { manager, controllers, changes } = fixture();
  assert.equal(manager.select(Workspaces.ANALYSIS), true);
  assert.deepEqual(changes, [Workspaces.ANALYSIS]);

  controllers.review.state.active = true;
  assert.equal(manager.select(Workspaces.TRAINING), false);
  assert.equal(manager.selectedWorkspace, Workspaces.ANALYSIS);
  assert.equal(manager.effectiveWorkspace(), Workspaces.ANALYSIS);
});

test('resetSpecialModes clears all controller modes centrally', () => {
  const { manager, controllers } = fixture();
  Object.values(controllers).forEach(item => { item.state.active = true; });

  manager.resetSpecialModes();

  for (const item of Object.values(controllers)) {
    assert.equal(item.state.active, false);
    assert.equal(item.resets, 1);
  }
  assert.equal(manager.activity(), Activities.GAME);
});
