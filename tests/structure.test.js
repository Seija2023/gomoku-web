import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const boardCss = await readFile(new URL('../css/board.css', import.meta.url), 'utf8');
const boardJs = await readFile(new URL('../js/ui/board.js', import.meta.url), 'utf8');
const reviewJs = await readFile(new URL('../js/ui/review.js', import.meta.url), 'utf8');

test('入口文件加载 v2.7.0 Adaptive Training 与 Variation Lab 模块', () => {
  for (const path of [
    'js/app/render-flags.js',
    'js/game/position.js',
    'js/game/editable-position.js',
    'js/lab/variation-tree.js',
    'js/lab/variation-workflow.js',
    'js/storage/migrations.js',
    'js/services/analysis-service.js',
    'js/services/counterfactual-service.js',
    'js/services/request-gate.js',
    'js/services/ai-client.js',
    'js/services/worker-ai-client.js',
    'js/services/derived-service.js',
    'js/ai/search.js',
    'js/analysis/advantage.js',
    'js/training/taxonomy.js',
    'js/training/mistake-miner.js',
    'js/training/scheduler.js',
    'js/training/adaptive-engine.js',
    'js/training/training-workflow.js',
    'js/share/codec.js',
    'js/ui/insights.js',
    'js/ui/position-editor.js',
    'js/ui/variation-tree.js',
    'js/controllers/review-controller.js',
    'js/controllers/training-controller.js',
    'js/controllers/share-controller.js',
    'js/controllers/game-controller.js',
    'js/controllers/branch-controller.js',
    'js/controllers/position-editor-controller.js',
    'js/controllers/variation-controller.js',
    'js/main.js',
  ]) assert.match(index, new RegExp(path.replace(/[./]/g, '\\$&')));
});

test('棋盘交互按钮保持透明，避免移动端白色遮挡回归', () => {
  const cellRule = boardCss.match(/\.cell\s*\{[\s\S]*?\}/)?.[0] || '';
  assert.match(cellRule, /background:\s*transparent/);
});

test('棋盘采用一次初始化与事件委托，而不是每次 render 重建 225 个格子', () => {
  assert.match(boardJs, /initializeBoard\(\)/);
  assert.match(boardJs, /bindDelegatedEvents\(\)/);
  const renderBody = boardJs.slice(boardJs.indexOf('    render(game, options = {})'));
  assert.doesNotMatch(renderBody, /this\.element\.innerHTML\s*=\s*''/);
  assert.doesNotMatch(boardJs, /cell\.addEventListener\('click'/);
});

test('页面保留 v2.3 核心 PC 与手机控件', () => {
  for (const id of [
    'board','difficultySelect','personaSelect','ghostToggle','candidateCompare',
    'heatmapToggle','reviewTimeline','advantageChart','reviewShareBtn',
    'reviewChallengeBtn','trainingStats','openingLibrary','branchBar','trainingCard',
    'positionEditorBtn','positionEditorCard','editorToolBlack','editorToolWhite',
    'editorToolErase','editorNextPlayer','editorCompareBtn','counterfactualCard',
    'counterfactualUserMove','counterfactualAiMove','editorStartPvpBtn','editorStartAiBtn',
    'aiSearchStatus','searchInspector','searchDepthHistory','searchStability',
    'variationStartBtn','variationResumeBtn','variationCard','variationTreeList',
    'variationChildren','variationExpandBtn','variationFavoriteBtn',
    'mistakeTrainingBtn','mistakeTrainingCount','trainingWeakness','mistakeBook',
    'trainingMeta','trainingDetail','trainingVariationBtn'
  ]) assert.match(index, new RegExp(`id="${id}"`));
});

test('自动复盘不再调用 scrollIntoView 拉动页面', () => {
  assert.doesNotMatch(reviewJs, /scrollIntoView\s*\(/);
});

test('幽灵线和持久图层样式仍然存在', () => {
  assert.match(boardCss, /\.ghost-layer/);
  assert.match(boardCss, /\.ghost-piece/);
  assert.match(boardCss, /\.board-layer/);
});

test('复盘视图不再每一步重建完整棋谱和分析内容', async () => {
  const source = await readFile(new URL('../js/ui/review.js', import.meta.url), 'utf8');
  assert.match(source, /structureChanged/);
  assert.match(source, /moveButtons = new Map/);
  assert.match(source, /replaceChildren\(fragment\)/);
  assert.doesNotMatch(source, /scrollIntoView\s*\(/);
});

test('主控制器支持按区域刷新而不是只能全量 refresh', async () => {
  const source = await readFile(new URL('../js/main.js', import.meta.url), 'utf8');
  assert.match(source, /function refresh\(mask = RenderFlags\.ALL\)/);
  assert.match(source, /RenderFlags\.STATUS/);
  assert.match(source, /RenderFlags\.BOARD/);
  assert.match(source, /RenderFlags\.ANALYSIS/);
  assert.match(source, /refreshTrainingDerived/);
});

test('main 入口明显瘦身并由 Controller 承担功能逻辑', async () => {
  const source = await readFile(new URL('../js/main.js', import.meta.url), 'utf8');
  const lines = source.split('\n').length;
  assert.ok(lines < 800, `main.js should stay below 800 lines after v2.6 integration, got ${lines}`);
  assert.match(source, /new G\.Controllers\.GameController/);
  assert.match(source, /new G\.Controllers\.ReviewController/);
  assert.match(source, /new G\.Controllers\.BranchController/);
  assert.match(source, /new G\.Controllers\.TrainingController/);
  assert.match(source, /new G\.Controllers\.ShareController/);
  assert.match(source, /new G\.Controllers\.PositionEditorController/);
  assert.match(source, /G\.Services\.createAIClient/);
  assert.match(source, /new G\.Controllers\.VariationController/);
  assert.match(source, /new G\.Lab\.VariationWorkflow/);
  assert.match(source, /new G\.Training\.Workflow/);
});

test('CI 包含短浏览器 Smoke Test', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const pkg = await readFile(new URL('../package.json', import.meta.url), 'utf8');
  assert.match(workflow, /npm run smoke/);
  assert.match(pkg, /"smoke":\s*"node scripts\/smoke-browser\.mjs"/);
});


test('Standalone 构建会内嵌 Blob Worker 源码', async () => {
  const build = await readFile(new URL('../scripts/build-standalone.mjs', import.meta.url), 'utf8');
  assert.match(build, /GOMOKU_WORKER_SOURCE/);
  assert.match(build, /worker-runtime\.js/);
  assert.match(build, /workerSource/);
});

test('Local AI 2.0 包含迭代加深、置换表与 Worker fallback', async () => {
  const search = await readFile(new URL('../js/ai/search.js', import.meta.url), 'utf8');
  const workerClient = await readFile(new URL('../js/services/worker-ai-client.js', import.meta.url), 'utf8');
  assert.match(search, /iterativeSearch/);
  assert.match(search, /new Map\(\)/);
  assert.match(search, /tacticalCandidates/);
  assert.match(workerClient, /MainThreadAIClient/);
  assert.match(workerClient, /new Blob/);
  assert.match(workerClient, /restartWorker/);
});


test('Variation Tree、Ghost Line 2.0 与 Search Inspector 保持模块化边界', async () => {
  const variation = await readFile(new URL('../js/lab/variation-tree.js', import.meta.url), 'utf8');
  const board = await readFile(new URL('../js/ui/board.js', import.meta.url), 'utf8');
  const insights = await readFile(new URL('../js/ui/insights.js', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../js/services/worker-ai-client.js', import.meta.url), 'utf8');
  assert.match(variation, /class VariationTree/);
  assert.match(variation, /serialize\(\)/);
  assert.match(variation, /static restore/);
  assert.match(board, /pinGhostLine/);
  assert.match(board, /pinnedGhostKey/);
  assert.match(insights, /renderSearchInspector/);
  assert.match(insights, /candidate-ghost-btn/);
  assert.match(worker, /searchTrace/);
});


test('Adaptive Training 使用独立错误挖掘、分类和自适应计划模块', async () => {
  const miner = await readFile(new URL('../js/training/mistake-miner.js', import.meta.url), 'utf8');
  const adaptive = await readFile(new URL('../js/training/adaptive-engine.js', import.meta.url), 'utf8');
  const puzzles = await readFile(new URL('../js/training/puzzles.js', import.meta.url), 'utf8');
  const workflow = await readFile(new URL('../js/training/training-workflow.js', import.meta.url), 'utf8');
  assert.match(miner, /WIN_MISS/);
  assert.match(miner, /FORCED_DEFENSE_MISS/);
  assert.match(miner, /trainable/);
  assert.match(adaptive, /categoryStats/);
  assert.match(adaptive, /weakness/);
  assert.match(puzzles, /grade: 'good'/);
  assert.match(workflow, /startMistakes/);
  assert.match(workflow, /openVariation/);
});
