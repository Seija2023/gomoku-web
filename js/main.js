(function (G) {
  const { WHITE, MODES, AI_DELAY_MS, RESULT_DELAY_MS } = G.Config;
  const game = new G.Game.Game();
  const audio = new G.Audio.AudioManager();
  const panel = new G.UI.PanelView(document);
  const boardView = new G.UI.BoardView(document.getElementById('board'), handleCellClick);

  let aiThinking = false;
  let aiTimer = null;
  let resultTimer = null;

  function clearTimers() {
    if (aiTimer) clearTimeout(aiTimer);
    if (resultTimer) clearTimeout(resultTimer);
    aiTimer = null;
    resultTimer = null;
    aiThinking = false;
  }

  function refresh() {
    const locked = aiThinking || (game.mode === MODES.AI && game.currentPlayer === WHITE);
    boardView.render(game, locked);
    panel.updateMode(game);
    panel.updateStatus(game, aiThinking, audio.enabled);
  }

  function restart() {
    clearTimers();
    game.reset();
    panel.hideModal();
    refresh();
  }

  function setMode(mode) {
    if (game.mode === mode) return;
    clearTimers();
    game.setMode(mode);
    panel.hideModal();
    refresh();
  }

  function handleCellClick(r, c) {
    if (game.gameOver || aiThinking || game.board[r][c] !== 0) return;
    if (game.mode === MODES.AI && game.currentPlayer === WHITE) return;
    audio.ensureReady();
    performMove(r, c);
  }

  function performMove(r, c) {
    const result = game.play(r, c);
    if (!result.ok) return false;

    audio.playMove(result.player);
    refresh();

    if (result.win) {
      audio.playWin();
      resultTimer = setTimeout(() => {
        resultTimer = null;
        if (game.gameOver) panel.showResult(game, result.player);
      }, RESULT_DELAY_MS);
      return true;
    }

    if (result.draw) {
      audio.playDraw();
      resultTimer = setTimeout(() => {
        resultTimer = null;
        if (game.gameOver) panel.showDraw();
      }, RESULT_DELAY_MS);
      return true;
    }

    if (game.mode === MODES.AI && game.currentPlayer === WHITE) scheduleAiMove();
    return true;
  }

  function scheduleAiMove() {
    aiThinking = true;
    refresh();
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (game.gameOver || game.mode !== MODES.AI || game.currentPlayer !== WHITE) {
        aiThinking = false;
        refresh();
        return;
      }

      const move = G.AI.chooseMove(game.board, game.moves);
      aiThinking = false;
      if (move) performMove(move.r, move.c);
      else refresh();
    }, AI_DELAY_MS);
  }

  function undo() {
    if (game.moves.length === 0) return;
    clearTimers();
    panel.hideModal();
    game.undo();
    refresh();
  }

  function toggleSound() {
    audio.toggle();
    panel.updateStatus(game, aiThinking, audio.enabled);
  }

  panel.bind({ undo, toggleSound, restart, setMode });
  restart();

  G.App = Object.freeze({
    restart,
    setMode,
    undo,
    getGame: () => game,
  });
})(window.Gomoku = window.Gomoku || {});
