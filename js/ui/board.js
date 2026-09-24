(function (G) {
  const { SIZE, BLACK, STAR_POINTS, GHOST_HOLD_MS, GHOST_THROTTLE_MS } = G.Config;
  const { boardAt } = G.History;

  function setBoardPosition(element, r, c) {
    element.style.setProperty('--x', `${(c / (SIZE - 1)) * 100}%`);
    element.style.setProperty('--y', `${(r / (SIZE - 1)) * 100}%`);
  }

  function cellIndex(r, c) {
    return r * SIZE + c;
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
      this.cells = Array(SIZE * SIZE);
      this.renderedValues = new Uint8Array(SIZE * SIZE);
      this.heatMarkers = new Map();
      this.metrics = { initializations: 0, renders: 0, cellValueUpdates: 0, heatCreates: 0, heatRemoves: 0 };

      this.initializeBoard();
      this.bindDelegatedEvents();
    }

    initializeBoard() {
      this.metrics.initializations += 1;
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

      this.heatLayer = document.createElement('div');
      this.heatLayer.className = 'board-layer heat-layer';
      this.heatLayer.setAttribute('aria-hidden', 'true');
      this.element.appendChild(this.heatLayer);

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
          this.cells[cellIndex(r, c)] = cell;
          this.element.appendChild(cell);
        }
      }

      this.ghostLayer = document.createElement('div');
      this.ghostLayer.className = 'ghost-layer';
      this.ghostLayer.setAttribute('aria-hidden', 'true');
      this.element.appendChild(this.ghostLayer);
    }

    bindDelegatedEvents() {
      this.element.addEventListener('click', event => {
        const cell = event.target.closest('.cell');
        if (!cell || !this.element.contains(cell) || cell.disabled) return;
        if (Date.now() < this.suppressClickUntil) return;
        this.onCellClick(Number(cell.dataset.row), Number(cell.dataset.col));
      });

      this.element.addEventListener('pointerover', event => {
        if (event.pointerType !== 'mouse' || !this.ghostEnabled) return;
        const cell = event.target.closest('.cell');
        if (!cell || cell.disabled || !this.element.contains(cell)) return;
        const relatedCell = event.relatedTarget?.closest?.('.cell');
        if (relatedCell === cell) return;
        this.previewAt(Number(cell.dataset.row), Number(cell.dataset.col));
      });

      this.element.addEventListener('pointerout', event => {
        if (event.pointerType !== 'mouse') return;
        const cell = event.target.closest('.cell');
        if (!cell) return;
        const relatedCell = event.relatedTarget?.closest?.('.cell');
        if (relatedCell === cell) return;
        this.clearGhost();
      });

      this.element.addEventListener('pointerdown', event => {
        const cell = event.target.closest('.cell');
        if (!cell || !this.element.contains(cell)) return;
        this.startTouchPreview(
          event,
          Number(cell.dataset.row),
          Number(cell.dataset.col),
          cell.disabled,
        );
      });

      this.element.addEventListener('contextmenu', event => {
        if (this.ghostEnabled && event.target.closest('.cell')) event.preventDefault();
      });

      this.element.addEventListener('pointermove', event => this.handlePointerMove(event));
      this.element.addEventListener('pointerup', event => this.finishPointer(event));
      this.element.addEventListener('pointercancel', event => this.finishPointer(event));
      this.element.addEventListener('pointerleave', event => {
        if (event.pointerType !== 'mouse' && this.activePointerId === event.pointerId) this.finishPointer(event);
      });
    }

    clearHoldTimer() {
      if (this.holdTimer) clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    clearGhost() {
      if (this.ghostLayer) this.ghostLayer.replaceChildren();
      this.previewKey = null;
    }

    showGhostLine(preview) {
      this.clearGhost();
      const line = preview?.line || [];
      if (!line.length) return;

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
        this.ghostLayer.appendChild(svg);
      }

      line.forEach((point, index) => {
        const marker = document.createElement('span');
        marker.className = `ghost-piece ${point.player === BLACK ? 'black' : 'white'} ghost-${point.role || 'step'}`;
        marker.textContent = String(index + 1);
        marker.title = `${index + 1}. ${G.History.coordinate(point)}`;
        setBoardPosition(marker, point.r, point.c);
        this.ghostLayer.appendChild(marker);
      });
    }

    previewAt(r, c) {
      if (!this.ghostEnabled || !this.onCellPreview) return;
      const key = `${r},${c}`;
      if (key === this.previewKey) return;
      const now = Date.now();
      if (this.longPressActive && now - this.lastPreviewAt < GHOST_THROTTLE_MS) return;
      this.lastPreviewAt = now;
      const preview = this.onCellPreview(r, c);
      this.showGhostLine(preview);
      this.previewKey = preview ? key : null;
    }

    startTouchPreview(event, r, c, disabled) {
      if (!this.ghostEnabled || disabled || event.pointerType === 'mouse') return;
      this.clearHoldTimer();
      this.activePointerId = event.pointerId;
      this.holdTimer = setTimeout(() => {
        this.longPressActive = true;
        this.suppressClickUntil = Date.now() + 650;
        try { this.element.setPointerCapture?.(event.pointerId); } catch {}
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
      try {
        if (this.element.hasPointerCapture?.(event.pointerId)) this.element.releasePointerCapture(event.pointerId);
      } catch {}
      this.activePointerId = null;
    }

    updateHeatmap(heatmap, board) {
      const nextKeys = new Set();
      for (const point of heatmap) {
        if (board[point.r]?.[point.c] !== 0) continue;
        const key = `${point.r},${point.c}`;
        nextKeys.add(key);
        let marker = this.heatMarkers.get(key);
        if (!marker) {
          marker = document.createElement('span');
          marker.setAttribute('aria-hidden', 'true');
          setBoardPosition(marker, point.r, point.c);
          this.heatMarkers.set(key, marker);
          this.heatLayer.appendChild(marker);
          this.metrics.heatCreates += 1;
        }
        marker.className = `heat-point heat-${point.level}`;
        marker.title = point.title || '局势分析';
      }

      for (const [key, marker] of this.heatMarkers) {
        if (nextKeys.has(key)) continue;
        marker.remove();
        this.heatMarkers.delete(key);
        this.metrics.heatRemoves += 1;
      }
    }

    updatePiece(cell, value, isLast, isWinner) {
      let piece = cell.firstElementChild;
      const expectedSide = value === BLACK ? 'black' : 'white';

      if (!value) {
        if (piece) cell.replaceChildren();
        return;
      }

      if (!piece || !piece.classList.contains('piece') || !piece.classList.contains(expectedSide)) {
        piece = document.createElement('span');
        piece.className = `piece ${expectedSide}`;
        cell.replaceChildren(piece);
      }

      piece.classList.toggle('last', isLast);
      piece.classList.toggle('winner', isWinner);
    }

    render(game, options = {}) {
      this.metrics.renders += 1;
      const {
        locked = false,
        reviewIndex = null,
        winningLine = game.winningLine,
        heatmap = [],
        ghostEnabled = true,
        boardOverride = null,
        movesOverride = null,
        comparison = null,
      } = options;

      this.ghostEnabled = Boolean(ghostEnabled);
      this.element.classList.toggle('ghost-enabled', this.ghostEnabled);
      this.clearHoldTimer();
      this.clearGhost();

      const reviewMode = Number.isInteger(reviewIndex);
      const moves = movesOverride || (reviewMode ? game.moves.slice(0, reviewIndex) : game.moves);
      const board = boardOverride || (reviewMode ? boardAt(game.moves, reviewIndex) : game.board);
      const last = moves[moves.length - 1];
      const lastKey = last ? `${last.r},${last.c}` : '';
      const winningKeys = new Set((winningLine || []).map(cell => `${cell.r},${cell.c}`));
      const comparisonUserKey = comparison?.userLine ? `${comparison.userLine.r},${comparison.userLine.c}` : '';
      const comparisonAiKey = comparison?.recommendedLine ? `${comparison.recommendedLine.r},${comparison.recommendedLine.c}` : '';
      const disabled = locked || reviewMode || game.gameOver;

      for (let r = 0; r < SIZE; r += 1) {
        for (let c = 0; c < SIZE; c += 1) {
          const index = cellIndex(r, c);
          const cell = this.cells[index];
          const value = board[r][c];
          const key = `${r},${c}`;

          if (this.renderedValues[index] !== value) {
            this.renderedValues[index] = value;
            this.metrics.cellValueUpdates += 1;
            this.updatePiece(cell, value, key === lastKey, winningKeys.has(key));
          } else if (value) {
            const piece = cell.firstElementChild;
            piece?.classList.toggle('last', key === lastKey);
            piece?.classList.toggle('winner', winningKeys.has(key));
          }

          cell.classList.toggle('compare-user', key === comparisonUserKey);
          cell.classList.toggle('compare-ai', key === comparisonAiKey);
          if (cell.disabled !== disabled) cell.disabled = disabled;
        }
      }

      this.updateHeatmap(heatmap, board);
    }

    stats() {
      return { ...this.metrics, heatMarkers: this.heatMarkers.size };
    }
  }

  G.UI = G.UI || {};
  G.UI.BoardView = BoardView;
})(window.Gomoku = window.Gomoku || {});
