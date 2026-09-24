import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.Gomoku = {};

await import('../js/config.js');
await import('../js/training/training-workflow.js');

const G = globalThis.Gomoku;

function fixture() {
  let scheduled = 0;
  let refreshed = 0;
  const trainingController = {
    state: { active: false, suspended: false, feedback: '' },
    start(puzzles, options) {
      this.state.active = true;
      this.last = { puzzles, options };
      return true;
    },
    next: () => true,
    exit() {
      if (!this.state.active && !this.state.suspended) return false;
      this.state.active = false;
      this.state.suspended = false;
      return true;
    },
  };
  const variationWorkflow = { startFromTraining: () => true };
  const game = { mode: G.Config.MODES.AI, currentPlayer: G.Config.BLACK, gameOver: false };
  const workflow = new G.Training.Workflow({
    game,
    gameController: {
      clearTimers: () => {},
      scheduleAiMove: () => { scheduled += 1; },
    },
    reviewController: { state: { active: false } },
    branchController: { state: { active: false } },
    trainingController,
    positionEditorController: { state: { active: false } },
    variationController: { state: { active: false } },
    variationWorkflow,
    panel: { hideResult: () => {}, showResult: () => {} },
    refresh: () => { refreshed += 1; },
    getPuzzles: () => [{ id: 'p1' }],
    getMistakes: () => [{ id: 'm1' }],
  });
  return { workflow, trainingController, game, variationWorkflow, values: () => ({ scheduled, refreshed }) };
}

test('TrainingWorkflow 将自适应与错题模式统一交给 Controller', () => {
  const { workflow, trainingController } = fixture();
  assert.equal(workflow.startAdaptive(), true);
  assert.equal(trainingController.last.options.mode, 'adaptive');
  assert.equal(trainingController.last.options.mistakes.length, 1);
});

test('TrainingWorkflow 支持单题错题和训练后变化树分析', () => {
  const { workflow, trainingController } = fixture();
  assert.equal(workflow.startOne('p1'), true);
  assert.equal(trainingController.last.options.puzzleId, 'p1');
  trainingController.state.feedback = '最佳';
  assert.equal(workflow.openVariation(), true);
});

test('退出训练时只在原对局需要 AI 落子时恢复 AI', () => {
  const { workflow, trainingController, game, values } = fixture();
  workflow.startAdaptive();
  game.currentPlayer = G.Config.WHITE;
  assert.equal(workflow.exit(), true);
  assert.equal(values().scheduled, 1);
  assert.equal(trainingController.state.active, false);
});
