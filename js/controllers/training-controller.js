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
      return {
        active: false,
        suspended: false,
        mode: 'adaptive',
        index: 0,
        puzzles: [],
        target: null,
        feedback: '',
        result: null,
        sessionDone: false,
        sessionStats: { best: 0, good: 0, wrong: 0, answered: 0 },
      };
    }

    currentPuzzle() {
      return this.state.puzzles[this.state.index] || null;
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

    start(availablePuzzles, options = {}) {
      if (this.state.active || !availablePuzzles?.length) return false;
      const mode = options.mode || 'adaptive';
      let planned;

      if (options.puzzleId) {
        const selected = availablePuzzles.find(puzzle => puzzle.id === options.puzzleId);
        planned = selected ? [selected] : [];
      } else {
        planned = G.AdaptiveTraining.plan(availablePuzzles, this.progress, {
          mode,
          mistakes: options.mistakes || [],
          limit: options.limit || G.Config.TRAINING_SESSION_SIZE,
        });
      }

      if (!planned.length) return false;
      this.state = {
        active: true,
        suspended: false,
        mode,
        index: 0,
        puzzles: planned,
        target: this.makeTarget(planned[0]),
        feedback: '',
        result: null,
        sessionDone: false,
        sessionStats: { best: 0, good: 0, wrong: 0, answered: 0 },
      };
      return true;
    }

    handleMove(r, c) {
      if (
        !this.state.active
        || this.state.suspended
        || this.state.feedback
        || this.state.sessionDone
        || this.state.target.board[r][c] !== 0
      ) return false;

      const puzzle = this.currentPuzzle();
      const result = G.Puzzles.check(puzzle, r, c);
      this.state.result = result;
      this.state.feedback = result.message;
      this.state.target = this.makeTarget(puzzle, { r, c });
      this.state.sessionStats[result.grade] += 1;
      this.state.sessionStats.answered += 1;
      this.progress = G.TrainingScheduler.update(this.progress, puzzle.id, result);
      this.storage.saveTrainingProgress(this.progress);
      this.onProgressChange?.(this.progress);
      this.refresh();
      return true;
    }

    next() {
      if (!this.state.active || this.state.suspended || !this.state.feedback) return false;
      if (this.state.sessionDone) return 'exit';

      if (this.state.index >= this.state.puzzles.length - 1) {
        this.state.sessionDone = true;
        const stats = this.state.sessionStats;
        this.state.feedback = `本轮完成：最佳 ${stats.best} · 可接受 ${stats.good} · 待加强 ${stats.wrong}`;
        this.refresh();
        return 'done';
      }

      this.state.index += 1;
      this.state.feedback = '';
      this.state.result = null;
      this.state.target = this.makeTarget(this.currentPuzzle());
      this.refresh();
      return true;
    }

    suspend() {
      if (!this.state.active || this.state.suspended) return false;
      this.state.suspended = true;
      this.state.active = false;
      return true;
    }

    resume() {
      if (!this.state.suspended) return false;
      this.state.suspended = false;
      this.state.active = true;
      this.refresh();
      return true;
    }

    variationPosition() {
      const puzzle = this.currentPuzzle();
      if (!puzzle) return null;
      return {
        board: G.History.boardAt(puzzle.prefixMoves),
        currentPlayer: puzzle.player,
        rootLabel: `训练 · ${G.ErrorTaxonomy.info(puzzle.category).label}`,
      };
    }

    exit() {
      if (!this.state.active && !this.state.suspended) return false;
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
