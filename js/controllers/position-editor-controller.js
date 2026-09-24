(function (G) {
  const { BLACK, WHITE } = G.Config;

  class PositionEditorController {
    constructor({ refresh, flags }) {
      this.refresh = refresh;
      this.flags = flags;
      this.state = this.makeInitialState();
    }

    makeInitialState() {
      return {
        active: false,
        tool: 'black',
        analysisEnabled: false,
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
      this.state.tool = tool;
      this.refresh(this.flags.OVERLAYS);
      return true;
    }

    setNextPlayer(player) {
      if (!this.state.active || (player !== BLACK && player !== WHITE)) return false;
      if (!this.state.editor.setCurrentPlayer(player)) return false;
      this.refresh(this.flags.STATUS | this.flags.ANALYSIS | this.flags.OVERLAYS);
      return true;
    }

    handleCell(r, c) {
      if (!this.state.active) return false;
      let changed = false;
      if (this.state.tool === 'erase') changed = this.state.editor.erase(r, c);
      else changed = this.state.editor.place(r, c, this.state.tool === 'white' ? WHITE : BLACK);
      if (!changed) return false;
      this.refresh(this.flags.BOARD | this.flags.STATUS | this.flags.ANALYSIS | this.flags.OVERLAYS);
      return true;
    }

    clear() {
      if (!this.state.active) return false;
      this.state.editor.clear();
      this.refresh();
      return true;
    }

    restore() {
      if (!this.state.active || !this.state.editor.restore()) return false;
      this.refresh();
      return true;
    }

    toggleAnalysis() {
      if (!this.state.active) return false;
      this.state.analysisEnabled = !this.state.analysisEnabled;
      this.refresh(this.flags.ANALYSIS | this.flags.OVERLAYS | this.flags.STATUS);
      return true;
    }

    canStart() {
      if (!this.state.active) return false;
      const inspection = G.Position.inspectBoard(this.state.editor.board);
      return inspection.ok && !inspection.terminal;
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
  G.Controllers.PositionEditorController = PositionEditorController;
})(window.Gomoku = window.Gomoku || {});
