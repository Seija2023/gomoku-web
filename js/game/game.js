(function (G) {
  const { SIZE, BLACK, WHITE, MODES } = G.Config;
  const { hasWon, isBoardFull, isInside } = G.Rules;

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
    }

    setMode(mode) {
      if (mode !== MODES.PVP && mode !== MODES.AI) return false;
      if (this.mode === mode) return false;
      this.reset(mode);
      return true;
    }

    play(r, c) {
      if (this.gameOver || !isInside(this.board, r, c) || this.board[r][c] !== 0) {
        return { ok: false };
      }

      const player = this.currentPlayer;
      this.board[r][c] = player;
      this.moves.push({ r, c, player });

      const win = hasWon(this.board, r, c, player);
      const draw = !win && isBoardFull(this.board);
      if (win || draw) {
        this.gameOver = true;
      } else {
        this.currentPlayer = player === BLACK ? WHITE : BLACK;
      }

      return { ok: true, player, win, draw, r, c };
    }

    undo() {
      if (this.moves.length === 0) return 0;
      this.gameOver = false;

      if (this.mode === MODES.AI) {
        const last = this.moves[this.moves.length - 1];
        const steps = last?.player === WHITE && this.moves.length >= 2 ? 2 : 1;
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
  }

  G.Game = Object.freeze({ Game });
})(window.Gomoku = window.Gomoku || {});
