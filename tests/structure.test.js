import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const boardCss = await readFile(new URL('../css/board.css', import.meta.url), 'utf8');
const reviewJs = await readFile(new URL('../js/ui/review.js', import.meta.url), 'utf8');

test('入口文件加载 v2.2 智能分析模块', () => {
  for (const path of [
    'js/ai/search.js',
    'js/analysis/heatmap.js',
    'js/training/puzzles.js',
    'js/training/profile.js',
    'js/ui/insights.js',
    'js/main.js',
  ]) assert.match(index, new RegExp(path.replace(/[./]/g, '\\$&')));
  assert.doesNotMatch(index, /href="style\.css"/);
  assert.doesNotMatch(index, /src="script\.js"/);
});

test('棋盘交互按钮保持透明，避免移动端白色遮挡回归', () => {
  const cellRule = boardCss.match(/\.cell\s*\{[\s\S]*?\}/)?.[0] || '';
  assert.match(cellRule, /background:\s*transparent/);
});

test('页面包含智能分析、训练、分支和复盘控件', () => {
  for (const id of [
    'board','difficultySelect','heatmapToggle','heatmapMode','aiExplain',
    'trainingBtn','profileContent','reviewTimeline','reviewKeyOnlyBtn',
    'reviewBranchBtn','branchBar','trainingCard','historyList'
  ]) assert.match(index, new RegExp(`id="${id}"`));
});

test('自动复盘不再调用 scrollIntoView 拉动页面', () => {
  assert.doesNotMatch(reviewJs, /scrollIntoView\s*\(/);
});
