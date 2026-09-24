import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

function rel(file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function fail(errors, message) {
  errors.push(message);
}

const errors = [];
const warnings = [];
const jsFiles = (await walk(path.join(root, 'js'))).filter(file => file.endsWith('.js'));
const source = new Map();

for (const file of jsFiles) {
  source.set(rel(file), await readFile(file, 'utf8'));
}

const domPattern = /\b(document|window\.document)\b|\b(getElementById|querySelector|querySelectorAll|createElement|execCommand)\s*\(/;
const domAllowed = path => (
  path.startsWith('js/ui/')
  || path.startsWith('js/platform/')
  || path === 'js/main.js'
);

for (const [file, content] of source) {
  if (domPattern.test(content) && !domAllowed(file)) {
    fail(errors, `${file}: DOM access is restricted to ui/, platform/, and main.js`);
  }

  if (/\blocalStorage\b/.test(content) && !file.startsWith('js/storage/')) {
    fail(errors, `${file}: localStorage access must go through js/storage/`);
  }

  if (/G\.AISearch\b/.test(content) && !file.startsWith('js/ai/') && !file.startsWith('js/services/')) {
    fail(errors, `${file}: direct AISearch access is restricted to ai/ and services/`);
  }

  const lines = content.split(/\r?\n/).length;
  if (file === 'js/main.js' && lines > 480) {
    fail(errors, `${file}: bootstrap must stay <= 480 lines (currently ${lines})`);
  }
  if (file.startsWith('js/controllers/') && lines > 350) {
    warnings.push(`${file}: controller is large (${lines} lines); consider splitting responsibilities`);
  }
  if (file.startsWith('js/ui/') && lines > 500) {
    warnings.push(`${file}: UI module is large (${lines} lines); consider splitting by view responsibility`);
  }
}

const main = source.get('js/main.js') || '';
if (/state\.active/.test(main)) {
  fail(errors, 'js/main.js: special-mode state must be queried through WorkspaceManager, not state.active');
}

const requiredFiles = [
  '.editorconfig',
  '.gitattributes',
  '.gitignore',
  'CONTRIBUTING.md',
  'README.md',
  'docs/ARCHITECTURE.md',
  'docs/CHANGELOG.md',
  'docs/DEVELOPMENT.md',
  'docs/RELEASING.md',
  'docs/USAGE.md',
  '.github/workflows/ci.yml',
];

for (const file of requiredFiles) {
  try {
    await readFile(path.join(root, file), 'utf8');
  } catch {
    fail(errors, `${file}: required repository governance file is missing`);
  }
}

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
const versionFiles = [
  ['README.md', new RegExp(`v${version.replaceAll('.', '\\.')}\\b`)],
  ['docs/ARCHITECTURE.md', new RegExp(`v${version.replaceAll('.', '\\.')}\\b`)],
  ['docs/CHANGELOG.md', new RegExp(`v${version.replaceAll('.', '\\.')}\\b`)],
  ['docs/USAGE.md', new RegExp(`v${version.replaceAll('.', '\\.')}\\b`)],
];
for (const [file, pattern] of versionFiles) {
  const content = await readFile(path.join(root, file), 'utf8');
  if (!pattern.test(content)) {
    fail(errors, `${file}: does not reference current package version v${version}`);
  }
}

try {
  const trackedDist = execFileSync('git', ['ls-files', 'dist'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  if (trackedDist) {
    fail(errors, `generated dist output must not be tracked: ${trackedDist.replaceAll('\n', ', ')}`);
  }
} catch (error) {
  warnings.push(`git tracked-file check skipped: ${error.message}`);
}

for (const warning of warnings) console.warn(`WARN: ${warning}`);

if (errors.length) {
  console.error('Architecture lint failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Architecture lint passed for ${jsFiles.length} JavaScript modules (v${version}).`);
}
