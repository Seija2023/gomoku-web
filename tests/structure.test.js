import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const boardCss = await readFile(new URL('../css/board.css', import.meta.url), 'utf8');
const boardJs = await readFile(new URL('../js/ui/board.js', import.meta.url), 'utf8');
const reviewJs = await readFile(new URL('../js/ui/review.js', import.meta.url), 'utf8');

test('入口文件加载 v2.3.2 调度优化模块', () => {
  for (const path of [
    'js/app/render-flags.js',
    'js/game/position.js',
    'js/storage/migrations.js',
    'js/services/analysis-service.js',
    'js/services/request-gate.js',
    'js/services/derived-service.js',
    'js/ai/search.js',
    'js/analysis/advantage.js',
    'js/training/scheduler.js',
    'js/share/codec.js',
    'js/ui/insights.js',
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
    'reviewChallengeBtn','trainingStats','openingLibrary','branchBar','trainingCard'
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
