(function (G) {
  class TrainingController {
    constructor({ storage, refresh, onProgressChange }) {
      this.storage = storage;
      this.refresh = refresh;
      this.onProgressChange = onProgressChange;
      this.progress = storage.loadTrainingProgress();
      this.state = this.makeInitialState();
    }

    makeInitialState() {
      return { active: false, index: 0, puzzles: [], target: null, feedback: '' };
    }

    makeTarget(puzzle, attempt = null) {
      const moves = G.Position.cloneMoves(puzzle.prefixMoves);
      if (attempt) moves.push({ ...attempt, player: puzzle.player });
      return {
        mode: puzzle.mode || G.Config.MODES.PVP,
        moves,
        board: G.History.boardAt(moves),
        currentPlayer: puzzle.player,
        gameOver: false,
        winner: 0,
        winningLine: null,
      };
    }

    start(availablePuzzles) {
      if (this.state.active || !availablePuzzles?.length) return false;
      const ordered = G.TrainingScheduler.order(availablePuzzles, this.progress);
      const now = Date.now();
      const due = ordered.filter(puzzle => {
        const item = G.TrainingScheduler.stateFor(this.progress, puzzle.id);
        return !item.dueAt || item.dueAt <= now;
      });
      this.state.puzzles = (due.length ? due : ordered).slice();
      this.state.index = 0;
      this.state.feedback = '';
      this.state.target = this.makeTarget(this.state.puzzles[0]);
      this.state.active = true;
      return true;
    }

    handleMove(r, c) {
      if (!this.state.active || this.state.feedback || this.state.target.board[r][c] !== 0) return false;
      const puzzle = this.state.puzzles[this.state.index];
      const result = G.Puzzles.check(puzzle, r, c);
      this.state.feedback = result.message;
      this.state.target = this.makeTarget(puzzle, { r, c });
      this.progress = G.TrainingScheduler.update(this.progress, puzzle.id, result.correct);
      this.storage.saveTrainingProgress(this.progress);
      this.onProgressChange?.(this.progress);
      this.refresh();
      return true;
    }

    next() {
      if (!this.state.active || !this.state.feedback) return;
      this.state.index = (this.state.index + 1) % this.state.puzzles.length;
      this.state.feedback = '';
      this.state.target = this.makeTarget(this.state.puzzles[this.state.index]);
      this.refresh();
    }

    exit() {
      if (!this.state.active) return false;
      this.state = this.makeInitialState();
      return true;
    }

    reset() {
      this.state = this.makeInitialState();
    }
  }

  G.Controllers = G.Controllers || {};
  G.Controllers.TrainingController = TrainingController;
})(window.Gomoku = window.Gomoku || {});
