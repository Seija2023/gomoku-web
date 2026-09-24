(function (G) {
  class TrainingWorkflow {
    constructor(options) {
      Object.assign(this, options);
    }

    blocked() {
      if (this.workspace) return !this.workspace.canEnterFromGame();
      return Boolean(
        this.reviewController.state.active
        || this.branchController.state.active
        || this.trainingController.state.active
        || this.trainingController.state.suspended
        || this.positionEditorController.state.active
        || this.variationController.state.active
      );
    }

    start(mode = 'adaptive', puzzleId = null) {
      const puzzles = this.getPuzzles?.() || [];
      if (this.blocked() || !puzzles.length) return false;

      this.gameController.clearTimers();
      this.panel.hideResult();
      if (!this.trainingController.start(puzzles, {
        mode,
        puzzleId,
        mistakes: this.getMistakes?.() || [],
      })) return false;

      this.refresh();
      return true;
    }

    startAdaptive() {
      return this.start('adaptive');
    }

    startMistakes() {
      return this.start('mistakes');
    }

    startOne(puzzleId) {
      return this.start('mistakes', puzzleId);
    }

    next() {
      const result = this.trainingController.next();
      if (result === 'exit') return this.exit();
      return Boolean(result);
    }

    openVariation() {
      if (!this.trainingController.state.active || !this.trainingController.state.feedback) return false;
      return this.variationWorkflow.startFromTraining();
    }

    exit() {
      if (!this.trainingController.exit()) return false;
      this.refresh();

      if (
        this.game.mode === G.Config.MODES.AI
        && this.game.currentPlayer === G.Config.WHITE
        && !this.game.gameOver
      ) {
        this.gameController.scheduleAiMove();
      } else if (this.game.gameOver) {
        this.panel.showResult(this.game);
      }
      return true;
    }
  }

  G.Training = G.Training || {};
  G.Training.Workflow = TrainingWorkflow;
})(window.Gomoku = window.Gomoku || {});
