import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const boardCss = await readFile(new URL('../css/board.css', import.meta.url), 'utf8');

test('入口文件使用模块化目录而不是旧单文件脚本和样式', () => {
  assert.match(index, /css\/board\.css/);
  assert.match(index, /js\/main\.js/);
  assert.doesNotMatch(index, /href="style\.css"/);
  assert.doesNotMatch(index, /src="script\.js"/);
});

test('棋盘交互按钮保持透明，避免移动端白色遮挡回归', () => {
  const cellRule = boardCss.match(/\.cell\s*\{[\s\S]*?\}/)?.[0] || '';
  assert.match(cellRule, /background:\s*transparent/);
});

test('页面保留关键交互元素', () => {
  for (const id of ['board','pvpModeBtn','aiModeBtn','undoBtn','soundBtn','restartBtn','modal']) {
    assert.match(index, new RegExp(`id="${id}"`));
  }
});
