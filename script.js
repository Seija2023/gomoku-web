const SIZE = 15;
const boardEl = document.getElementById('board');
const turnText = document.getElementById('turnText');
const turnIndicator = document.getElementById('turnIndicator');
const moveCountEl = document.getElementById('moveCount');
const blackCountEl = document.getElementById('blackCount');
const whiteCountEl = document.getElementById('whiteCount');
const undoBtn = document.getElementById('undoBtn');
const restartBtn = document.getElementById('restartBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const modal = document.getElementById('modal');
const resultTitle = document.getElementById('resultTitle');
const resultText = document.getElementById('resultText');

let board = [];
let currentPlayer = 1; // 1 = black, 2 = white
let moves = [];
let gameOver = false;

function initGame() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  currentPlayer = 1;
  moves = [];
  gameOver = false;
  modal.classList.add('hidden');
  renderBoard();
  updateStatus();
}

function renderBoard() {
  boardEl.innerHTML = '';

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `第${r + 1}行，第${c + 1}列`);
      cell.addEventListener('click', () => placeStone(r, c));

      const value = board[r][c];
      if (value !== 0) {
        const piece = document.createElement('span');
        piece.className = `piece ${value === 1 ? 'black' : 'white'}`;

        const last = moves[moves.length - 1];
        if (last && last.r === r && last.c === c) {
          piece.classList.add('last');
        }
        cell.appendChild(piece);
      }

      boardEl.appendChild(cell);
    }
  }
}

function placeStone(r, c) {
  if (gameOver || board[r][c] !== 0) return;

  board[r][c] = currentPlayer;
  moves.push({ r, c, player: currentPlayer });

  renderBoard();

  if (hasWon(r, c, currentPlayer)) {
    gameOver = true;
    updateStatus();
    setTimeout(() => showResult(currentPlayer), 180);
    return;
  }

  if (moves.length === SIZE * SIZE) {
    gameOver = true;
    setTimeout(showDraw, 180);
    return;
  }

  currentPlayer = currentPlayer === 1 ? 2 : 1;
  updateStatus();
}

function hasWon(r, c, player) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  return directions.some(([dr, dc]) => {
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

  while (
    nr >= 0 && nr < SIZE &&
    nc >= 0 && nc < SIZE &&
    board[nr][nc] === player
  ) {
    count++;
    nr += dr;
    nc += dc;
  }
  return count;
}

function undoMove() {
  if (moves.length === 0) return;

  const last = moves.pop();
  board[last.r][last.c] = 0;
  currentPlayer = last.player;
  gameOver = false;
  modal.classList.add('hidden');
  renderBoard();
  updateStatus();
}

function updateStatus() {
  const blackCount = moves.filter(m => m.player === 1).length;
  const whiteCount = moves.filter(m => m.player === 2).length;

  blackCountEl.textContent = blackCount;
  whiteCountEl.textContent = whiteCount;
  moveCountEl.textContent = moves.length;

  const oldStone = turnIndicator.querySelector('.stone');
  oldStone.className = `stone ${currentPlayer === 1 ? 'black' : 'white'}`;
  turnText.textContent = gameOver ? '对局结束' : (currentPlayer === 1 ? '黑棋' : '白棋');
}

function showResult(player) {
  const name = player === 1 ? '黑棋' : '白棋';
  resultTitle.textContent = `${name}获胜`;
  resultText.textContent = `第 ${moves.length} 手完成五子连线。`;
  modal.classList.remove('hidden');
}

function showDraw() {
  resultTitle.textContent = '平局';
  resultText.textContent = '棋盘已满，本局未分胜负。';
  modal.classList.remove('hidden');
}

undoBtn.addEventListener('click', undoMove);
restartBtn.addEventListener('click', initGame);
playAgainBtn.addEventListener('click', initGame);

initGame();
