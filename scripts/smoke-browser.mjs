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
const chromePath = findChrome();
const appUrl = 'http://127.0.0.1:' + port + '/';
const chromeProfiles = [];

async function stopChrome(process) {
  if (!process) return;
  const exited = process.exitCode !== null
    ? Promise.resolve()
    : new Promise(resolve => process.once('exit', resolve));
  try { process.kill('SIGTERM'); } catch {}
  await Promise.race([
    exited,
    new Promise(resolve => setTimeout(resolve, 1500)),
  ]);
}

async function launchChrome(maxAttempts = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const debugPort = await freePort();
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'gomoku-smoke-'));
    chromeProfiles.push(userDataDir);
    const process = spawn(chromePath, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--remote-debugging-port=' + debugPort,
      '--user-data-dir=' + userDataDir,
      'about:blank',
    ], { stdio: 'ignore' });

    try {
      await waitForHttp('http://127.0.0.1:' + debugPort + '/json/version', 15000);
      return { process, debugPort, userDataDir, attempt };
    } catch (error) {
      lastError = error;
      await stopChrome(process);
      if (attempt < maxAttempts) await new Promise(resolve => setTimeout(resolve, 350));
    }
  }
  throw new Error('Chrome failed to start after retries: ' + (lastError?.message || 'unknown error'));
}

let cdp;
let standaloneCdp;
let chrome;
let debugPort;
let userDataDir;
try {
  const launched = await launchChrome();
  chrome = launched.process;
  debugPort = launched.debugPort;
  userDataDir = launched.userDataDir;

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
  const workspaceInitial = await cdp.evaluate("(() => ({ workspace: document.body.dataset.workspace, activeTab: document.querySelector('.workspace-tab.active')?.dataset.workspaceTarget, visibleSections: [...document.querySelectorAll('.workspace-section.workspace-visible')].map(item => item.dataset.workspaces) }))()");

  await cdp.evaluate("document.querySelector('[data-workspace-target=\"analysis\"]').click()");
  await cdp.waitFor("document.body.dataset.workspace === 'analysis'");
  const workspaceAnalysis = await cdp.evaluate("(() => ({ visibleAnalysis: document.querySelector('[data-workspaces=\"analysis\"]')?.classList.contains('workspace-visible'), visibleGame: document.querySelector('[data-workspaces=\"game\"]')?.classList.contains('workspace-visible') }))()");

  await cdp.evaluate("document.querySelector('[data-workspace-target=\"lab\"]').click()");
  await cdp.waitFor("document.body.dataset.workspace === 'lab'");
  await cdp.evaluate("document.getElementById('positionEditorBtn').click()");
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
  await cdp.waitFor("document.body.dataset.workspace === 'lab'");
  const workspacePersistAfterSpecial = await cdp.evaluate("(() => ({ workspace: document.body.dataset.workspace, selected: Gomoku.App.getWorkspace().selected }))()");

  await cdp.evaluate("document.querySelector('[data-row=\"7\"][data-col=\"7\"]').click()");
  await cdp.waitFor('Gomoku.App.getGame().moves.length === 1');
  const firstMove = await cdp.evaluate("(() => { const cell = document.querySelector('[data-row=\"7\"][data-col=\"7\"]'); return { cells: document.querySelectorAll('.cell').length, blackPiece: Boolean(cell.querySelector('.piece.black')) }; })()");

  await cdp.evaluate("Gomoku.App.restart(); Gomoku.App.setMode('ai'); document.querySelector('[data-row=\"7\"][data-col=\"7\"]').click()");
  await cdp.waitFor('Gomoku.App.getGame().moves.length >= 2', 7000);
  const aiRuntime = await cdp.evaluate("(() => { const perf = Gomoku.App.getPerformanceStats(); return { moves: Gomoku.App.getGame().moves.length, mode: perf.aiClient.mode, progress: perf.aiClient.latestProgress, searchStatus: document.getElementById('aiSearchStatus').textContent }; })()");
  const aiMoves = aiRuntime.moves;

  await cdp.evaluate("document.querySelector('[data-workspace-target=\"analysis\"]').click()");
  await cdp.waitFor("document.body.dataset.workspace === 'analysis' && document.querySelector('[data-workspaces=\"analysis\"]').classList.contains('workspace-visible')");
  await cdp.waitFor("document.querySelectorAll('.candidate-ghost-btn').length > 0");
  const analysisLayout = await cdp.evaluate("(() => { const cards = [...document.querySelectorAll('#candidateCompare .candidate-card')]; const inspector = document.getElementById('searchInspector'); const panel = document.querySelector('.workspace-panel'); return { cardWidth: cards[0]?.getBoundingClientRect().width || 0, cardCount: cards.length, inspectorOpen: inspector.open, panelNoOverflow: panel.scrollWidth <= panel.clientWidth + 2 }; })()");
  await cdp.evaluate("document.querySelector('.candidate-ghost-btn').click()");
  const ghost2 = await cdp.evaluate("(() => { const perf = Gomoku.App.getPerformanceStats(); return { pinned: perf.board.ghostPinned, markers: document.querySelectorAll('.ghost-layer.pinned .ghost-piece').length, buttonActive: document.querySelector('.candidate-ghost-btn.active') !== null }; })()");

  await cdp.evaluate("document.querySelector('[data-workspace-target=\"lab\"]').click()");
  await cdp.waitFor("document.body.dataset.workspace === 'lab'");
  await cdp.evaluate("document.getElementById('variationStartBtn').click()");
  await cdp.waitFor("!document.getElementById('variationCard').classList.contains('hidden')");
  const variationStart = await cdp.evaluate("(() => ({ nodes: document.querySelectorAll('.variation-node').length, ghostPinned: Gomoku.App.getPerformanceStats().board.ghostPinned, cardVisible: !document.getElementById('variationCard').classList.contains('hidden'), workspace: document.body.dataset.workspace, disabledTabs: [...document.querySelectorAll('.workspace-tab')].filter(item => item.disabled).length }))()");

  await cdp.evaluate("(() => { const cell = [...document.querySelectorAll('.cell')].find(item => !item.querySelector('.piece') && !item.disabled); if (!cell) throw new Error('No empty variation cell'); cell.click(); })()");
  await cdp.waitFor("document.querySelectorAll('.variation-node').length >= 2");
  const manualVariation = await cdp.evaluate("(() => ({ nodes: document.querySelectorAll('.variation-node').length, active: document.querySelector('.variation-node.active')?.textContent || '' }))()");

  await cdp.evaluate("document.getElementById('variationRootBtn').click(); document.getElementById('variationExpandBtn').click()");
  await cdp.waitFor("document.getElementById('variationExpandBtn').textContent.includes('AI 扩展候选') && document.querySelectorAll('.variation-child').length >= 2", 10000);
  await cdp.waitFor("!document.getElementById('searchInspector').classList.contains('hidden') && document.querySelectorAll('.search-depth-row').length > 0", 5000);
  const expandedVariation = await cdp.evaluate("(() => ({ nodes: document.querySelectorAll('.variation-node').length, children: document.querySelectorAll('.variation-child').length, inspectorVisible: !document.getElementById('searchInspector').classList.contains('hidden'), depthRows: document.querySelectorAll('.search-depth-row').length, stability: document.getElementById('searchStability').textContent }))()");

  await cdp.evaluate("document.querySelector('.variation-child').click(); document.getElementById('variationFavoriteBtn').click(); const input = document.getElementById('variationNameInput'); input.value = 'Smoke 分支'; document.getElementById('variationSaveNameBtn').click()");
  await cdp.waitFor("document.getElementById('variationTreeList').textContent.includes('Smoke 分支')");
  const namedVariation = await cdp.evaluate("(() => ({ favorite: document.getElementById('variationFavoriteBtn').textContent.includes('已收藏'), named: document.getElementById('variationTreeList').textContent.includes('Smoke 分支') }))()");

  await cdp.evaluate("Gomoku.App.exitVariation()");
  await cdp.waitFor("document.getElementById('variationCard').classList.contains('hidden')");
  await cdp.waitFor("document.getElementById('variationResumeBtn').disabled === false");
  await cdp.evaluate("Gomoku.App.resumeVariation()");
  await cdp.waitFor("!document.getElementById('variationCard').classList.contains('hidden') && document.getElementById('variationTreeList').textContent.includes('Smoke 分支')");
  const resumedVariation = await cdp.evaluate("(() => ({ restored: document.getElementById('variationTreeList').textContent.includes('Smoke 分支'), nodes: document.querySelectorAll('.variation-node').length }))()");
  await cdp.evaluate("Gomoku.App.exitVariation()");
  await cdp.evaluate("document.querySelector('[data-workspace-target=\"training\"]').click()");
  await cdp.waitFor("document.body.dataset.workspace === 'training'");

  await cdp.evaluate(`(() => {
    Gomoku.Storage.clearCurrent();
    const B = Gomoku.Config.BLACK;
    const W = Gomoku.Config.WHITE;
    Gomoku.Storage.saveFinished({
      id: 'smoke-defense',
      finishedAt: '2026-09-23T12:00:00Z',
      mode: Gomoku.Config.MODES.AI,
      winner: W,
      moves: [
        {r:8,c:3,player:B},{r:8,c:4,player:W},
        {r:0,c:0,player:B},{r:8,c:5,player:W},
        {r:0,c:2,player:B},{r:8,c:6,player:W},
        {r:0,c:4,player:B},{r:8,c:7,player:W},
        {r:1,c:1,player:B}
      ]
    });
    Gomoku.Storage.saveFinished({
      id: 'smoke-win-miss',
      finishedAt: '2026-09-24T12:00:00Z',
      mode: Gomoku.Config.MODES.AI,
      winner: W,
      moves: [
        {r:7,c:3,player:B},{r:0,c:0,player:W},
        {r:7,c:4,player:B},{r:0,c:2,player:W},
        {r:7,c:5,player:B},{r:0,c:4,player:W},
        {r:7,c:6,player:B},{r:0,c:6,player:W},
        {r:1,c:1,player:B}
      ]
    });
    location.reload();
  })()`);
  await new Promise(resolve => setTimeout(resolve, 250));
  await cdp.waitFor('window.Gomoku?.App && document.querySelectorAll(".cell").length === 225', 7000);
  await cdp.waitFor("document.body.dataset.workspace === 'training'");
  await cdp.waitFor("document.querySelectorAll('.mistake-book-card').length >= 2 && Number(document.getElementById('mistakeTrainingCount').textContent) >= 2", 7000);

  const workspaceReload = await cdp.evaluate("(() => ({ workspace: document.body.dataset.workspace, selected: Gomoku.App.getWorkspace().selected, activeTab: document.querySelector('.workspace-tab.active')?.dataset.workspaceTarget }))()");
  const adaptiveDashboard = await cdp.evaluate("(() => ({ mistakes: document.querySelectorAll('.mistake-book-card').length, weaknessRows: document.querySelectorAll('.weakness-row').length, mistakeCount: Number(document.getElementById('mistakeTrainingCount').textContent), profile: document.getElementById('profileContent').textContent }))()");

  const adaptivePuzzle = await cdp.evaluate("(() => { const button = document.querySelector('[data-mistake-puzzle]'); const id = button.dataset.mistakePuzzle; const records = Gomoku.Storage.listHistory(); const mistakes = Gomoku.MistakeMiner.mine(records); const puzzles = Gomoku.Puzzles.generate(records, Gomoku.Config.MAX_TRAINING_PUZZLES, mistakes); const puzzle = puzzles.find(item => item.id === id); if (!puzzle) throw new Error('Adaptive smoke puzzle not found'); button.click(); return { id, expected: puzzle.expected, category: puzzle.category, sourceKind: puzzle.sourceKind }; })()");
  await cdp.waitFor("!document.getElementById('trainingCard').classList.contains('hidden')");
  await cdp.evaluate(`document.querySelector('[data-row="${adaptivePuzzle.expected.r}"][data-col="${adaptivePuzzle.expected.c}"]').click()`);
  await cdp.waitFor("document.getElementById('trainingFeedback').dataset.grade === 'best'");
  const adaptiveAnswer = await cdp.evaluate("(() => ({ grade: document.getElementById('trainingFeedback').dataset.grade, meta: document.getElementById('trainingMeta').textContent, detail: document.getElementById('trainingDetail').textContent, variationEnabled: !document.getElementById('trainingVariationBtn').disabled }))()");

  await cdp.evaluate("document.getElementById('trainingVariationBtn').click()");
  await cdp.waitFor("!document.getElementById('variationCard').classList.contains('hidden') && document.getElementById('trainingCard').classList.contains('hidden')");
  const trainingVariation = await cdp.evaluate("(() => ({ label: document.getElementById('variationSummary').textContent, active: !document.getElementById('variationCard').classList.contains('hidden') }))()");
  await cdp.evaluate("Gomoku.App.exitVariation()");
  await cdp.waitFor("!document.getElementById('trainingCard').classList.contains('hidden') && document.getElementById('trainingFeedback').dataset.grade === 'best'");

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await new Promise(resolve => setTimeout(resolve, 120));
  const mobileTraining = await cdp.evaluate("(() => { const card = document.getElementById('trainingCard'); const variationButton = document.getElementById('trainingVariationBtn'); const nav = document.getElementById('workspaceNav'); const tab = document.querySelector('.workspace-tab.active'); return { viewport: innerWidth, noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2, columns: getComputedStyle(card).gridTemplateColumns.split(' ').length, variationButtonHeight: variationButton.getBoundingClientRect().height, navPosition: getComputedStyle(nav).position, navBottom: nav.getBoundingClientRect().bottom <= innerHeight && nav.getBoundingClientRect().bottom >= innerHeight - 30, activeTabHeight: tab.getBoundingClientRect().height }; })()");
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  await cdp.evaluate("document.getElementById('trainingNextBtn').click()");
  await cdp.waitFor("document.getElementById('trainingPrompt').textContent.includes('完成')");
  const adaptiveSession = await cdp.evaluate("(() => ({ donePrompt: document.getElementById('trainingPrompt').textContent, summary: document.getElementById('trainingFeedback').textContent, nextLabel: document.getElementById('trainingNextBtn').textContent }))()");
  await cdp.evaluate("document.getElementById('trainingNextBtn').click()");
  await cdp.waitFor("document.getElementById('trainingCard').classList.contains('hidden')");
  await cdp.evaluate("document.querySelector('[data-workspace-target=\"game\"]').click()");
  await cdp.waitFor("document.body.dataset.workspace === 'game'");

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
    workspaceDefaultGame: workspaceInitial.workspace === 'game' && workspaceInitial.activeTab === 'game' && workspaceInitial.visibleSections.every(item => item.includes('game')),
    workspaceAnalysisFocused: workspaceAnalysis.visibleAnalysis && !workspaceAnalysis.visibleGame,
    workspaceRestoresAfterSpecial: workspacePersistAfterSpecial.workspace === 'lab' && workspacePersistAfterSpecial.selected === 'lab',
    workspacePersistsReload: workspaceReload.workspace === 'training' && workspaceReload.selected === 'training' && workspaceReload.activeTab === 'training',
    analysisReadableCards: analysisLayout.cardCount > 0 && analysisLayout.cardWidth >= 230 && !analysisLayout.inspectorOpen && analysisLayout.panelNoOverflow,
    workerSearchTelemetry: aiRuntime.mode === 'worker' && aiRuntime.progress?.nodes > 0 && aiRuntime.progress?.depth >= 1 && aiRuntime.searchStatus.includes('Worker AI'),
    ghostLine2Pinned: ghost2.pinned && ghost2.markers >= 2 && ghost2.buttonActive,
    variationOpened: variationStart.cardVisible && variationStart.nodes === 1 && variationStart.ghostPinned === false && variationStart.workspace === 'lab' && variationStart.disabledTabs === 3,
    variationManualBranch: manualVariation.nodes >= 2 && manualVariation.active.length > 0,
    variationAiExpanded: expandedVariation.nodes >= 3 && expandedVariation.children >= 2,
    searchInspectorRendered: expandedVariation.inspectorVisible && expandedVariation.depthRows > 0 && expandedVariation.stability.includes('稳定度'),
    variationNamedFavorite: namedVariation.favorite && namedVariation.named,
    variationPersistence: resumedVariation.restored && resumedVariation.nodes >= 3,
    adaptiveMistakeBook: adaptiveDashboard.mistakes >= 2 && adaptiveDashboard.weaknessRows >= 1 && adaptiveDashboard.mistakeCount >= 2,
    adaptiveProfile: adaptiveDashboard.profile.includes('首要弱点') && adaptiveDashboard.profile.includes('自动识别错误'),
    adaptiveBestAnswer: adaptivePuzzle.sourceKind === 'mistake' && adaptiveAnswer.grade === 'best' && adaptiveAnswer.variationEnabled && adaptiveAnswer.meta.includes('个人错题'),
    trainingVariationRoundTrip: trainingVariation.active && trainingVariation.label.includes('训练'),
    adaptiveFiniteSession: adaptiveSession.donePrompt.includes('完成') && adaptiveSession.summary.includes('最佳') && adaptiveSession.nextLabel.includes('返回棋局'),
    mobileAdaptiveLayout: mobileTraining.viewport === 390 && mobileTraining.noHorizontalOverflow && mobileTraining.columns === 1 && mobileTraining.variationButtonHeight >= 44 && mobileTraining.navPosition === 'fixed' && mobileTraining.navBottom && mobileTraining.activeTabHeight >= 44,
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
  console.log(JSON.stringify({ checks, initial, workspaceInitial, workspaceAnalysis, workspacePersistAfterSpecial, workspaceReload, analysisLayout, aiRuntime, ghost2, variationStart, manualVariation, expandedVariation, namedVariation, resumedVariation, adaptiveDashboard, adaptivePuzzle, adaptiveAnswer, trainingVariation, mobileTraining, adaptiveSession, standaloneState, editorState, customGame, replayBefore, replayAfter, exceptions: [...cdp.exceptions, ...standaloneCdp.exceptions] }, null, 2));

  if (failed.length) throw new Error('Smoke checks failed: ' + failed.join(', '));
} finally {
  try { standaloneCdp?.ws.close(); } catch {}
  try { cdp?.ws.close(); } catch {}

  await stopChrome(chrome);

  await new Promise(resolve => server.close(resolve));
  for (const dir of chromeProfiles) {
    await rm(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
}
