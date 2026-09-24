(function (G) {
  const { SIZE, BLACK, WHITE, MODES } = G.Config;
  const { findWinningLine, isBoardFull, isInside } = G.Rules;

  class Game {
    constructor() {
      this.mode = MODES.PVP;
      this.reset();
    }

    reset(mode = this.mode) {
      this.mode = mode;
      this.board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
      this.currentPlayer = BLACK;
      this.moves = [];
      this.gameOver = false;
      this.winner = 0;
      this.winningLine = null;
    }

    setMode(mode) {
      if (mode !== MODES.PVP && mode !== MODES.AI) return false;
      if (this.mode === mode) return false;
      this.reset(mode);
      return true;
    }

    play(r, c) {
      if (this.gameOver || !isInside(this.board, r, c) || this.board[r][c] !== 0) return { ok: false };

      const player = this.currentPlayer;
      this.board[r][c] = player;
      this.moves.push({ r, c, player });

      const winningLine = findWinningLine(this.board, r, c, player);
      const win = Boolean(winningLine);
      const draw = !win && isBoardFull(this.board);

      if (win || draw) {
        this.gameOver = true;
        this.winner = win ? player : 0;
        this.winningLine = winningLine;
      } else {
        this.currentPlayer = player === BLACK ? WHITE : BLACK;
      }

      return { ok: true, player, win, draw, winningLine, r, c };
    }

    undo() {
      if (this.moves.length === 0) return 0;
      const wasOver = this.gameOver;
      this.gameOver = false;
      this.winner = 0;
      this.winningLine = null;

      if (this.mode === MODES.AI) {
        const last = this.moves[this.moves.length - 1];
        let steps;
        if (wasOver && last?.player === BLACK) steps = 1;
        else steps = last?.player === WHITE && this.moves.length >= 2 ? 2 : 1;
        for (let i = 0; i < steps; i += 1) this.removeLastMove();
        this.currentPlayer = BLACK;
        return steps;
      }

      const last = this.moves[this.moves.length - 1];
      this.removeLastMove();
      this.currentPlayer = last.player;
      return 1;
    }

    removeLastMove() {
      const last = this.moves.pop();
      if (last) this.board[last.r][last.c] = 0;
      return last || null;
    }

    snapshot() {
      return {
        version: 1,
        mode: this.mode,
        currentPlayer: this.currentPlayer,
        moves: this.moves.map(move => ({ ...move })),
        gameOver: this.gameOver,
        winner: this.winner,
      };
    }

    restore(snapshot) {
      if (!snapshot || !Array.isArray(snapshot.moves)) return false;
      const mode = snapshot.mode === MODES.AI ? MODES.AI : MODES.PVP;
      const validation = G.Position?.validateMoves?.(snapshot.moves);
      if (validation && !validation.ok) return false;
      this.reset(mode);

      for (const move of snapshot.moves) {
        if (!isInside(this.board, move.r, move.c) || this.board[move.r][move.c] !== 0 || move.player !== this.currentPlayer) {
          this.reset(mode);
          return false;
        }
        const result = this.play(move.r, move.c);
        if (!result.ok) {
          this.reset(mode);
          return false;
        }
      }

      if (!this.gameOver && (snapshot.currentPlayer === BLACK || snapshot.currentPlayer === WHITE)) {
        this.currentPlayer = snapshot.currentPlayer;
      }
      return true;
    }
  }

  G.Game = Object.freeze({ Game });
})(window.Gomoku = window.Gomoku || {});
