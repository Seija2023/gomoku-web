import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
  '../js/config.js',
  '../js/core/rules.js',
  '../js/app/render-flags.js',
  '../js/app/workspace-manager.js',
  '../js/app/session-workflow.js',
  '../js/game/position.js',
  '../js/game/editable-position.js',
  '../js/ai/evaluator.js',
  '../js/ai/search.js',
  '../js/ai/worker-entry.js',
  '../js/ai/worker-runtime.js',
  '../js/game/game.js',
  '../js/game/history.js',
  '../js/lab/variation-tree.js',
  '../js/lab/variation-workflow.js',
  '../js/storage/migrations.js',
  '../js/storage/storage.js',
  '../js/analysis/analyzer.js',
  '../js/analysis/heatmap.js',
  '../js/analysis/advantage.js',
  '../js/analysis/openings.js',
  '../js/services/analysis-service.js',
  '../js/services/counterfactual-service.js',
  '../js/services/request-gate.js',
  '../js/services/ai-client.js',
  '../js/services/worker-ai-client.js',
  '../js/training/taxonomy.js',
  '../js/training/mistake-miner.js',
  '../js/training/scheduler.js',
  '../js/training/adaptive-engine.js',
  '../js/training/training-workflow.js',
  '../js/training/puzzles.js',
  '../js/training/profile.js',
  '../js/services/derived-service.js',
  '../js/share/codec.js',
  '../js/audio/audio.js',
  '../js/ui/board.js',
  '../js/ui/workspace.js',
  '../js/ui/panel.js',
  '../js/ui/review.js',
  '../js/ui/advantage-chart.js',
  '../js/ui/insights.js',
  '../js/ui/position-editor.js',
  '../js/ui/variation-tree.js',
  '../js/controllers/review-controller.js',
  '../js/controllers/training-controller.js',
  '../js/controllers/share-controller.js',
  '../js/controllers/game-controller.js',
  '../js/controllers/branch-controller.js',
  '../js/controllers/position-editor-controller.js',
  '../js/controllers/variation-controller.js',
  '../js/app/render-coordinator.js',
  '../js/app/boot-guard.js',
  '../js/main.js',
];

test('所有浏览器脚本均可通过语法编译', async () => {
  for (const file of files) {
    const code = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotThrow(() => new Function(code), file);
  }
});
