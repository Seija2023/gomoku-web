(function (G) {
  const { SIZE, BLACK, STAR_POINTS } = G.Config;

  function setBoardPosition(element, r, c) {
    element.style.setProperty('--x', `${(c / (SIZE - 1)) * 100}%`);
    element.style.setProperty('--y', `${(r / (SIZE - 1)) * 100}%`);
  }

  class BoardView {
    constructor(element, onCellClick) {
      this.element = element;
      this.onCellClick = onCellClick;
    }

    render(game, locked = false) {
      this.element.innerHTML = '';

      for (const [r, c] of STAR_POINTS) {
        const star = document.createElement('span');
        star.className = 'star';
        setBoardPosition(star, r, c);
        this.element.appendChild(star);
      }

      const last = game.moves[game.moves.length - 1];
      for (let r = 0; r < SIZE; r += 1) {
        for (let c = 0; c < SIZE; c += 1) {
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'cell';
          cell.dataset.row = String(r);
          cell.dataset.col = String(c);
          setBoardPosition(cell, r, c);
          cell.setAttribute('role', 'gridcell');
          cell.setAttribute('aria-label', `第${r + 1}行，第${c + 1}列`);
          cell.disabled = game.gameOver || locked;
          cell.addEventListener('click', () => this.onCellClick(r, c));

          const value = game.board[r][c];
          if (value !== 0) {
            const piece = document.createElement('span');
            piece.className = `piece ${value === BLACK ? 'black' : 'white'}`;
            if (last && last.r === r && last.c === c) piece.classList.add('last');
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
