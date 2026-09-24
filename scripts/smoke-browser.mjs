import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js') || file.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'application/octet-stream';
}

async function createServer() {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.resolve(root, '.' + relative);
      if (!file.startsWith(root)) throw new Error('Invalid path');
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': contentType(file),
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  return { server, port: server.address().port };
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes('/')) return candidate;
    const found = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim();
  }

  throw new Error('Chrome/Chromium executable not found');
}

async function waitForHttp(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for ' + url);
}

async function connectCdp(webSocketUrl) {
  if (typeof WebSocket === 'undefined') throw new Error('Node WebSocket API is unavailable');

  const ws = new WebSocket(webSocketUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const exceptions = [];

  ws.addEventListener('message', event => {
    const message = JSON.parse(String(event.data));
    if (message.id && pending.has(message.id)) {
      const item = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) item.reject(new Error(message.error.message));
      else item.resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      exceptions.push(message.params?.exceptionDetails?.text || 'Runtime exception');
    }
  });

  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Evaluation failed');
    return result.result?.value;
  }

  async function waitFor(expression, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await evaluate('Boolean(' + expression + ')')) return true;
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    throw new Error('Timed out waiting for: ' + expression);
  }

  return { ws, send, evaluate, waitFor, exceptions };
}

const started = await createServer();
const server = started.server;
const port = started.port;
const debugPort = await freePort();
const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'gomoku-smoke-'));
const chromePath = findChrome();
const appUrl = 'http://127.0.0.1:' + port + '/';

const chrome = spawn(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-background-networking',
  '--remote-debugging-port=' + debugPort,
  '--user-data-dir=' + userDataDir,
  'about:blank',
], { stdio: 'ignore' });

let cdp;
try {
  await waitForHttp('http://127.0.0.1:' + debugPort + '/json/version');
  const targetResponse = await fetch(
    'http://127.0.0.1:' + debugPort + '/json/new?' + encodeURIComponent(appUrl),
    { method: 'PUT' },
  );
  if (!targetResponse.ok) throw new Error('Could not create browser target');
  const target = await targetResponse.json();

  cdp = await connectCdp(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.waitFor('window.Gomoku?.App && document.querySelectorAll(".cell").length === 225');

  const initial = await cdp.evaluate("(() => ({ cells: document.querySelectorAll('.cell').length, initializations: Gomoku.App.getPerformanceStats().board.initializations }))()");

  await cdp.evaluate("document.querySelector('[data-row=\"7\"][data-col=\"7\"]').click()");
  await cdp.waitFor('Gomoku.App.getGame().moves.length === 1');
  const firstMove = await cdp.evaluate("(() => { const cell = document.querySelector('[data-row=\"7\"][data-col=\"7\"]'); return { cells: document.querySelectorAll('.cell').length, blackPiece: Boolean(cell.querySelector('.piece.black')) }; })()");

  await cdp.evaluate("Gomoku.App.restart(); Gomoku.App.setMode('ai'); document.querySelector('[data-row=\"7\"][data-col=\"7\"]').click()");
  await cdp.waitFor('Gomoku.App.getGame().moves.length >= 2', 5000);
  const aiMoves = await cdp.evaluate('Gomoku.App.getGame().moves.length');

  await cdp.evaluate("(() => { Gomoku.App.setMode('pvp'); const sequence = [[7,3],[0,0],[7,4],[0,2],[7,5],[0,4],[7,6],[0,6],[7,7]]; for (const pair of sequence) { const r = pair[0], c = pair[1]; document.querySelector('[data-row=\"' + r + '\"][data-col=\"' + c + '\"]').click(); } })()");
  await cdp.waitFor('Gomoku.App.getGame().gameOver === true');

  await cdp.evaluate("(() => { Gomoku.App.startReview(); document.getElementById('reviewStartBtn').click(); document.getElementById('reviewPlayBtn').click(); window.scrollTo(0, 0); })()");

  const replayBefore = await cdp.evaluate("({ scrollY: window.scrollY, pieces: document.querySelectorAll('.piece').length })");
  await new Promise(resolve => setTimeout(resolve, 1600));

  const replayAfter = await cdp.evaluate("(() => { const perf = Gomoku.App.getPerformanceStats(); return { scrollY: window.scrollY, pieces: document.querySelectorAll('.piece').length, cells: document.querySelectorAll('.cell').length, boardInitializations: perf.board.initializations, reviewListBuilds: perf.review.listBuilds }; })()");

  const checks = {
    initialCells: initial.cells === 225,
    boardInitializedOnce: initial.initializations === 1 && replayAfter.boardInitializations === 1,
    firstMoveRendered: firstMove.blackPiece && firstMove.cells === 225,
    aiResponded: aiMoves >= 2,
    replayAdvanced: replayAfter.pieces > replayBefore.pieces,
    replayDidNotScroll: replayBefore.scrollY === 0 && replayAfter.scrollY === 0,
    reviewStaticDomReused: replayAfter.reviewListBuilds === 1,
    noRuntimeExceptions: cdp.exceptions.length === 0,
  };

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  console.log(JSON.stringify({ checks, replayBefore, replayAfter, exceptions: cdp.exceptions }, null, 2));

  if (failed.length) throw new Error('Smoke checks failed: ' + failed.join(', '));
} finally {
  try { cdp?.ws.close(); } catch {}
  chrome.kill('SIGTERM');
  await new Promise(resolve => server.close(resolve));
  await rm(userDataDir, { recursive: true, force: true });
}
