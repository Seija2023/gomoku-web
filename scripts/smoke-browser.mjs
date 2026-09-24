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
let standaloneCdp;
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
  await cdp.waitFor("Gomoku.App.getPerformanceStats().aiClient.mode === 'worker'", 5000);

  const initial = await cdp.evaluate("(() => { const perf = Gomoku.App.getPerformanceStats(); return { cells: document.querySelectorAll('.cell').length, initializations: perf.board.initializations, workerMode: perf.aiClient.mode, embeddedWorker: Boolean(window.GOMOKU_WORKER_SOURCE) }; })()");

  await cdp.evaluate("Gomoku.App.startPositionEditor()");
  await cdp.waitFor("!document.getElementById('positionEditorCard').classList.contains('hidden')");
  await cdp.evaluate("document.querySelector('[data-row=\"7\"][data-col=\"7\"]').click()");
  await cdp.evaluate("document.getElementById('editorToolWhite').click(); document.querySelector('[data-row=\"7\"][data-col=\"8\"]').click()");
  await cdp.evaluate("document.getElementById('editorAnalyzeBtn').click()");
  await cdp.waitFor("document.querySelectorAll('#candidateCompare .candidate-card').length > 0");
  await cdp.evaluate("document.getElementById('editorCompareBtn').click(); document.querySelector('[data-row=\"6\"][data-col=\"7\"]').click()");
  await cdp.waitFor("!document.getElementById('counterfactualCard').classList.contains('hidden')");
  const editorState = await cdp.evaluate("(() => ({ pieces: document.querySelectorAll('.piece').length, candidates: document.querySelectorAll('#candidateCompare .candidate-card').length, cardVisible: !document.getElementById('positionEditorCard').classList.contains('hidden'), comparisonVisible: !document.getElementById('counterfactualCard').classList.contains('hidden'), userMove: document.getElementById('counterfactualUserMove').textContent, aiMove: document.getElementById('counterfactualAiMove').textContent, reasons: document.querySelectorAll('#counterfactualReasons p').length, userMarkers: document.querySelectorAll('.cell.compare-user').length, aiMarkers: document.querySelectorAll('.cell.compare-ai').length, initializations: Gomoku.App.getPerformanceStats().board.initializations }))()");
  await cdp.evaluate("document.getElementById('editorStartPvpBtn').click()");
  await cdp.waitFor("Gomoku.App.getGame().customPosition === true");
  const customGame = await cdp.evaluate("(() => ({ black: Gomoku.App.getGame().board[7][7], white: Gomoku.App.getGame().board[7][8], moves: Gomoku.App.getGame().moves.length, editorHidden: document.getElementById('positionEditorCard').classList.contains('hidden') }))()");
  await cdp.evaluate("Gomoku.App.restart()");

  await cdp.evaluate("document.querySelector('[data-row=\"7\"][data-col=\"7\"]').click()");
  await cdp.waitFor('Gomoku.App.getGame().moves.length === 1');
  const firstMove = await cdp.evaluate("(() => { const cell = document.querySelector('[data-row=\"7\"][data-col=\"7\"]'); return { cells: document.querySelectorAll('.cell').length, blackPiece: Boolean(cell.querySelector('.piece.black')) }; })()");

  await cdp.evaluate("Gomoku.App.restart(); Gomoku.App.setMode('ai'); document.querySelector('[data-row=\"7\"][data-col=\"7\"]').click()");
  await cdp.waitFor('Gomoku.App.getGame().moves.length >= 2', 7000);
  const aiRuntime = await cdp.evaluate("(() => { const perf = Gomoku.App.getPerformanceStats(); return { moves: Gomoku.App.getGame().moves.length, mode: perf.aiClient.mode, progress: perf.aiClient.latestProgress, searchStatus: document.getElementById('aiSearchStatus').textContent }; })()");
  const aiMoves = aiRuntime.moves;

  await cdp.evaluate("(() => { Gomoku.App.setMode('pvp'); const sequence = [[7,3],[0,0],[7,4],[0,2],[7,5],[0,4],[7,6],[0,6],[7,7]]; for (const pair of sequence) { const r = pair[0], c = pair[1]; document.querySelector('[data-row=\"' + r + '\"][data-col=\"' + c + '\"]').click(); } })()");
  await cdp.waitFor('Gomoku.App.getGame().gameOver === true');

  await cdp.evaluate("(() => { Gomoku.App.startReview(); document.getElementById('reviewStartBtn').click(); document.getElementById('reviewPlayBtn').click(); window.scrollTo(0, 0); })()");

  const replayBefore = await cdp.evaluate("({ scrollY: window.scrollY, pieces: document.querySelectorAll('.piece').length })");
  await new Promise(resolve => setTimeout(resolve, 1600));

  const replayAfter = await cdp.evaluate("(() => { const perf = Gomoku.App.getPerformanceStats(); return { scrollY: window.scrollY, pieces: document.querySelectorAll('.piece').length, cells: document.querySelectorAll('.cell').length, boardInitializations: perf.board.initializations, reviewListBuilds: perf.review.listBuilds }; })()");

  const standaloneUrl = appUrl + 'dist/gomoku.html';
  const standaloneTargetResponse = await fetch(
    'http://127.0.0.1:' + debugPort + '/json/new?' + encodeURIComponent(standaloneUrl),
    { method: 'PUT' },
  );
  if (!standaloneTargetResponse.ok) throw new Error('Could not create standalone browser target');
  const standaloneTarget = await standaloneTargetResponse.json();
  standaloneCdp = await connectCdp(standaloneTarget.webSocketDebuggerUrl);
  await standaloneCdp.send('Runtime.enable');
  await standaloneCdp.send('Page.enable');
  await standaloneCdp.waitFor('window.Gomoku?.App && document.querySelectorAll(".cell").length === 225', 7000);
  await standaloneCdp.waitFor("Gomoku.App.getPerformanceStats().aiClient.mode === 'worker'", 5000);
  await standaloneCdp.evaluate("Gomoku.App.setMode('ai'); document.querySelector('[data-row=\"7\"][data-col=\"7\"]').click()");
  await standaloneCdp.waitFor('Gomoku.App.getGame().moves.length >= 2', 7000);
  const standaloneState = await standaloneCdp.evaluate("(() => { const perf = Gomoku.App.getPerformanceStats(); return { embedded: Boolean(window.GOMOKU_WORKER_SOURCE), mode: perf.aiClient.mode, moves: Gomoku.App.getGame().moves.length, progress: perf.aiClient.latestProgress }; })()");

  const checks = {
    initialCells: initial.cells === 225,
    workerBackend: initial.workerMode === 'worker' && initial.embeddedWorker === false,
    workerSearchTelemetry: aiRuntime.mode === 'worker' && aiRuntime.progress?.nodes > 0 && aiRuntime.progress?.depth >= 1 && aiRuntime.searchStatus.includes('Worker AI'),
    standaloneBlobWorker: standaloneState.embedded && standaloneState.mode === 'worker',
    standaloneAiResponded: standaloneState.moves >= 2 && standaloneState.progress?.nodes > 0,
    positionEditorPlaced: editorState.pieces === 2 && editorState.cardVisible,
    positionEditorAnalyzed: editorState.candidates > 0,
    counterfactualRendered: editorState.comparisonVisible && editorState.userMove && editorState.aiMove && editorState.reasons > 0,
    counterfactualMarkedBoard: editorState.userMarkers === 1 && editorState.aiMarkers === 1,
    customGameStarted: customGame.black === 1 && customGame.white === 2 && customGame.moves === 0 && customGame.editorHidden,
    editorReusedBoardDom: editorState.initializations === 1,
    boardInitializedOnce: initial.initializations === 1 && replayAfter.boardInitializations === 1,
    firstMoveRendered: firstMove.blackPiece && firstMove.cells === 225,
    aiResponded: aiMoves >= 2,
    replayAdvanced: replayAfter.pieces > replayBefore.pieces,
    replayDidNotScroll: replayBefore.scrollY === 0 && replayAfter.scrollY === 0,
    reviewStaticDomReused: replayAfter.reviewListBuilds === 1,
    noRuntimeExceptions: cdp.exceptions.length === 0 && standaloneCdp.exceptions.length === 0,
  };

  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  console.log(JSON.stringify({ checks, initial, aiRuntime, standaloneState, editorState, customGame, replayBefore, replayAfter, exceptions: [...cdp.exceptions, ...standaloneCdp.exceptions] }, null, 2));

  if (failed.length) throw new Error('Smoke checks failed: ' + failed.join(', '));
} finally {
  try { standaloneCdp?.ws.close(); } catch {}
  try { cdp?.ws.close(); } catch {}

  const chromeExited = chrome.exitCode !== null
    ? Promise.resolve()
    : new Promise(resolve => chrome.once('exit', resolve));
  chrome.kill('SIGTERM');
  await Promise.race([
    chromeExited,
    new Promise(resolve => setTimeout(resolve, 1500)),
  ]);

  await new Promise(resolve => server.close(resolve));
  await rm(userDataDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}
