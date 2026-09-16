const SIZE = 15;
const HUMAN = 1;
const AI = 2;
const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]];
const STAR_POINTS = [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]];

const boardEl = document.getElementById('board');
const subtitle = document.getElementById('subtitle');
const turnText = document.getElementById('turnText');
const turnIndicator = document.getElementById('turnIndicator');
const thinkingBadge = document.getElementById('thinkingBadge');
const moveCountEl = document.getElementById('moveCount');
const blackCountEl = document.getElementById('blackCount');
const whiteCountEl = document.getElementById('whiteCount');
const blackLabel = document.getElementById('blackLabel');
const whiteLabel = document.getElementById('whiteLabel');
const undoBtn = document.getElementById('undoBtn');
const soundBtn = document.getElementById('soundBtn');
const restartBtn = document.getElementById('restartBtn');
const pvpModeBtn = document.getElementById('pvpModeBtn');
const aiModeBtn = document.getElementById('aiModeBtn');
const modeHint = document.getElementById('modeHint');
const playAgainBtn = document.getElementById('playAgainBtn');
const modal = document.getElementById('modal');
const resultTitle = document.getElementById('resultTitle');
const resultText = document.getElementById('resultText');

let board = [];
let currentPlayer = HUMAN;
let moves = [];
let gameOver = false;
let gameMode = 'pvp';
let aiThinking = false;
let aiTimer = null;
let audioContext = null;
let soundEnabled = loadSoundSetting();

function loadSoundSetting() {
  try {
    return localStorage.getItem('gomoku-sound') !== 'off';
  } catch {
    return true;
  }
}

function saveSoundSetting() {
  try {
    localStorage.setItem('gomoku-sound', soundEnabled ? 'on' : 'off');
  } catch {
    // localStorage may be unavailable in private/file contexts; gameplay still works.
  }
}

function initGame() {
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  currentPlayer = HUMAN;
  moves = [];
  gameOver = false;
  aiThinking = false;
  modal.classList.add('hidden');
  renderBoard();
  updateModeUI();
  updateStatus();
}

function renderBoard() {
  boardEl.innerHTML = '';

  for (const [r, c] of STAR_POINTS) {
    const star = document.createElement('span');
    star.className = 'star';
    setBoardPosition(star, r, c);
    boardEl.appendChild(star);
  }

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      setBoardPosition(cell, r, c);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `第${r + 1}行，第${c + 1}列`);
      cell.disabled = gameOver || aiThinking || (gameMode === 'ai' && currentPlayer === AI);
      cell.addEventListener('click', () => handleCellClick(r, c));

      const value = board[r][c];
      if (value !== 0) {
        const piece = document.createElement('span');
        piece.className = `piece ${value === HUMAN ? 'black' : 'white'}`;
        const last = moves[moves.length - 1];
        if (last && last.r === r && last.c === c) piece.classList.add('last');
        cell.appendChild(piece);
      }

      boardEl.appendChild(cell);
    }
  }
}

function setBoardPosition(element, r, c) {
  element.style.setProperty('--x', `${(c / (SIZE - 1)) * 100}%`);
  element.style.setProperty('--y', `${(r / (SIZE - 1)) * 100}%`);
}

function handleCellClick(r, c) {
  if (gameOver || aiThinking || board[r][c] !== 0) return;
  if (gameMode === 'ai' && currentPlayer === AI) return;

  ensureAudioReady();
  makeMove(r, c, currentPlayer);
}

function makeMove(r, c, player) {
  if (!isInside(r, c) || board[r][c] !== 0 || gameOver) return false;

  board[r][c] = player;
  moves.push({ r, c, player });
  playMoveSound(player);

  if (hasWon(r, c, player)) {
    gameOver = true;
    aiThinking = false;
    renderBoard();
    updateStatus();
    playWinSound();
    setTimeout(() => showResult(player), 160);
    return true;
  }

  if (moves.length === SIZE * SIZE) {
    gameOver = true;
    aiThinking = false;
    renderBoard();
    updateStatus();
    playDrawSound();
    setTimeout(showDraw, 160);
    return true;
  }

  currentPlayer = player === HUMAN ? AI : HUMAN;
  renderBoard();
  updateStatus();

  if (gameMode === 'ai' && currentPlayer === AI && !gameOver) {
    scheduleAiMove();
  }
  return true;
}

function scheduleAiMove() {
  aiThinking = true;
  renderBoard();
  updateStatus();

  aiTimer = setTimeout(() => {
    aiTimer = null;
    if (gameOver || gameMode !== 'ai') {
      aiThinking = false;
      updateStatus();
      return;
    }

    const move = chooseAiMove();
    aiThinking = false;
    if (move) makeMove(move.r, move.c, AI);
  }, 360);
}

function chooseAiMove() {
  if (moves.length === 0) return { r: 7, c: 7 };

  const candidates = getCandidateMoves();

  const winning = candidates.find(({ r, c }) => isWinningMove(r, c, AI));
  if (winning) return winning;

  const mustBlock = candidates.find(({ r, c }) => isWinningMove(r, c, HUMAN));
  if (mustBlock) return mustBlock;

  let bestScore = -Infinity;
  let bestMoves = [];

  for (const move of candidates) {
    const attack = evaluateMove(move.r, move.c, AI);
    const defense = evaluateMove(move.r, move.c, HUMAN);
    const centerDistance = Math.abs(move.r - 7) + Math.abs(move.c - 7);
    const centerBonus = Math.max(0, 14 - centerDistance) * 3;
    const score = attack + defense * 1.12 + centerBonus;

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  return bestMoves[Math.floor(Math.random() * bestMoves.length)] || candidates[0] || null;
}

function getCandidateMoves() {
  const set = new Set();

  for (const move of moves) {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = move.r + dr;
        const c = move.c + dc;
        if (isInside(r, c) && board[r][c] === 0) set.add(`${r},${c}`);
      }
    }
  }

  if (set.size === 0) return [{ r: 7, c: 7 }];
  return [...set].map(key => {
    const [r, c] = key.split(',').map(Number);
    return { r, c };
  });
}

function isWinningMove(r, c, player) {
  board[r][c] = player;
  const won = hasWon(r, c, player);
  board[r][c] = 0;
  return won;
}

function evaluateMove(r, c, player) {
  if (board[r][c] !== 0) return -Infinity;
  board[r][c] = player;
  let score = 0;

  for (const [dr, dc] of DIRECTIONS) {
    const forward = countLine(r, c, dr, dc, player);
    const backward = countLine(r, c, -dr, -dc, player);
    const length = 1 + forward.count + backward.count;
    const openEnds = Number(forward.open) + Number(backward.open);
    score += patternScore(length, openEnds);
  }

  board[r][c] = 0;
  return score;
}

function countLine(r, c, dr, dc, player) {
  let count = 0;
  let nr = r + dr;
  let nc = c + dc;

  while (isInside(nr, nc) && board[nr][nc] === player) {
    count++;
    nr += dr;
    nc += dc;
  }

  return { count, open: isInside(nr, nc) && board[nr][nc] === 0 };
}

function patternScore(length, openEnds) {
  if (length >= 5) return 10_000_000;
  if (length === 4 && openEnds === 2) return 900_000;
  if (length === 4 && openEnds === 1) return 120_000;
  if (length === 3 && openEnds === 2) return 32_000;
  if (length === 3 && openEnds === 1) return 4_000;
  if (length === 2 && openEnds === 2) return 1_100;
  if (length === 2 && openEnds === 1) return 180;
  if (length === 1 && openEnds === 2) return 30;
  return 5;
}

function hasWon(r, c, player) {
  return DIRECTIONS.some(([dr, dc]) => {
    let count = 1;
    count += countDirection(r, c, dr, dc, player);
    count += countDirection(r, c, -dr, -dc, player);
    return count >= 5;
  });
}

function countDirection(r, c, dr, dc, player) {
  let count = 0;
  let nr = r + dr;
  let nc = c + dc;

  while (isInside(nr, nc) && board[nr][nc] === player) {
    count++;
    nr += dr;
    nc += dc;
  }
  return count;
}

function isInside(r, c) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function undoMove() {
  if (moves.length === 0) return;

  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
  aiThinking = false;
  gameOver = false;
  modal.classList.add('hidden');

  if (gameMode === 'ai') {
    const last = moves[moves.length - 1];
    const steps = last?.player === AI && moves.length >= 2 ? 2 : 1;
    for (let i = 0; i < steps; i++) removeLastMove();
    currentPlayer = HUMAN;
  } else {
    const last = moves[moves.length - 1];
    removeLastMove();
    currentPlayer = last.player;
  }

  renderBoard();
  updateStatus();
}

function removeLastMove() {
  const last = moves.pop();
  if (last) board[last.r][last.c] = 0;
}

function setGameMode(mode) {
  if (mode !== 'pvp' && mode !== 'ai') return;
  if (gameMode === mode) return;
  gameMode = mode;
  initGame();
}

function updateModeUI() {
  const aiMode = gameMode === 'ai';
  pvpModeBtn.classList.toggle('active', !aiMode);
  aiModeBtn.classList.toggle('active', aiMode);
  pvpModeBtn.setAttribute('aria-pressed', String(!aiMode));
  aiModeBtn.setAttribute('aria-pressed', String(aiMode));

  subtitle.textContent = aiMode
    ? '人机对战 · 你执黑棋，电脑执白棋'
    : '双人本地对战 · 连成五子即可获胜';
  modeHint.textContent = aiMode
    ? '你执黑先手；电脑会优先进攻、拦截五连，并根据棋形选择落点。'
    : '两名玩家在同一设备轮流落子。';
  blackLabel.textContent = aiMode ? '你（黑棋）' : '黑棋';
  whiteLabel.textContent = aiMode ? '电脑（白棋）' : '白棋';
}

function updateStatus() {
  const blackCount = moves.filter(m => m.player === HUMAN).length;
  const whiteCount = moves.filter(m => m.player === AI).length;

  blackCountEl.textContent = blackCount;
  whiteCountEl.textContent = whiteCount;
  moveCountEl.textContent = moves.length;
  undoBtn.disabled = moves.length === 0;

  const oldStone = turnIndicator.querySelector('.stone');
  oldStone.className = `stone ${currentPlayer === HUMAN ? 'black' : 'white'}`;
  thinkingBadge.classList.toggle('hidden', !aiThinking);

  if (gameOver) {
    turnText.textContent = '对局结束';
  } else if (gameMode === 'ai') {
    turnText.textContent = currentPlayer === HUMAN ? '你 · 黑棋' : '电脑 · 白棋';
  } else {
    turnText.textContent = currentPlayer === HUMAN ? '黑棋' : '白棋';
  }

  soundBtn.textContent = `音效：${soundEnabled ? '开' : '关'}`;
  soundBtn.setAttribute('aria-pressed', String(soundEnabled));
}

function showResult(player) {
  let name;
  if (gameMode === 'ai') name = player === HUMAN ? '你获胜了' : '电脑获胜';
  else name = player === HUMAN ? '黑棋获胜' : '白棋获胜';

  resultTitle.textContent = name;
  resultText.textContent = `第 ${moves.length} 手完成五子连线。`;
  modal.classList.remove('hidden');
}

function showDraw() {
  resultTitle.textContent = '平局';
  resultText.textContent = '棋盘已满，本局未分胜负。';
  modal.classList.remove('hidden');
}

function ensureAudioReady() {
  if (!soundEnabled) return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioContext) audioContext = new AudioCtx();
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  return audioContext;
}

function playTone(frequency, duration, volume = 0.035, delay = 0) {
  const ctx = ensureAudioReady();
  if (!ctx || !soundEnabled) return;

  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(Math.max(volume, 0.0001), start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function playMoveSound(player) {
  if (!soundEnabled) return;
  playTone(player === HUMAN ? 330 : 420, 0.065, 0.028);
}

function playWinSound() {
  if (!soundEnabled) return;
  [523.25, 659.25, 783.99].forEach((f, i) => playTone(f, 0.22, 0.035, i * 0.1));
}

function playDrawSound() {
  if (!soundEnabled) return;
  playTone(260, 0.13, 0.03);
  playTone(220, 0.18, 0.03, 0.12);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  saveSoundSetting();
  updateStatus();
  if (soundEnabled) {
    ensureAudioReady();
    playTone(500, 0.055, 0.02);
  }
}

undoBtn.addEventListener('click', undoMove);
soundBtn.addEventListener('click', toggleSound);
restartBtn.addEventListener('click', initGame);
playAgainBtn.addEventListener('click', initGame);
pvpModeBtn.addEventListener('click', () => setGameMode('pvp'));
aiModeBtn.addEventListener('click', () => setGameMode('ai'));

initGame();
