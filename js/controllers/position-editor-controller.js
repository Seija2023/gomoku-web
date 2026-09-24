(function (G) {
  const { BLACK, WHITE } = G.Config;

  class PositionEditorController {
    constructor({ refresh, flags, aiClient, settings }) {
      this.refresh = refresh;
      this.flags = flags;
      this.aiClient = aiClient;
      this.settings = settings;
      this.state = this.makeInitialState();
    }

    makeInitialState() {
      return {
        active: false,
        tool: 'black',
        analysisEnabled: false,
        compareMode: false,
        comparing: false,
        comparison: null,
        editor: null,
      };
    }

    start(source) {
      if (this.state.active) return false;
      const editor = new G.EditablePosition({
        board: source?.board || G.Position.emptyBoard(),
        currentPlayer: source?.currentPlayer || BLACK,
      });
      this.state = {
        active: true,
        tool: 'black',
        analysisEnabled: false,
        compareMode: false,
        comparing: false,
        comparison: null,
        editor,
      };
      return true;
    }

    target() {
      if (!this.state.active || !this.state.editor) return null;
      return this.state.editor.snapshot();
    }

    setTool(tool) {
      if (!['black', 'white', 'erase'].includes(tool) || !this.state.active) return false;
      this.aiClient?.cancel?.('counterfactual');
      this.state.tool = tool;
      this.state.compareMode = false;
      this.state.comparing = false;
      this.refresh(this.flags.OVERLAYS | this.flags.BOARD);
      return true;
    }

    setNextPlayer(player) {
      if (!this.state.active || (player !== BLACK && player !== WHITE)) return false;
      if (!this.state.editor.setCurrentPlayer(player)) return false;
      this.aiClient?.cancel?.('counterfactual');
      this.state.comparing = false;
      this.state.comparison = null;
      this.refresh(this.flags.BOARD | this.flags.STATUS | this.flags.ANALYSIS | this.flags.OVERLAYS);
      return true;
    }

    async handleCell(r, c) {
      if (!this.state.active) return false;

      if (this.state.compareMode) {
        if (this.state.editor.board[r]?.[c] !== 0 || this.state.comparing) return false;
        this.state.comparing = true;
        this.state.comparison = null;
        this.refresh(this.flags.BOARD | this.flags.STATUS | this.flags.OVERLAYS);

        const target = this.target();
        const response = await this.aiClient.compareMove({
          board: target.board,
          moves: target.moves,
          player: target.currentPlayer,
          persona: this.settings.persona,
          userMove: { r, c },
        }, 'counterfactual');

        if (!this.state.active || response.stale) return false;
        this.state.comparing = false;
        this.state.comparison = response.result;
        this.refresh(this.flags.BOARD | this.flags.STATUS | this.flags.OVERLAYS);
        return Boolean(response.result);
      }

      let changed = false;
      if (this.state.tool === 'erase') changed = this.state.editor.erase(r, c);
      else changed = this.state.editor.place(r, c, this.state.tool === 'white' ? WHITE : BLACK);
      if (!changed) return false;
      this.aiClient?.cancel?.('counterfactual');
      this.state.comparing = false;
      this.state.comparison = null;
      this.refresh(this.flags.BOARD | this.flags.STATUS | this.flags.ANALYSIS | this.flags.OVERLAYS);
      return true;
    }

    clear() {
      if (!this.state.active) return false;
      this.aiClient?.cancel?.('counterfactual');
      this.state.comparing = false;
      this.state.comparison = null;
      this.state.editor.clear();
      this.refresh();
      return true;
    }

    restore() {
      if (!this.state.active || !this.state.editor.restore()) return false;
      this.aiClient?.cancel?.('counterfactual');
      this.state.comparing = false;
      this.state.comparison = null;
      this.refresh();
      return true;
    }

    toggleAnalysis() {
      if (!this.state.active) return false;
      this.state.analysisEnabled = !this.state.analysisEnabled;
      this.refresh(this.flags.ANALYSIS | this.flags.OVERLAYS | this.flags.STATUS);
      return true;
    }

    toggleCompareMode() {
      if (!this.state.active) return false;
      if (this.state.comparing) this.aiClient?.cancel?.('counterfactual');
      this.state.comparing = false;
      this.state.compareMode = !this.state.compareMode;
      this.refresh(this.flags.BOARD | this.flags.STATUS | this.flags.OVERLAYS);
      return true;
    }

    canStart() {
      if (!this.state.active) return false;
      const inspection = G.Position.inspectBoard(this.state.editor.board);
      return inspection.ok && !inspection.terminal;
    }

    exit() {
      if (!this.state.active) return false;
      this.aiClient?.cancel?.('counterfactual');
      this.state = this.makeInitialState();
      return true;
    }

    reset() {
      this.aiClient?.cancel?.('counterfactual');
      this.state = this.makeInitialState();
    }
  }

  G.Controllers = G.Controllers || {};
  G.Controllers.PositionEditorController = PositionEditorController;
})(window.Gomoku = window.Gomoku || {});
