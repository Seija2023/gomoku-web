import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const files = [
  '../js/config.js',
  '../js/core/rules.js',
  '../js/ai/evaluator.js',
  '../js/game/game.js',
  '../js/game/history.js',
  '../js/storage/storage.js',
  '../js/analysis/analyzer.js',
  '../js/audio/audio.js',
  '../js/ui/board.js',
  '../js/ui/panel.js',
  '../js/ui/review.js',
  '../js/main.js',
];

test('所有浏览器脚本均可通过语法编译', async () => {
  for (const file of files) {
    const code = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.doesNotThrow(() => new Function(code), file);
  }
});
