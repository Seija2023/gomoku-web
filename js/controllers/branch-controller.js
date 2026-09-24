(function (G) {
  class BranchController {
    constructor({ settings, aiClient, audio, refresh, flags }) {
      this.settings = settings;
      this.aiClient = aiClient;
      this.audio = audio;
      this.refresh = refresh;
      this.flags = flags;
      this.timer = null;
      this.state = this.makeInitialState();
    }

    makeInitialState() {
      return {
        active: false,
        game: null,
        originIndex: 0,
        humanPlayer: G.Config.BLACK,
        aiPlayer: G.Config.WHITE,
        aiThinking: false,
        lastInsight: null,
        shared: false,
      };
    }

    opponentOf(player) {
      return player === G.Config.BLACK ? G.Config.WHITE : G.Config.BLACK;
    }

    cancelPending() {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      this.aiClient.cancel('branch');
      this.state.aiThinking = false;
    }

    createFromPrefix(prefix, originIndex, shared) {
      const branchGame = new G.Game.Game();
      const nextPlayer = G.Position.nextPlayerFor(prefix);
      const restored = branchGame.restore({
        mode: G.Config.MODES.PVP,
        moves: G.Position.cloneMoves(prefix),
        currentPlayer: nextPlayer,
        gameOver: false,
      });
      if (!restored || branchGame.gameOver) return false;

      this.cancelPending();
      this.state = {
        active: true,
        game: branchGame,
        originIndex,
        humanPlayer: branchGame.currentPlayer,
        aiPlayer: this.opponentOf(branchGame.currentPlayer),
        aiThinking: false,
        lastInsight: null,
        shared: Boolean(shared),
      };
      return true;
    }

    start(prefix, originIndex) {
      return this.createFromPrefix(prefix, originIndex, false);
    }

    startShared(payload) {
      const prefix = G.Position.cloneMoves(payload.moves || []).slice(0, payload.index);
      return this.createFromPrefix(prefix, prefix.length, true);
    }

    handleMove(r, c) {
      const branchGame = this.state.game;
      if (!this.state.active || !branchGame || this.state.aiThinking || branchGame.gameOver) return false;
      if (branchGame.currentPlayer !== this.state.humanPlayer || branchGame.board[r][c] !== 0) return false;

      this.audio.ensureReady();
      const result = branchGame.play(r, c);
      if (!result.ok) return false;

      this.audio.playMove(result.player);
      this.refresh();

      if (result.win) {
        this.audio.playWin();
        return true;
      }
      if (result.draw) {
        this.audio.playDraw();
        return true;
      }

      this.scheduleAi();
      return true;
    }

    scheduleAi() {
      if (!this.state.active || !this.state.game || this.state.game.gameOver) return;
      this.state.aiThinking = true;
      this.refresh(this.flags.BOARD | this.flags.STATUS);

      this.timer = setTimeout(async () => {
        this.timer = null;

        if (
          !this.state.active
          || !this.state.game
          || this.state.game.gameOver
          || this.state.game.currentPlayer !== this.state.aiPlayer
        ) {
          this.state.aiThinking = false;
          this.refresh(this.flags.BOARD | this.flags.STATUS);
          return;
        }

        const response = await this.aiClient.chooseMove({
          board: this.state.game.board,
          moves: this.state.game.moves,
          difficulty: this.settings.difficulty,
          player: this.state.aiPlayer,
          persona: this.settings.persona,
          onProgress: () => this.refresh(this.flags.STATUS),
        }, 'branch');

        if (response.stale || !this.state.active) return;
        this.state.aiThinking = false;
        const detail = response.result;

        if (detail?.move) {
          this.state.lastInsight = { ...detail, move: { ...detail.move } };
          const result = this.state.game.play(detail.move.r, detail.move.c);
          if (result.ok) {
            this.audio.playMove(result.player);
            if (result.win) this.audio.playWin();
            else if (result.draw) this.audio.playDraw();
          }
        }
        this.refresh();
      }, G.Config.AI_DELAY_MS);
    }

    exit() {
      if (!this.state.active) return { exited: false, shared: false };
      const shared = this.state.shared;
      this.cancelPending();
      this.state = this.makeInitialState();
      return { exited: true, shared };
    }

    reset() {
      this.cancelPending();
      this.state = this.makeInitialState();
    }
  }

  G.Controllers = G.Controllers || {};
  G.Controllers.BranchController = BranchController;
})(window.Gomoku = window.Gomoku || {});
