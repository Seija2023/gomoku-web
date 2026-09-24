(function (G) {
  class ReviewController {
    constructor({ analysisClient, refresh, flags }) {
      this.analysisClient = analysisClient;
      this.refresh = refresh;
      this.flags = flags;
      this.state = this.makeInitialState();
    }

    makeInitialState() {
      return {
        active: false,
        index: 0,
        playing: false,
        timer: null,
        target: null,
        analysis: null,
        advantage: [],
        keyOnly: false,
        shared: false,
      };
    }

    cloneMoves(moves) {
      return G.Position.cloneMoves(moves || []);
    }

    deriveWinningLine(moves, winner) {
      if (!winner || !moves.length) return null;
      const board = G.History.boardAt(moves);
      for (let i = moves.length - 1; i >= 0; i -= 1) {
        const move = moves[i];
        if (move.player !== winner) continue;
        const line = G.Rules.findWinningLine(board, move.r, move.c, winner);
        if (line) return line;
      }
      return null;
    }

    makeTarget(source) {
      const moves = this.cloneMoves(source.moves || []);
      const winner = source.winner || 0;
      return {
        mode: source.mode || G.Config.MODES.PVP,
        moves,
        board: G.History.boardAt(moves),
        currentPlayer: source.currentPlayer || G.Position.nextPlayerFor(moves),
        gameOver: true,
        winner,
        winningLine: source.winningLine
          ? source.winningLine.map(cell => ({ ...cell }))
          : this.deriveWinningLine(moves, winner),
      };
    }

    stopPlayback() {
      if (this.state.timer) clearTimeout(this.state.timer);
      this.state.timer = null;
      this.state.playing = false;
    }

    start(source, shared = false) {
      this.stopPlayback();
      const target = this.makeTarget(source);
      this.state.active = true;
      this.state.target = target;
      this.state.analysis = G.Analyzer.analyze(target);
      this.state.advantage = this.analysisClient.advantage(target.moves);
      this.state.index = target.moves.length;
      this.state.playing = false;
      this.state.keyOnly = false;
      this.state.shared = shared;
      return target;
    }

    exit() {
      if (!this.state.active) return { exited: false, shared: false };
      const shared = this.state.shared;
      this.stopPlayback();
      this.state = this.makeInitialState();
      return { exited: true, shared };
    }

    reset() {
      this.stopPlayback();
      this.state = this.makeInitialState();
    }

    deactivateForBranch() {
      this.stopPlayback();
      this.state.active = false;
    }

    resume() {
      if (this.state.target) this.state.active = true;
    }

    seek(index) {
      if (!this.state.active) return;
      this.stopPlayback();
      this.state.index = Math.max(0, Math.min(index, this.state.target.moves.length));
      this.refresh(this.flags.BOARD | this.flags.ANALYSIS | this.flags.REVIEW);
    }

    keyAnchors() {
      const anchors = [0, ...(this.state.analysis?.keyIndices || []), this.state.target.moves.length];
      return [...new Set(anchors)].sort((a, b) => a - b);
    }

    seekRelative(delta) {
      if (!this.state.active) return;
      if (!this.state.keyOnly) {
        this.seek(this.state.index + delta);
        return;
      }

      const anchors = this.keyAnchors();
      if (delta > 0) {
        const next = anchors.find(value => value > this.state.index);
        this.seek(next ?? this.state.target.moves.length);
      } else {
        const prev = [...anchors].reverse().find(value => value < this.state.index);
        this.seek(prev ?? 0);
      }
    }

    seekEnd() {
      if (this.state.target) this.seek(this.state.target.moves.length);
    }

    toggleKeyOnly() {
      if (!this.state.active) return;
      this.state.keyOnly = !this.state.keyOnly;
      this.stopPlayback();
      this.refresh(this.flags.REVIEW);
    }

    nextAutoIndex() {
      if (!this.state.keyOnly) return Math.min(this.state.target.moves.length, this.state.index + 1);
      const anchors = this.keyAnchors();
      return anchors.find(value => value > this.state.index) ?? this.state.target.moves.length;
    }

    step() {
      if (!this.state.active || !this.state.playing) return;
      if (this.state.index >= this.state.target.moves.length) {
        this.stopPlayback();
        this.refresh(this.flags.REVIEW);
        return;
      }

      this.state.index = this.nextAutoIndex();
      this.refresh(this.flags.BOARD | this.flags.ANALYSIS | this.flags.REVIEW);
      this.state.timer = setTimeout(() => this.step(), G.Config.REVIEW_STEP_MS);
    }

    togglePlay() {
      if (!this.state.active) return;

      if (this.state.playing) {
        this.stopPlayback();
        this.refresh(this.flags.REVIEW);
        return;
      }

      const restarted = this.state.index >= this.state.target.moves.length;
      if (restarted) this.state.index = 0;
      this.state.playing = true;
      this.refresh(restarted
        ? this.flags.BOARD | this.flags.ANALYSIS | this.flags.REVIEW
        : this.flags.REVIEW);
      this.state.timer = setTimeout(() => this.step(), 420);
    }

    branchData() {
      if (!this.state.active || this.state.index >= this.state.target.moves.length) return null;
      return {
        index: this.state.index,
        prefix: this.state.target.moves.slice(0, this.state.index),
      };
    }
  }

  G.Controllers = G.Controllers || {};
  G.Controllers.ReviewController = ReviewController;
})(window.Gomoku = window.Gomoku || {});
