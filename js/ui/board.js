(function (G) {
  const { SIZE, BLACK, STAR_POINTS, GHOST_HOLD_MS, GHOST_THROTTLE_MS } = G.Config;
  const { boardAt } = G.History;

  function setBoardPosition(element, r, c) {
    element.style.setProperty('--x', `${(c / (SIZE - 1)) * 100}%`);
    element.style.setProperty('--y', `${(r / (SIZE - 1)) * 100}%`);
  }

  class BoardView {
    constructor(element, onCellClick, onCellPreview = null) {
      this.element = element;
      this.onCellClick = onCellClick;
      this.onCellPreview = onCellPreview;
      this.ghostEnabled = true;
      this.longPressActive = false;
      this.holdTimer = null;
      this.activePointerId = null;
      this.previewKey = null;
      this.lastPreviewAt = 0;
      this.suppressClickUntil = 0;

      this.element.addEventListener('pointermove', event => this.handlePointerMove(event));
      this.element.addEventListener('pointerup', event => this.finishPointer(event));
      this.element.addEventListener('pointercancel', event => this.finishPointer(event));
      this.element.addEventListener('pointerleave', event => {
        if (event.pointerType !== 'mouse' && this.longPressActive) this.finishPointer(event);
      });
    }

    clearHoldTimer() {
      if (this.holdTimer) clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    clearGhost() {
      this.element.querySelectorAll('.ghost-layer').forEach(node => node.remove());
      this.previewKey = null;
    }

    showGhostLine(preview) {
      this.clearGhost();
      const line = preview?.line || [];
      if (!line.length) return;

      const layer = document.createElement('div');
      layer.className = 'ghost-layer';
      layer.setAttribute('aria-hidden', 'true');

      if (line.length > 1) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'ghost-links');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        polyline.setAttribute('points', line.map(point =>
          `${(point.c / (SIZE - 1)) * 100},${(point.r / (SIZE - 1)) * 100}`
        ).join(' '));
        svg.appendChild(polyline);
        layer.appendChild(svg);
      }

      line.forEach((point, index) => {
        const marker = document.createElement('span');
        marker.className = `ghost-piece ${point.player === BLACK ? 'black' : 'white'} ghost-${point.role || 'step'}`;
        marker.textContent = String(index + 1);
        marker.title = `${index + 1}. ${G.History.coordinate(point)}`;
        setBoardPosition(marker, point.r, point.c);
        layer.appendChild(marker);
      });

      this.element.appendChild(layer);
    }

    previewAt(r, c) {
      if (!this.ghostEnabled || !this.onCellPreview) return;
      const key = `${r},${c}`;
      if (key === this.previewKey) return;
      const now = Date.now();
      if (this.longPressActive && now - this.lastPreviewAt < GHOST_THROTTLE_MS) return;
      this.lastPreviewAt = now;
      const preview = this.onCellPreview(r, c);
      this.previewKey = key;
      this.showGhostLine(preview);
    }

    startTouchPreview(event, r, c, disabled) {
      if (!this.ghostEnabled || disabled || event.pointerType === 'mouse') return;
      this.clearHoldTimer();
      this.activePointerId = event.pointerId;
      this.holdTimer = setTimeout(() => {
        this.longPressActive = true;
        this.suppressClickUntil = Date.now() + 650;
        this.previewAt(r, c);
      }, GHOST_HOLD_MS);
    }

    handlePointerMove(event) {
      if (!this.longPressActive || event.pointerId !== this.activePointerId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.cell');
      if (!target || !this.element.contains(target) || target.disabled) return;
      const r = Number(target.dataset.row);
      const c = Number(target.dataset.col);
      if (Number.isInteger(r) && Number.isInteger(c)) this.previewAt(r, c);
    }

    finishPointer(event) {
      if (this.activePointerId !== null && event.pointerId !== this.activePointerId) return;
      this.clearHoldTimer();
      if (this.longPressActive) {
        this.suppressClickUntil = Date.now() + 450;
        this.longPressActive = false;
        this.clearGhost();
      }
      this.activePointerId = null;
    }

    render(game, options = {}) {
      const {
        locked = false,
        reviewIndex = null,
        winningLine = game.winningLine,
        heatmap = [],
        ghostEnabled = true,
      } = options;
      this.ghostEnabled = Boolean(ghostEnabled);
      this.clearHoldTimer();
      this.clearGhost();

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

      for (const point of heatmap) {
        if (board[point.r]?.[point.c] !== 0) continue;
        const marker = document.createElement('span');
        marker.className = `heat-point heat-${point.level}`;
        marker.title = point.title || '局势分析';
        marker.setAttribute('aria-hidden', 'true');
        setBoardPosition(marker, point.r, point.c);
        this.element.appendChild(marker);
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

          cell.addEventListener('click', () => {
            if (Date.now() < this.suppressClickUntil) return;
            this.onCellClick(r, c);
          });

          cell.addEventListener('pointerenter', event => {
            if (event.pointerType === 'mouse' && !cell.disabled && this.ghostEnabled) this.previewAt(r, c);
          });
          cell.addEventListener('pointerleave', event => {
            if (event.pointerType === 'mouse') this.clearGhost();
          });
          cell.addEventListener('pointerdown', event => this.startTouchPreview(event, r, c, cell.disabled));
          cell.addEventListener('contextmenu', event => {
            if (this.ghostEnabled) event.preventDefault();
          });

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
