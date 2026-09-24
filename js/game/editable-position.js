(function (G) {
  const { BLACK, WHITE } = G.Config;

  class EditablePosition {
    constructor(position = null) {
      this.board = G.Position.emptyBoard();
      this.currentPlayer = BLACK;
      this.original = null;
      this.load(position || { board: this.board, currentPlayer: BLACK });
    }

    load(position, rememberOriginal = true) {
      const parsed = G.Position.fromBoard(position?.board || G.Position.emptyBoard(), position?.currentPlayer || BLACK);
      if (!parsed) return false;
      this.board = G.Position.cloneBoard(parsed.board);
      this.currentPlayer = parsed.currentPlayer;
      if (rememberOriginal) this.original = this.snapshot();
      return true;
    }

    setCurrentPlayer(player) {
      if (player !== BLACK && player !== WHITE) return false;
      this.currentPlayer = player;
      return true;
    }

    place(r, c, player) {
      if ((player !== BLACK && player !== WHITE) || !G.Rules.isInside(this.board, r, c)) return false;
      this.board[r][c] = player;
      return true;
    }

    erase(r, c) {
      if (!G.Rules.isInside(this.board, r, c)) return false;
      this.board[r][c] = 0;
      return true;
    }

    clear() {
      this.board = G.Position.emptyBoard();
      return true;
    }

    restore() {
      if (!this.original) return false;
      this.board = G.Position.cloneBoard(this.original.board);
      this.currentPlayer = this.original.currentPlayer;
      return true;
    }

    snapshot() {
      const inspection = G.Position.inspectBoard(this.board);
      return {
        board: G.Position.cloneBoard(this.board),
        moves: [],
        currentPlayer: this.currentPlayer,
        gameOver: false,
        terminal: inspection.terminal,
        winner: inspection.winner,
        winningLine: inspection.winningLine,
        source: 'editor',
      };
    }
  }

  G.EditablePosition = EditablePosition;
})(window.Gomoku = window.Gomoku || {});
