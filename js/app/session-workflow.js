(function (G) {
  const { WHITE, MODES } = G.Config;
  const { Activities } = G.AppCore;

  class SessionWorkflow {
    constructor(options) {
      Object.assign(this, options);
    }

    clearHash() {
      if (!location.hash) return;
      try {
        history.replaceState(null, '', `${location.pathname}${location.search}`);
      } catch {
        location.hash = '';
      }
    }

    resumeGame() {
      if (this.game.gameOver) {
        this.panel.showResult(this.game);
        return;
      }
      if (this.game.mode === MODES.AI && this.game.currentPlayer === WHITE) {
        this.gameController.scheduleAiMove();
      }
    }

    restart() {
      this.gameController.clearTimers();
      this.workspace.resetSpecialModes();
      this.boardView.clearGhost();
      this.panel.hideResult();
      this.storage.clearCurrent();
      this.gameController.resetMetadata();
      this.clearHash();
      this.game.reset();
      this.refresh();
      return true;
    }

    setMode(mode) {
      if (!this.workspace.canEnterFromGame() || this.game.mode === mode) return false;
      this.gameController.clearTimers();
      this.panel.hideResult();
      this.storage.clearCurrent();
      this.gameController.resetMetadata();
      this.game.setMode(mode);
      this.refresh();
      return true;
    }

    startReview(target = null, shared = false) {
      if (!this.workspace.canEnterFromGame()) return false;
      if (!target && this.game.customPosition) return false;
      this.gameController.clearTimers();
      this.panel.hideResult();
      this.reviewController.start(target || this.game, shared);
      this.refresh();
      return true;
    }

    exitReview() {
      const result = this.reviewController.exit();
      if (!result.exited) return false;
      if (result.shared) this.clearHash();
      this.refresh();
      this.resumeGame();
      return true;
    }

    startSharedChallenge(payload) {
      this.gameController.clearTimers();
      if (!this.branchController.startShared(payload)) return false;
      this.reviewController.reset();
      this.panel.hideResult();
      this.refresh();
      return true;
    }

    exitBranch() {
      const result = this.branchController.exit();
      if (!result.exited) return false;

      if (result.shared) {
        this.clearHash();
        this.game.reset();
        this.refresh();
        return true;
      }

      this.reviewController.resume();
      this.refresh();
      return true;
    }

    startPositionEditor() {
      if (!this.workspace.canEnterFromGame()) return false;
      this.gameController.clearTimers();
      this.panel.hideResult();
      this.boardView.clearGhost();
      if (!this.positionEditorController.start(this.game)) return false;
      this.refresh();
      return true;
    }

    exitPositionEditor() {
      if (!this.positionEditorController.exit()) return false;
      this.refresh();
      this.resumeGame();
      return true;
    }

    startGameFromEditor(mode) {
      if (
        !this.workspace.isActivity(Activities.POSITION_EDITOR)
        || this.positionEditorController.state.comparing
        || !this.positionEditorController.canStart()
      ) return false;

      const position = this.positionEditorController.target();
      this.gameController.clearTimers();
      this.panel.hideResult();
      this.storage.clearCurrent();
      this.gameController.resetMetadata();
      this.clearHash();

      if (!this.game.loadPosition(position, mode)) return false;
      this.positionEditorController.exit();
      this.storage.saveCurrent(this.game.snapshot());
      this.refresh();
      this.resumeGame();
      return true;
    }
  }

  G.AppCore = G.AppCore || {};
  G.AppCore.SessionWorkflow = SessionWorkflow;
})(window.Gomoku = window.Gomoku || {});
