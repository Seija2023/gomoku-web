(function (G) {
  const { BLACK, WHITE, MODES, AI_DELAY_MS, RESULT_DELAY_MS } = G.Config;
  const game = new G.Game.Game();
  const audio = new G.Audio.AudioManager();
  const panel = new G.UI.PanelView(document);
  const reviewView = new G.UI.ReviewView(document);
  const boardView = new G.UI.BoardView(document.getElementById('board'), handleCellClick);

  let aiThinking = false;
  let aiTimer = null;
  let resultTimer = null;
  let currentHistoryId = null;
  const review = { active: false, index: 0, playing: false, timer: null, target: null, analysis: null };

  function clearAiAndResultTimers() {
    if (aiTimer) clearTimeout(aiTimer);
    if (resultTimer) clearTimeout(resultTimer);
    aiTimer = null;
    resultTimer = null;
    aiThinking = false;
  }

  function stopReviewPlayback() {
    if (review.timer) clearTimeout(review.timer);
    review.timer = null;
    review.playing = false;
  }

  function cloneMoves(moves) {
    return moves.map(move => ({ ...move }));
  }

  function makeReviewTarget(source) {
    const moves = cloneMoves(source.moves || []);
    return {
      mode: source.mode || MODES.PVP,
      moves,
      board: G.History.boardAt(moves),
      currentPlayer: source.currentPlayer || BLACK,
      gameOver: true,
      winner: source.winner || 0,
      winningLine: source.winningLine ? source.winningLine.map(cell => ({ ...cell })) : null,
    };
  }

  function displayGame() {
    return review.active ? review.target : game;
  }

  function refreshHistory() {
    panel.renderHistory(G.Storage.listHistory(), openHistoryRecord);
  }

  function refresh() {
    const shown = displayGame();
    const locked = review.active || aiThinking || (game.mode === MODES.AI && game.currentPlayer === WHITE);
    const reviewIndex = review.active ? review.index : null;
    const showWinningLine = review.active && review.index < shown.moves.length ? null : shown.winningLine;
    boardView.render(shown, { locked, reviewIndex, winningLine: showWinningLine });
    panel.updateMode(shown);
    panel.updateStatus(shown, review.active ? false : aiThinking, audio.enabled, review.active);

    if (review.active) {
      reviewView.show();
      reviewView.render(shown.moves, review.index, review.playing, review.analysis, seekReview);
    } else {
      reviewView.hide();
    }
  }

  function persistCurrent() {
    if (!review.active) G.Storage.saveCurrent(game.snapshot());
  }

  function createRecord() {
    if (!currentHistoryId) {
      currentHistoryId = (globalThis.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : `game-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    return {
      id: currentHistoryId,
      finishedAt: new Date().toISOString(),
      mode: game.mode,
      moves: cloneMoves(game.moves),
      winner: game.winner,
      winningLine: game.winningLine ? game.winningLine.map(cell => ({ ...cell })) : null,
    };
  }

  function finishGame() {
    G.Storage.clearCurrent();
    G.Storage.saveFinished(createRecord());
    refreshHistory();
    resultTimer = setTimeout(() => {
      resultTimer = null;
      if (game.gameOver && !review.active) panel.showResult(game);
    }, RESULT_DELAY_MS);
  }

  function restart() {
    clearAiAndResultTimers();
    stopReviewPlayback();
    review.active = false;
    review.target = null;
    review.analysis = null;
    panel.hideResult();
    G.Storage.clearCurrent();
    currentHistoryId = null;
    game.reset();
    refresh();
  }

  function setMode(mode) {
    if (review.active || game.mode === mode) return;
    clearAiAndResultTimers();
    panel.hideResult();
    G.Storage.clearCurrent();
    currentHistoryId = null;
    game.setMode(mode);
    refresh();
  }

  function handleCellClick(r, c) {
    if (review.active || game.gameOver || aiThinking || game.board[r][c] !== 0) return;
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
      finishGame();
      return true;
    }
    if (result.draw) {
      audio.playDraw();
      finishGame();
      return true;
    }

    persistCurrent();
    if (game.mode === MODES.AI && game.currentPlayer === WHITE) scheduleAiMove();
    return true;
  }

  function scheduleAiMove() {
    aiThinking = true;
    refresh();
    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (game.gameOver || review.active || game.mode !== MODES.AI || game.currentPlayer !== WHITE) {
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
    if (review.active || game.moves.length === 0) return;
    const wasOver = game.gameOver;
    clearAiAndResultTimers();
    panel.hideResult();
    if (wasOver && currentHistoryId) G.Storage.removeHistory(currentHistoryId);
    if (wasOver) currentHistoryId = null;
    game.undo();
    persistCurrent();
    refreshHistory();
    refresh();
  }

  function toggleSound() {
    audio.toggle();
    panel.updateStatus(displayGame(), review.active ? false : aiThinking, audio.enabled, review.active);
  }

  function startReview(target = null) {
    if (review.active) return;
    clearAiAndResultTimers();
    panel.hideResult();
    review.target = makeReviewTarget(target || game);
    review.analysis = G.Analyzer.analyze(review.target);
    review.index = review.target.moves.length;
    review.active = true;
    review.playing = false;
    refresh();
  }

  function openHistoryRecord(record) {
    startReview(record);
  }

  function seekReview(index) {
    if (!review.active) return;
    stopReviewPlayback();
    review.index = Math.max(0, Math.min(index, review.target.moves.length));
    refresh();
  }

  function seekRelative(delta) {
    seekReview(review.index + delta);
  }

  function seekEnd() {
    seekReview(review.target.moves.length);
  }

  function reviewStep() {
    if (!review.active || !review.playing) return;
    if (review.index >= review.target.moves.length) {
      stopReviewPlayback();
      refresh();
      return;
    }
    review.index += 1;
    refresh();
    review.timer = setTimeout(reviewStep, 650);
  }

  function toggleReviewPlay() {
    if (!review.active) return;
    if (review.playing) {
      stopReviewPlayback();
      refresh();
      return;
    }
    if (review.index >= review.target.moves.length) review.index = 0;
    review.playing = true;
    refresh();
    review.timer = setTimeout(reviewStep, 500);
  }

  function exitReview() {
    if (!review.active) return;
    stopReviewPlayback();
    review.active = false;
    review.target = null;
    review.analysis = null;
    refresh();
    if (game.gameOver) panel.showResult(game);
    if (game.mode === MODES.AI && game.currentPlayer === WHITE && !game.gameOver) scheduleAiMove();
  }

  panel.bind({ undo, toggleSound, restart, setMode, startReview });
  reviewView.bind({ seek: seekReview, seekRelative, seekEnd, togglePlay: toggleReviewPlay, exit: exitReview });
  refreshHistory();

  const saved = G.Storage.loadCurrent();
  if (saved && game.restore(saved) && game.moves.length && !game.gameOver) {
    panel.showResumeNotice();
    refresh();
    if (game.mode === MODES.AI && game.currentPlayer === WHITE) scheduleAiMove();
  } else {
    G.Storage.clearCurrent();
    restart();
  }

  G.App = Object.freeze({
    restart,
    setMode,
    undo,
    startReview,
    exitReview,
    getGame: () => game,
  });
})(window.Gomoku = window.Gomoku || {});
