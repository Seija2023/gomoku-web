(function (G) {
  const {
    BLACK,
    WHITE,
    MODES,
    AI_DIFFICULTIES,
    AI_DELAY_MS,
    RESULT_DELAY_MS,
    REVIEW_STEP_MS,
  } = G.Config;

  const game = new G.Game.Game();
  const audio = new G.Audio.AudioManager();
  const panel = new G.UI.PanelView(document);
  const reviewView = new G.UI.ReviewView(document);
  const insights = new G.UI.InsightsView(document);
  const boardView = new G.UI.BoardView(document.getElementById('board'), handleCellClick);

  let aiThinking = false;
  let aiTimer = null;
  let resultTimer = null;
  let currentHistoryId = null;
  let lastAiInsight = null;
  let availablePuzzles = [];
  const settings = G.Storage.loadSettings();

  const review = {
    active: false,
    index: 0,
    playing: false,
    timer: null,
    target: null,
    analysis: null,
    keyOnly: false,
  };

  const branchState = {
    active: false,
    game: null,
    originIndex: 0,
    humanPlayer: BLACK,
    aiPlayer: WHITE,
    aiThinking: false,
    lastInsight: null,
  };

  const training = {
    active: false,
    index: 0,
    puzzles: [],
    target: null,
    feedback: '',
  };

  function cloneMoves(moves) {
    return (moves || []).map(move => ({ ...move }));
  }

  function opponentOf(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function clearAiAndResultTimers() {
    if (aiTimer) clearTimeout(aiTimer);
    if (resultTimer) clearTimeout(resultTimer);
    aiTimer = null;
    resultTimer = null;
    aiThinking = false;
    branchState.aiThinking = false;
  }

  function stopReviewPlayback() {
    if (review.timer) clearTimeout(review.timer);
    review.timer = null;
    review.playing = false;
  }

  function makeReviewTarget(source) {
    const moves = cloneMoves(source.moves || []);
    return {
      mode: source.mode || MODES.PVP,
      moves,
      board: G.History.boardAt(moves),
      currentPlayer: source.currentPlayer || (moves.length % 2 === 0 ? BLACK : WHITE),
      gameOver: true,
      winner: source.winner || 0,
      winningLine: source.winningLine ? source.winningLine.map(cell => ({ ...cell })) : null,
    };
  }

  function makeTrainingTarget(puzzle, attempt = null) {
    const moves = cloneMoves(puzzle.prefixMoves);
    if (attempt) moves.push({ ...attempt, player: puzzle.player });
    return {
      mode: puzzle.mode || MODES.PVP,
      moves,
      board: G.History.boardAt(moves),
      currentPlayer: puzzle.player,
      gameOver: false,
      winner: 0,
      winningLine: null,
    };
  }

  function displayGame() {
    if (training.active) return training.target;
    if (branchState.active) return branchState.game;
    if (review.active) return review.target;
    return game;
  }

  function displayedBoardAndMoves(shown) {
    if (review.active) {
      return {
        board: G.History.boardAt(shown.moves, review.index),
        moves: shown.moves.slice(0, review.index),
      };
    }
    return { board: shown.board, moves: shown.moves };
  }

  function refreshDerived() {
    const records = G.Storage.listHistory();
    panel.renderHistory(records, openHistoryRecord);
    availablePuzzles = G.Puzzles.generate(records);
    insights.renderTrainingCount(availablePuzzles.length);
    insights.renderProfile(G.Profile.compute(records));
  }

  function saveSettings() {
    G.Storage.saveSettings(settings);
    insights.renderSettings(settings);
  }

  function refresh() {
    const shown = displayGame();
    const displayed = displayedBoardAndMoves(shown);

    let locked;
    let statusOverride = null;
    let thinking = aiThinking;

    if (training.active) {
      locked = Boolean(training.feedback);
      statusOverride = '残局训练';
      thinking = false;
    } else if (branchState.active) {
      locked = branchState.aiThinking
        || branchState.game.gameOver
        || branchState.game.currentPlayer !== branchState.humanPlayer;
      statusOverride = branchState.aiThinking ? '分支 AI 思考中' : '分支推演';
      thinking = branchState.aiThinking;
    } else if (review.active) {
      locked = true;
      statusOverride = '复盘中';
      thinking = false;
    } else {
      locked = aiThinking || (game.mode === MODES.AI && game.currentPlayer === WHITE);
    }

    let heatmap = [];
    if (settings.heatmap && !training.active && displayed.moves.length) {
      heatmap = G.Heatmap.generate(displayed.board, displayed.moves, settings.heatmapMode);
    }

    const reviewIndex = review.active ? review.index : null;
    const showWinningLine = review.active && review.index < shown.moves.length ? null : shown.winningLine;
    boardView.render(shown, { locked, reviewIndex, winningLine: showWinningLine, heatmap });

    let modePresentation = shown;
    if (branchState.active) modePresentation = { ...shown, mode: MODES.AI };
    panel.updateMode(modePresentation);
    panel.updateStatus(
      shown,
      thinking,
      audio.enabled,
      review.active || branchState.active || training.active,
      statusOverride,
    );

    insights.renderSettings(settings);
    insights.renderExplanation(branchState.active ? branchState.lastInsight : lastAiInsight);

    if (review.active) {
      reviewView.show();
      reviewView.render(
        shown.moves,
        review.index,
        review.playing,
        review.analysis,
        seekReview,
        review.keyOnly,
      );
    } else {
      reviewView.hide();
    }

    if (branchState.active) {
      insights.showBranch(branchState.originIndex, branchState.humanPlayer);
    } else {
      insights.hideBranch();
    }

    if (training.active) {
      insights.showTraining(
        training.puzzles[training.index],
        training.index,
        training.puzzles.length,
        training.feedback,
      );
    } else {
      insights.hideTraining();
    }
  }

  function persistCurrent() {
    if (!review.active && !branchState.active && !training.active) {
      G.Storage.saveCurrent(game.snapshot());
    }
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
      difficulty: settings.difficulty,
      moves: cloneMoves(game.moves),
      winner: game.winner,
      winningLine: game.winningLine ? game.winningLine.map(cell => ({ ...cell })) : null,
    };
  }

  function finishGame() {
    G.Storage.clearCurrent();
    G.Storage.saveFinished(createRecord());
    refreshDerived();
    resultTimer = setTimeout(() => {
      resultTimer = null;
      if (game.gameOver && !review.active && !branchState.active && !training.active) panel.showResult(game);
    }, RESULT_DELAY_MS);
  }

  function resetSpecialModes() {
    stopReviewPlayback();
    review.active = false;
    review.target = null;
    review.analysis = null;
    review.keyOnly = false;
    branchState.active = false;
    branchState.game = null;
    branchState.lastInsight = null;
    training.active = false;
    training.target = null;
    training.feedback = '';
  }

  function restart() {
    clearAiAndResultTimers();
    resetSpecialModes();
    panel.hideResult();
    G.Storage.clearCurrent();
    currentHistoryId = null;
    lastAiInsight = null;
    game.reset();
    refresh();
  }

  function setMode(mode) {
    if (review.active || branchState.active || training.active || game.mode === mode) return;
    clearAiAndResultTimers();
    panel.hideResult();
    G.Storage.clearCurrent();
    currentHistoryId = null;
    lastAiInsight = null;
    game.setMode(mode);
    refresh();
  }

  function handleCellClick(r, c) {
    if (training.active) {
      handleTrainingMove(r, c);
      return;
    }

    if (branchState.active) {
      handleBranchMove(r, c);
      return;
    }

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
      if (game.gameOver || review.active || branchState.active || training.active || game.mode !== MODES.AI || game.currentPlayer !== WHITE) {
        aiThinking = false;
        refresh();
        return;
      }

      const detail = G.AI.chooseMoveDetailed(game.board, game.moves, settings.difficulty, WHITE);
      aiThinking = false;
      if (detail.move) {
        lastAiInsight = { ...detail, move: { ...detail.move } };
        performMove(detail.move.r, detail.move.c);
      } else {
        refresh();
      }
    }, AI_DELAY_MS);
  }

  function undo() {
    if (review.active || branchState.active || training.active || game.moves.length === 0) return;
    const wasOver = game.gameOver;
    clearAiAndResultTimers();
    panel.hideResult();

    if (wasOver && currentHistoryId) G.Storage.removeHistory(currentHistoryId);
    if (wasOver) currentHistoryId = null;

    game.undo();
    lastAiInsight = null;
    persistCurrent();
    refreshDerived();
    refresh();
  }

  function toggleSound() {
    audio.toggle();
    refresh();
  }

  function startReview(target = null) {
    if (review.active || branchState.active || training.active) return;
    clearAiAndResultTimers();
    panel.hideResult();
    review.target = makeReviewTarget(target || game);
    review.analysis = G.Analyzer.analyze(review.target);
    review.index = review.target.moves.length;
    review.active = true;
    review.playing = false;
    review.keyOnly = false;
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

  function keyAnchors() {
    const anchors = [0, ...(review.analysis?.keyIndices || []), review.target.moves.length];
    return [...new Set(anchors)].sort((a, b) => a - b);
  }

  function seekRelative(delta) {
    if (!review.active) return;

    if (!review.keyOnly) {
      seekReview(review.index + delta);
      return;
    }

    const anchors = keyAnchors();
    if (delta > 0) {
      const next = anchors.find(value => value > review.index);
      seekReview(next ?? review.target.moves.length);
    } else {
      const prev = [...anchors].reverse().find(value => value < review.index);
      seekReview(prev ?? 0);
    }
  }

  function seekEnd() {
    seekReview(review.target.moves.length);
  }

  function toggleKeyOnly() {
    if (!review.active) return;
    review.keyOnly = !review.keyOnly;
    stopReviewPlayback();
    refresh();
  }

  function nextAutoReviewIndex() {
    if (!review.keyOnly) return Math.min(review.target.moves.length, review.index + 1);
    const anchors = keyAnchors();
    return anchors.find(value => value > review.index) ?? review.target.moves.length;
  }

  function reviewStep() {
    if (!review.active || !review.playing) return;
    if (review.index >= review.target.moves.length) {
      stopReviewPlayback();
      refresh();
      return;
    }

    review.index = nextAutoReviewIndex();
    refresh();
    review.timer = setTimeout(reviewStep, REVIEW_STEP_MS);
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
    review.timer = setTimeout(reviewStep, 420);
  }

  function exitReview() {
    if (!review.active) return;
    stopReviewPlayback();
    review.active = false;
    review.target = null;
    review.analysis = null;
    review.keyOnly = false;
    refresh();

    if (game.gameOver) panel.showResult(game);
    if (game.mode === MODES.AI && game.currentPlayer === WHITE && !game.gameOver) scheduleAiMove();
  }

  function startBranchFromReview() {
    if (!review.active || review.index >= review.target.moves.length) return;

    stopReviewPlayback();
    const prefix = review.target.moves.slice(0, review.index);
    const branchGame = new G.Game.Game();
    const nextPlayer = prefix.length % 2 === 0 ? BLACK : WHITE;
    branchGame.restore({
      mode: MODES.PVP,
      moves: prefix,
      currentPlayer: nextPlayer,
      gameOver: false,
    });

    branchState.game = branchGame;
    branchState.originIndex = review.index;
    branchState.humanPlayer = branchGame.currentPlayer;
    branchState.aiPlayer = opponentOf(branchState.humanPlayer);
    branchState.lastInsight = null;
    branchState.active = true;
    review.active = false;
    refresh();
  }

  function handleBranchMove(r, c) {
    const branchGame = branchState.game;
    if (!branchGame || branchState.aiThinking || branchGame.gameOver) return;
    if (branchGame.currentPlayer !== branchState.humanPlayer || branchGame.board[r][c] !== 0) return;

    audio.ensureReady();
    const result = branchGame.play(r, c);
    if (!result.ok) return;
    audio.playMove(result.player);
    refresh();

    if (result.win) {
      audio.playWin();
      refresh();
      return;
    }

    if (result.draw) {
      audio.playDraw();
      refresh();
      return;
    }

    scheduleBranchAi();
  }

  function scheduleBranchAi() {
    if (!branchState.active || !branchState.game || branchState.game.gameOver) return;
    branchState.aiThinking = true;
    refresh();

    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (!branchState.active || !branchState.game || branchState.game.gameOver || branchState.game.currentPlayer !== branchState.aiPlayer) {
        branchState.aiThinking = false;
        refresh();
        return;
      }

      const detail = G.AI.chooseMoveDetailed(
        branchState.game.board,
        branchState.game.moves,
        settings.difficulty,
        branchState.aiPlayer,
      );
      branchState.aiThinking = false;

      if (detail.move) {
        branchState.lastInsight = { ...detail, move: { ...detail.move } };
        const result = branchState.game.play(detail.move.r, detail.move.c);
        if (result.ok) {
          audio.playMove(result.player);
          if (result.win) audio.playWin();
          else if (result.draw) audio.playDraw();
        }
      }
      refresh();
    }, AI_DELAY_MS);
  }

  function exitBranch() {
    if (!branchState.active) return;
    clearAiAndResultTimers();
    branchState.active = false;
    branchState.game = null;
    branchState.lastInsight = null;
    review.active = true;
    refresh();
  }

  function startTraining() {
    if (review.active || branchState.active || training.active || !availablePuzzles.length) return;
    clearAiAndResultTimers();
    panel.hideResult();
    training.puzzles = availablePuzzles.slice();
    training.index = 0;
    training.feedback = '';
    training.target = makeTrainingTarget(training.puzzles[0]);
    training.active = true;
    refresh();
  }

  function handleTrainingMove(r, c) {
    if (!training.active || training.feedback || training.target.board[r][c] !== 0) return;
    const puzzle = training.puzzles[training.index];
    const result = G.Puzzles.check(puzzle, r, c);
    training.feedback = result.message;
    training.target = makeTrainingTarget(puzzle, { r, c });
    refresh();
  }

  function nextTraining() {
    if (!training.active || !training.feedback) return;
    training.index = (training.index + 1) % training.puzzles.length;
    training.feedback = '';
    training.target = makeTrainingTarget(training.puzzles[training.index]);
    refresh();
  }

  function exitTraining() {
    if (!training.active) return;
    training.active = false;
    training.target = null;
    training.feedback = '';
    refresh();

    if (game.mode === MODES.AI && game.currentPlayer === WHITE && !game.gameOver) scheduleAiMove();
    else if (game.gameOver) panel.showResult(game);
  }

  function changeDifficulty(value) {
    if (!Object.values(AI_DIFFICULTIES).includes(value)) return;
    settings.difficulty = value;
    saveSettings();
    refresh();
  }

  function toggleHeatmap() {
    settings.heatmap = !settings.heatmap;
    saveSettings();
    refresh();
  }

  function changeHeatmapMode(value) {
    if (!['combined', 'black', 'white'].includes(value)) return;
    settings.heatmapMode = value;
    saveSettings();
    refresh();
  }

  panel.bind({ undo, toggleSound, restart, setMode, startReview });
  reviewView.bind({
    seek: seekReview,
    seekRelative,
    seekEnd,
    togglePlay: toggleReviewPlay,
    exit: exitReview,
    startBranch: startBranchFromReview,
    toggleKeyOnly,
  });
  insights.bind({
    changeDifficulty,
    toggleHeatmap,
    changeHeatmapMode,
    startTraining,
    exitBranch,
    nextTraining,
    exitTraining,
  });

  refreshDerived();
  saveSettings();

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
    startBranchFromReview,
    startTraining,
    getGame: () => game,
    getSettings: () => ({ ...settings }),
  });
})(window.Gomoku = window.Gomoku || {});
