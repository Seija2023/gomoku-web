(function (G) {
  class VariationWorkflow {
    constructor(options) {
      Object.assign(this, options);
    }

    blocked() {
      if (this.workspace) return !this.workspace.canEnterFromGame();
      return Boolean(
        this.reviewController.state.active
        || this.branchController.state.active
        || this.trainingController.state.active
        || this.positionEditorController.state.active
        || this.variationController.state.active
      );
    }

    startFromReview() {
      const data = this.reviewController.variationData();
      if (!data) return false;

      this.boardView.clearGhost();
      this.reviewController.deactivateForBranch();
      if (!this.variationController.startFromReview(data.prefix, data.index)) {
        this.reviewController.resume();
        return false;
      }
      this.refresh();
      return true;
    }

    startFromTraining() {
      const position = this.trainingController.variationPosition();
      if (!position || !this.trainingController.state.active) return false;

      this.boardView.clearGhost();
      if (!this.trainingController.suspend()) return false;
      if (!this.variationController.start({
        board: position.board,
        currentPlayer: position.currentPlayer,
      }, {
        rootLabel: position.rootLabel,
        source: 'training',
        origin: 'training',
      })) {
        this.trainingController.resume();
        return false;
      }
      this.refresh();
      return true;
    }

    startCurrent() {
      if (this.blocked()) return false;
      this.gameController.clearTimers();
      this.panel.hideResult();
      this.boardView.clearGhost();
      if (!this.variationController.startFromGame(this.game)) return false;
      this.refresh();
      return true;
    }

    resumeSaved() {
      if (this.blocked()) return false;
      this.gameController.clearTimers();
      this.panel.hideResult();
      this.boardView.clearGhost();
      if (!this.variationController.resumeSaved()) return false;
      this.refresh();
      return true;
    }

    exit() {
      const result = this.variationController.exit();
      if (!result.exited) return false;
      this.boardView.clearGhost();

      if (result.origin === 'review') this.reviewController.resume();
      if (result.origin === 'training') this.trainingController.resume();
      this.refresh();

      if (
        result.origin !== 'review'
        && result.origin !== 'training'
        && this.game.mode === G.Config.MODES.AI
        && this.game.currentPlayer === G.Config.WHITE
        && !this.game.gameOver
      ) {
        this.gameController.scheduleAiMove();
      } else if (result.origin !== 'review' && result.origin !== 'training' && this.game.gameOver) {
        this.panel.showResult(this.game);
      }
      return true;
    }

    toggleCandidateGhost(candidate) {
      if (!this.settings.ghost || !candidate?.line?.length) return false;
      const key = `${candidate.r},${candidate.c}`;
      const pinned = this.boardView.pinGhostLine({
        line: candidate.line.map(point => ({ ...point })),
        reply: candidate.reply || null,
        followUp: candidate.followUp || null,
      }, key);
      this.refresh(this.flags.ANALYSIS);
      return pinned;
    }
  }

  G.Lab = G.Lab || {};
  G.Lab.VariationWorkflow = VariationWorkflow;
})(window.Gomoku = window.Gomoku || {});
