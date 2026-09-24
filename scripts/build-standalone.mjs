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

let bundled = html;
for (const match of cssMatches) bundled = bundled.replace(match[0], '');
for (const match of scriptMatches) bundled = bundled.replace(match[0], '');

bundled = bundled.replace('</head>', `  <style>\n${css}\n  </style>\n</head>`);
bundled = bundled.replace('</body>', `  <script>\n${js}\n  </script>\n</body>`);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, bundled, 'utf8');
console.log(`Built ${path.relative(root, outputPath)}`);
