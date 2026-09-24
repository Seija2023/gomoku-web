(function (G) {
  class GameController {
    constructor({
      game,
      settings,
      aiClient,
      audio,
      panel,
      storage,
      refresh,
      flags,
      isSpecialActive,
      onHistoryChanged,
    }) {
      this.game = game;
      this.settings = settings;
      this.aiClient = aiClient;
      this.audio = audio;
      this.panel = panel;
      this.storage = storage;
      this.refresh = refresh;
      this.flags = flags;
      this.isSpecialActive = isSpecialActive;
      this.onHistoryChanged = onHistoryChanged;

      this.aiThinking = false;
      this.aiTimer = null;
      this.resultTimer = null;
      this.currentHistoryId = null;
      this.lastAiInsight = null;
    }

    clearTimers() {
      if (this.aiTimer) clearTimeout(this.aiTimer);
      if (this.resultTimer) clearTimeout(this.resultTimer);
      this.aiTimer = null;
      this.resultTimer = null;
      this.aiClient.cancel('ai');
      this.aiThinking = false;
    }

    resetMetadata() {
      this.currentHistoryId = null;
      this.lastAiInsight = null;
    }

    persistCurrent() {
      if (!this.isSpecialActive()) this.storage.saveCurrent(this.game.snapshot());
    }

    createRecord() {
      if (!this.currentHistoryId) {
        this.currentHistoryId = (globalThis.crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : `game-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      }

      return {
        id: this.currentHistoryId,
        finishedAt: new Date().toISOString(),
        mode: this.game.mode,
        difficulty: this.settings.difficulty,
        persona: this.settings.persona,
        moves: G.Position.cloneMoves(this.game.moves),
        winner: this.game.winner,
        winningLine: this.game.winningLine ? this.game.winningLine.map(cell => ({ ...cell })) : null,
      };
    }

    finishGame() {
      this.storage.clearCurrent();
      if (!this.game.customPosition) {
        this.storage.saveFinished(this.createRecord());
        this.onHistoryChanged?.();
      }

      this.resultTimer = setTimeout(() => {
        this.resultTimer = null;
        if (this.game.gameOver && !this.isSpecialActive()) this.panel.showResult(this.game);
      }, G.Config.RESULT_DELAY_MS);
    }

    performMove(r, c) {
      const result = this.game.play(r, c);
      if (!result.ok) return false;

      this.audio.playMove(result.player);
      this.refresh();

      if (result.win) {
        this.audio.playWin();
        this.finishGame();
        return true;
      }

      if (result.draw) {
        this.audio.playDraw();
        this.finishGame();
        return true;
      }

      this.persistCurrent();
      if (this.game.mode === G.Config.MODES.AI && this.game.currentPlayer === G.Config.WHITE) {
        this.scheduleAiMove();
      }
      return true;
    }

    scheduleAiMove() {
      this.aiThinking = true;
      this.refresh(this.flags.BOARD | this.flags.STATUS);

      this.aiTimer = setTimeout(async () => {
        this.aiTimer = null;

        if (
          this.game.gameOver
          || this.isSpecialActive()
          || this.game.mode !== G.Config.MODES.AI
          || this.game.currentPlayer !== G.Config.WHITE
        ) {
          this.aiThinking = false;
          this.refresh(this.flags.BOARD | this.flags.STATUS);
          return;
        }

        const response = await this.aiClient.chooseMove({
          board: this.game.board,
          moves: this.game.moves,
          difficulty: this.settings.difficulty,
          player: G.Config.WHITE,
          persona: this.settings.persona,
          onProgress: () => this.refresh(this.flags.STATUS),
        }, 'ai');

        if (response.stale) return;
        this.aiThinking = false;
        const detail = response.result;

        if (detail?.move) {
          this.lastAiInsight = { ...detail, move: { ...detail.move } };
          this.performMove(detail.move.r, detail.move.c);
        } else {
          this.refresh(this.flags.BOARD | this.flags.STATUS);
        }
      }, G.Config.AI_DELAY_MS);
    }

    undo() {
      if (this.isSpecialActive() || this.game.moves.length === 0) return false;
      const wasOver = this.game.gameOver;
      this.clearTimers();
      this.panel.hideResult();

      if (wasOver && this.currentHistoryId) {
        this.storage.removeHistory(this.currentHistoryId);
        this.onHistoryChanged?.();
      }
      if (wasOver) this.currentHistoryId = null;

      this.game.undo();
      this.lastAiInsight = null;
      this.persistCurrent();
      this.refresh();
      return true;
    }

    stats() {
      return {
        aiThinking: this.aiThinking,
        hasAiTimer: Boolean(this.aiTimer),
        hasResultTimer: Boolean(this.resultTimer),
      };
    }
  }

  G.Controllers = G.Controllers || {};
  G.Controllers.GameController = GameController;
})(window.Gomoku = window.Gomoku || {});
