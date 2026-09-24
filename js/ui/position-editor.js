(function (G) {
  const { BLACK, WHITE } = G.Config;

  class PositionEditorView {
    constructor(doc) {
      this.openBtn = doc.getElementById('positionEditorBtn');
      this.card = doc.getElementById('positionEditorCard');
      this.blackTool = doc.getElementById('editorToolBlack');
      this.whiteTool = doc.getElementById('editorToolWhite');
      this.eraseTool = doc.getElementById('editorToolErase');
      this.nextPlayer = doc.getElementById('editorNextPlayer');
      this.clearBtn = doc.getElementById('editorClearBtn');
      this.restoreBtn = doc.getElementById('editorRestoreBtn');
      this.analyzeBtn = doc.getElementById('editorAnalyzeBtn');
      this.startPvpBtn = doc.getElementById('editorStartPvpBtn');
      this.startAiBtn = doc.getElementById('editorStartAiBtn');
      this.exitBtn = doc.getElementById('editorExitBtn');
      this.summary = doc.getElementById('editorSummary');
    }

    bind(handlers) {
      this.openBtn.addEventListener('click', handlers.start);
      this.blackTool.addEventListener('click', () => handlers.setTool('black'));
      this.whiteTool.addEventListener('click', () => handlers.setTool('white'));
      this.eraseTool.addEventListener('click', () => handlers.setTool('erase'));
      this.nextPlayer.addEventListener('change', () => handlers.setNextPlayer(Number(this.nextPlayer.value)));
      this.clearBtn.addEventListener('click', handlers.clear);
      this.restoreBtn.addEventListener('click', handlers.restore);
      this.analyzeBtn.addEventListener('click', handlers.toggleAnalysis);
      this.startPvpBtn.addEventListener('click', () => handlers.startGame(G.Config.MODES.PVP));
      this.startAiBtn.addEventListener('click', () => handlers.startGame(G.Config.MODES.AI));
      this.exitBtn.addEventListener('click', handlers.exit);
    }

    render(state, canStart = false) {
      const active = Boolean(state?.active && state.editor);
      this.card.classList.toggle('hidden', !active);
      this.openBtn.disabled = active;
      if (!active) return;

      const buttons = {
        black: this.blackTool,
        white: this.whiteTool,
        erase: this.eraseTool,
      };
      for (const [tool, button] of Object.entries(buttons)) {
        const selected = state.tool === tool;
        button.classList.toggle('active', selected);
        button.setAttribute('aria-pressed', String(selected));
      }

      this.nextPlayer.value = String(state.editor.currentPlayer);
      this.analyzeBtn.textContent = `AI分析：${state.analysisEnabled ? '开' : '关'}`;
      this.analyzeBtn.setAttribute('aria-pressed', String(state.analysisEnabled));

      const black = G.Position.countStones(state.editor.board, BLACK);
      const white = G.Position.countStones(state.editor.board, WHITE);
      const inspection = G.Position.inspectBoard(state.editor.board);
      const next = state.editor.currentPlayer === BLACK ? '黑' : '白';
      let status = `黑 ${black} · 白 ${white} · 下一手：${next}`;
      if (inspection.terminal) {
        if (inspection.winners?.length) status += ' · 当前已有五连，可分析但不能直接开始对局';
        else status += ' · 棋盘已满，可分析但不能直接开始对局';
      }
      this.summary.textContent = status;
      this.startPvpBtn.disabled = !canStart;
      this.startAiBtn.disabled = !canStart;
    }
  }

  G.UI = G.UI || {};
  G.UI.PositionEditorView = PositionEditorView;
})(window.Gomoku = window.Gomoku || {});
