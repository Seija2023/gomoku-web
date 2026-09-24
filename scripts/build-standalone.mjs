import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'index.html');
const outputPath = path.join(root, 'dist', 'gomoku.html');

const html = await readFile(indexPath, 'utf8');
const cssMatches = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)" \/>/g)];
const scriptMatches = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)];

const css = (await Promise.all(cssMatches.map(match => readFile(path.join(root, match[1]), 'utf8')))).join('\n\n');
const js = (await Promise.all(scriptMatches.map(match => readFile(path.join(root, match[1]), 'utf8')))).join('\n\n');

const workerFiles = [
  'js/config.js',
  'js/core/rules.js',
  'js/game/position.js',
  'js/ai/evaluator.js',
  'js/ai/search.js',
  'js/analysis/heatmap.js',
  'js/analysis/advantage.js',
  'js/services/analysis-service.js',
  'js/services/counterfactual-service.js',
  'js/ai/worker-runtime.js',
];
const workerBody = (await Promise.all(
  workerFiles.map(file => readFile(path.join(root, file), 'utf8'))
)).join('\n\n');
const workerSource = `self.window = self;\nself.Gomoku = self.Gomoku || {};\n${workerBody}`;

let bundled = html;
for (const match of cssMatches) bundled = bundled.replace(match[0], '');
for (const match of scriptMatches) bundled = bundled.replace(match[0], '');

bundled = bundled.replace('</head>', `  <style>\n${css}\n  </style>\n</head>`);
bundled = bundled.replace(
  '</body>',
  `  <script>window.GOMOKU_WORKER_SOURCE = ${JSON.stringify(workerSource)};</script>\n  <script>\n${js}\n  </script>\n</body>`,
);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, bundled, 'utf8');
console.log(`Built ${path.relative(root, outputPath)} with embedded AI worker`);
