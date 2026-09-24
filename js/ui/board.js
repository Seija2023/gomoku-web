(function (G) {
  const { SIZE, BLACK, STAR_POINTS } = G.Config;
  const { boardAt } = G.History;

  function setBoardPosition(element, r, c) {
    element.style.setProperty('--x', `${(c / (SIZE - 1)) * 100}%`);
    element.style.setProperty('--y', `${(r / (SIZE - 1)) * 100}%`);
  }

  class BoardView {
    constructor(element, onCellClick) {
      this.element = element;
      this.onCellClick = onCellClick;
    }

    render(game, options = {}) {
      const { locked = false, reviewIndex = null, winningLine = game.winningLine } = options;
      const reviewMode = Number.isInteger(reviewIndex);
      const moves = reviewMode ? game.moves.slice(0, reviewIndex) : game.moves;
      const board = reviewMode ? boardAt(game.moves, reviewIndex) : game.board;
      const last = moves[moves.length - 1];
      const winningKeys = new Set((winningLine || []).map(cell => `${cell.r},${cell.c}`));

      this.element.innerHTML = '';

      for (let i = 0; i < SIZE; i += 1) {
        const top = document.createElement('span');
        top.className = 'coord coord-top';
        top.textContent = String.fromCharCode(65 + i);
        top.style.setProperty('--x', `${(i / (SIZE - 1)) * 100}%`);
        this.element.appendChild(top);

        const left = document.createElement('span');
        left.className = 'coord coord-left';
        left.textContent = String(i + 1);
        left.style.setProperty('--y', `${(i / (SIZE - 1)) * 100}%`);
        this.element.appendChild(left);
      }

      for (const [r, c] of STAR_POINTS) {
        const star = document.createElement('span');
        star.className = 'star';
        setBoardPosition(star, r, c);
        this.element.appendChild(star);
      }

      for (let r = 0; r < SIZE; r += 1) {
        for (let c = 0; c < SIZE; c += 1) {
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'cell';
          cell.dataset.row = String(r);
          cell.dataset.col = String(c);
          setBoardPosition(cell, r, c);
          cell.setAttribute('role', 'gridcell');
          cell.setAttribute('aria-label', `${String.fromCharCode(65 + c)}${r + 1}`);
          cell.disabled = locked || reviewMode || game.gameOver;
          cell.addEventListener('click', () => this.onCellClick(r, c));

          const value = board[r][c];
          if (value !== 0) {
            const piece = document.createElement('span');
            piece.className = `piece ${value === BLACK ? 'black' : 'white'}`;
            if (last && last.r === r && last.c === c) piece.classList.add('last');
            if (winningKeys.has(`${r},${c}`)) piece.classList.add('winner');
            cell.appendChild(piece);
          }
          this.element.appendChild(cell);
        }
      }
    }
  }

  G.UI = G.UI || {};
  G.UI.BoardView = BoardView;
})(window.Gomoku = window.Gomoku || {});
