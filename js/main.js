(function (G) {
  const { BLACK, WHITE, MODES, AI_DIFFICULTIES, AI_PERSONAS } = G.Config;
  const { RenderFlags, hasRenderFlag } = G.AppCore;

  const game = new G.Game.Game();
  const audio = new G.Audio.AudioManager();
  const panel = new G.UI.PanelView(document);
  const reviewView = new G.UI.ReviewView(document);
  const insights = new G.UI.InsightsView(document);
  const positionEditorView = new G.UI.PositionEditorView(document);
  const settings = G.Storage.loadSettings();

  const analysisService = new G.Services.AnalysisService();
  const derivedService = new G.Services.DerivedService();
  const requestGate = new G.Services.RequestGate();
  const aiClient = G.Services.createAIClient
    ? G.Services.createAIClient(analysisService, requestGate)
    : new G.Services.MainThreadAIClient(analysisService, requestGate);
  const shareController = new G.Controllers.ShareController(insights);

  let availablePuzzles = [];

  const reviewController = new G.Controllers.ReviewController({
    analysisClient: aiClient,
    refresh,
    flags: RenderFlags,
  });

  const trainingController = new G.Controllers.TrainingController({
    storage: G.Storage,
    refresh,
    onProgressChange: () => {
      derivedService.invalidateTraining();
      refreshTrainingDerived();
    },
  });

  const branchController = new G.Controllers.BranchController({
    settings,
    aiClient,
    audio,
    refresh,
    flags: RenderFlags,
  });

  const positionEditorController = new G.Controllers.PositionEditorController({
    refresh,
    flags: RenderFlags,
    aiClient,
    settings,
  });

  const gameController = new G.Controllers.GameController({
    game,
    settings,
    aiClient,
    audio,
    panel,
    storage: G.Storage,
    refresh,
    flags: RenderFlags,
    isSpecialActive: () => (
      reviewController.state.active
      || branchController.state.active
      || trainingController.state.active
      || positionEditorController.state.active
    ),
    onHistoryChanged: () => {
      derivedService.invalidateHistory();
      refreshDerived();
    },
  });

  const boardView = new G.UI.BoardView(
    document.getElementById('board'),
    handleCellClick,
    handleCellPreview,
  );

  const advantageChart = new G.UI.AdvantageChart(
    document.getElementById('advantageChart'),
    document.getElementById('advantageLabel'),
    index => reviewController.seek(index),
  );

  function clearHash() {
    if (!location.hash) return;
    try {
      history.replaceState(null, '', `${location.pathname}${location.search}`);
    } catch {
      location.hash = '';
    }
  }

  function refreshTrainingDerived(records = G.Storage.listHistory()) {
    const derived = derivedService.training(records, trainingController.progress);
    availablePuzzles = derived.puzzles;
    insights.renderTrainingCount(derived.trainingStats.due, derived.trainingStats.total);
    insights.renderTrainingStats(derived.trainingStats);
    return derived;
  }

  function refreshDerived() {
    const records = G.Storage.listHistory();
    const derived = refreshTrainingDerived(records);
    panel.renderHistory(records, openHistoryRecord);
    insights.renderProfile(derived.profile);
    insights.renderOpenings(derived.openings);
  }

  function displayGame() {
    if (positionEditorController.state.active) return positionEditorController.target();
    if (trainingController.state.active) return trainingController.state.target;
    if (branchController.state.active) return branchController.state.game;
    if (reviewController.state.active) return reviewController.state.target;
    return game;
  }

  function displayedBoardAndMoves(shown) {
    const review = reviewController.state;
    if (review.active) {
      return {
        board: G.History.boardAt(shown.moves, review.index),
        moves: shown.moves.slice(0, review.index),
      };
    }
    return { board: shown.board, moves: shown.moves };
  }

  function analysisPlayer(shown) {
    const training = trainingController.state;
    const review = reviewController.state;
    const editor = positionEditorController.state;

    if (editor.active) return editor.analysisEnabled ? shown.currentPlayer : null;
    if (training.active) return training.puzzles[training.index]?.player || BLACK;
    if (review.active) {
      if (review.index >= shown.moves.length) return null;
      return review.index % 2 === 0 ? BLACK : WHITE;
    }
    if (shown.gameOver) return null;
    return shown.currentPlayer;
  }

  function interactionState(shown) {
    const training = trainingController.state;
    const branch = branchController.state;
    const review = reviewController.state;
    const editor = positionEditorController.state;

    if (editor.active) {
      return {
        locked: false,
        statusOverride: editor.comparing
          ? '反事实分析中'
          : editor.compareMode
            ? '选择要比较的下一手'
            : editor.analysisEnabled ? '摆局分析' : '自由摆局',
        thinking: editor.comparing,
      };
    }

    if (training.active) {
      return { locked: Boolean(training.feedback), statusOverride: '残局训练', thinking: false };
    }

    if (branch.active) {
      const locked = branch.aiThinking
        || branch.game.gameOver
        || branch.game.currentPlayer !== branch.humanPlayer;
      return {
        locked,
        statusOverride: branch.shared
          ? (branch.aiThinking ? '挑战 AI 思考中' : '分享挑战')
          : (branch.aiThinking ? '分支 AI 思考中' : '分支推演'),
        thinking: branch.aiThinking,
      };
    }

    if (review.active) {
      return { locked: true, statusOverride: '复盘中', thinking: false };
    }

    return {
      locked: gameController.aiThinking || (game.mode === MODES.AI && game.currentPlayer === WHITE),
      statusOverride: null,
      thinking: gameController.aiThinking,
    };
  }

  function refresh(mask = RenderFlags.ALL) {
    const review = reviewController.state;
    const branch = branchController.state;
    const training = trainingController.state;
    const editor = positionEditorController.state;
    const shown = displayGame();

    const needsDisplayed =
      hasRenderFlag(mask, RenderFlags.BOARD)
      || hasRenderFlag(mask, RenderFlags.ANALYSIS);
    const displayed = needsDisplayed ? displayedBoardAndMoves(shown) : null;

    const needsInteraction =
      hasRenderFlag(mask, RenderFlags.BOARD)
      || hasRenderFlag(mask, RenderFlags.STATUS);
    const state = needsInteraction ? interactionState(shown) : null;

    if (hasRenderFlag(mask, RenderFlags.BOARD)) {
      let heatmap = [];
      if (settings.heatmap && !training.active && !editor.active && G.Position.countStones(displayed.board)) {
        heatmap = aiClient.heatmap({
          board: displayed.board,
          moves: displayed.moves,
          mode: settings.heatmapMode,
        });
      }

      const reviewIndex = review.active ? review.index : null;
      const showWinningLine = review.active && review.index < shown.moves.length
        ? null
        : shown.winningLine;
      const ghostEnabled = settings.ghost
        && !training.active
        && !review.active
        && !editor.active
        && !state.locked;

      boardView.render(shown, {
        locked: state.locked,
        reviewIndex,
        winningLine: showWinningLine,
        heatmap,
        ghostEnabled,
        boardOverride: displayed.board,
        movesOverride: displayed.moves,
        comparison: editor.active ? editor.comparison : null,
      });
    }

    if (hasRenderFlag(mask, RenderFlags.STATUS)) {
      const modePresentation = branch.active ? { ...shown, mode: MODES.AI } : shown;
      panel.updateMode(modePresentation);
      panel.updateStatus(
        shown,
        state.thinking,
        audio.enabled,
        review.active || branch.active || training.active || editor.active,
        state.statusOverride,
      );
      insights.renderSearchStatus(aiClient.progress?.() || null);
    }

    if (hasRenderFlag(mask, RenderFlags.SETTINGS)) {
      insights.renderSettings(settings);
    }

    if (hasRenderFlag(mask, RenderFlags.ANALYSIS)) {
      insights.renderExplanation(branch.active ? branch.lastInsight : gameController.lastAiInsight);
      const player = training.active ? null : analysisPlayer(shown);
      const canAnalyze = editor.active ? editor.analysisEnabled : displayed.moves.length > 0;
      const candidates = player && canAnalyze
        ? aiClient.candidates({
            board: displayed.board,
            moves: displayed.moves,
            player,
            persona: settings.persona,
            limit: 3,
          })
        : [];
      insights.renderCandidates(candidates, player);
    }

    if (hasRenderFlag(mask, RenderFlags.REVIEW)) {
      if (review.active) {
        reviewView.show();
        reviewView.render(
          shown.moves,
          review.index,
          review.playing,
          review.analysis,
          index => reviewController.seek(index),
          review.keyOnly,
        );
        advantageChart.set(review.advantage, review.index);
      } else {
        reviewView.hide();
        advantageChart.set([], 0);
      }
    }

    if (hasRenderFlag(mask, RenderFlags.OVERLAYS)) {
      if (branch.active) {
        insights.showBranch(branch.originIndex, branch.humanPlayer, branch.shared);
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

      positionEditorView.render(editor, positionEditorController.canStart());
    }
  }

  function handleCellPreview(r, c) {
    const review = reviewController.state;
    const training = trainingController.state;
    const branch = branchController.state;
    const editor = positionEditorController.state;

    if (!settings.ghost || review.active || training.active || editor.active) return null;
    const shown = displayGame();
    if (!shown || shown.gameOver || shown.board[r]?.[c] !== 0) return null;
    if (branch.active && shown.currentPlayer !== branch.humanPlayer) return null;
    if (!branch.active && shown.mode === MODES.AI && shown.currentPlayer === WHITE) return null;

    return aiClient.preview({
      board: shown.board,
      moves: shown.moves,
      r,
      c,
      player: shown.currentPlayer,
      persona: settings.persona,
    });
  }

  function resetSpecialModes() {
    reviewController.reset();
    branchController.reset();
    trainingController.reset();
    positionEditorController.reset();
  }

  function restart() {
    gameController.clearTimers();
    resetSpecialModes();
    panel.hideResult();
    G.Storage.clearCurrent();
    gameController.resetMetadata();
    clearHash();
    game.reset();
    refresh();
  }

  function setMode(mode) {
    if (
      reviewController.state.active
      || branchController.state.active
      || trainingController.state.active
      || positionEditorController.state.active
      || game.mode === mode
    ) return;

    gameController.clearTimers();
    panel.hideResult();
    G.Storage.clearCurrent();
    gameController.resetMetadata();
    game.setMode(mode);
    refresh();
  }

  function handleCellClick(r, c) {
    if (positionEditorController.state.active) {
      positionEditorController.handleCell(r, c);
      return;
    }

    if (trainingController.state.active) {
      trainingController.handleMove(r, c);
      return;
    }

    if (branchController.state.active) {
      branchController.handleMove(r, c);
      return;
    }

    if (
      reviewController.state.active
      || game.gameOver
      || gameController.aiThinking
      || game.board[r][c] !== 0
    ) return;
    if (game.mode === MODES.AI && game.currentPlayer === WHITE) return;

    audio.ensureReady();
    gameController.performMove(r, c);
  }

  function undo() {
    gameController.undo();
  }

  function toggleSound() {
    audio.toggle();
    refresh(RenderFlags.STATUS);
  }

  function startReview(target = null, shared = false) {
    if (
      reviewController.state.active
      || branchController.state.active
      || trainingController.state.active
      || positionEditorController.state.active
    ) return;
    if (!target && game.customPosition) return;

    gameController.clearTimers();
    panel.hideResult();
    reviewController.start(target || game, shared);
    refresh();
  }

  function openHistoryRecord(record) {
    startReview(record);
  }

  function exitReview() {
    const result = reviewController.exit();
    if (!result.exited) return;
    if (result.shared) clearHash();
    refresh();

    if (game.gameOver) panel.showResult(game);
    if (game.mode === MODES.AI && game.currentPlayer === WHITE && !game.gameOver) {
      gameController.scheduleAiMove();
    }
  }

  function startBranchFromReview() {
    const data = reviewController.branchData();
    if (!data) return;

    reviewController.deactivateForBranch();
    if (!branchController.start(data.prefix, data.index)) {
      reviewController.resume();
      return;
    }
    refresh();
  }

  function startSharedChallenge(payload) {
    gameController.clearTimers();
    if (!branchController.startShared(payload)) return false;
    reviewController.reset();
    panel.hideResult();
    refresh();
    return true;
  }

  function exitBranch() {
    const result = branchController.exit();
    if (!result.exited) return;

    if (result.shared) {
      clearHash();
      game.reset();
      refresh();
      return;
    }

    reviewController.resume();
    refresh();
  }

  function startTraining() {
    if (
      reviewController.state.active
      || branchController.state.active
      || trainingController.state.active
      || positionEditorController.state.active
      || !availablePuzzles.length
    ) return;

    gameController.clearTimers();
    panel.hideResult();
    if (trainingController.start(availablePuzzles)) refresh();
  }

  function nextTraining() {
    trainingController.next();
  }

  function exitTraining() {
    if (!trainingController.exit()) return;
    refresh();

    if (game.mode === MODES.AI && game.currentPlayer === WHITE && !game.gameOver) {
      gameController.scheduleAiMove();
    } else if (game.gameOver) {
      panel.showResult(game);
    }
  }

  function startPositionEditor() {
    if (
      reviewController.state.active
      || branchController.state.active
      || trainingController.state.active
      || positionEditorController.state.active
    ) return false;

    gameController.clearTimers();
    panel.hideResult();
    boardView.clearGhost();
    if (!positionEditorController.start(game)) return false;
    refresh();
    return true;
  }

  function exitPositionEditor() {
    if (!positionEditorController.exit()) return false;
    refresh();

    if (game.gameOver) panel.showResult(game);
    else if (game.mode === MODES.AI && game.currentPlayer === WHITE) {
      gameController.scheduleAiMove();
    }
    return true;
  }

  function startGameFromEditor(mode) {
    if (
      !positionEditorController.state.active
      || positionEditorController.state.comparing
      || !positionEditorController.canStart()
    ) return false;
    const position = positionEditorController.target();
    gameController.clearTimers();
    panel.hideResult();
    G.Storage.clearCurrent();
    gameController.resetMetadata();
    clearHash();

    if (!game.loadPosition(position, mode)) return false;
    positionEditorController.exit();
    G.Storage.saveCurrent(game.snapshot());
    refresh();

    if (game.mode === MODES.AI && game.currentPlayer === WHITE) {
      gameController.scheduleAiMove();
    }
    return true;
  }

  function saveSettings() {
    G.Storage.saveSettings(settings);
  }

  function changeDifficulty(value) {
    if (!Object.values(AI_DIFFICULTIES).includes(value)) return;
    settings.difficulty = value;
    saveSettings();
    refresh(RenderFlags.SETTINGS);
  }

  function changePersona(value) {
    if (!Object.values(AI_PERSONAS).includes(value)) return;
    settings.persona = value;
    gameController.lastAiInsight = null;
    boardView.clearGhost();
    saveSettings();
    refresh(RenderFlags.SETTINGS | RenderFlags.ANALYSIS);
  }

  function toggleHeatmap() {
    settings.heatmap = !settings.heatmap;
    saveSettings();
    refresh(RenderFlags.SETTINGS | RenderFlags.BOARD);
  }

  function changeHeatmapMode(value) {
    if (!['combined', 'black', 'white'].includes(value)) return;
    settings.heatmapMode = value;
    saveSettings();
    refresh(RenderFlags.SETTINGS | RenderFlags.BOARD);
  }

  function toggleGhost() {
    settings.ghost = !settings.ghost;
    boardView.clearGhost();
    saveSettings();
    refresh(RenderFlags.SETTINGS | RenderFlags.BOARD);
  }

  function shareReviewGame() {
    const review = reviewController.state;
    if (!review.active) return;

    shareController.share({
      kind: 'game',
      moves: review.target.moves,
      index: review.target.moves.length,
      winner: review.target.winner,
      mode: review.target.mode,
    }, '完整棋局');
  }

  function shareReviewChallenge() {
    const review = reviewController.state;
    if (!review.active || review.index >= review.target.moves.length) return;

    shareController.share({
      kind: 'challenge',
      moves: review.target.moves.slice(0, review.index),
      index: review.index,
      winner: 0,
      mode: MODES.PVP,
    }, `第 ${review.index} 手挑战`);
  }

  panel.bind({ undo, toggleSound, restart, setMode, startReview });
  reviewView.bind({
    seek: index => reviewController.seek(index),
    seekRelative: delta => reviewController.seekRelative(delta),
    seekEnd: () => reviewController.seekEnd(),
    togglePlay: () => reviewController.togglePlay(),
    exit: exitReview,
    startBranch: startBranchFromReview,
    toggleKeyOnly: () => reviewController.toggleKeyOnly(),
    shareGame: shareReviewGame,
    shareChallenge: shareReviewChallenge,
  });
  insights.bind({
    changeDifficulty,
    changePersona,
    toggleHeatmap,
    changeHeatmapMode,
    toggleGhost,
    startTraining,
    exitBranch,
    nextTraining,
    exitTraining,
  });
  positionEditorView.bind({
    start: startPositionEditor,
    setTool: tool => positionEditorController.setTool(tool),
    setNextPlayer: player => positionEditorController.setNextPlayer(player),
    clear: () => positionEditorController.clear(),
    restore: () => positionEditorController.restore(),
    toggleAnalysis: () => positionEditorController.toggleAnalysis(),
    toggleCompareMode: () => positionEditorController.toggleCompareMode(),
    startGame: startGameFromEditor,
    exit: exitPositionEditor,
  });

  refreshDerived();
  saveSettings();

  const shared = G.ShareCodec.parseHash();
  if (shared?.kind === 'game') {
    startReview(shared, true);
  } else if (shared?.kind === 'challenge' && startSharedChallenge(shared)) {
    insights.showShareNotice('已进入分享挑战：请从当前局面继续。');
  } else {
    const saved = G.Storage.loadCurrent();
    if (saved && game.restore(saved) && (game.moves.length || game.customPosition) && !game.gameOver) {
      panel.showResumeNotice();
      refresh();
      if (game.mode === MODES.AI && game.currentPlayer === WHITE) {
        gameController.scheduleAiMove();
      }
    } else {
      G.Storage.clearCurrent();
      restart();
    }
  }

  G.App = Object.freeze({
    restart,
    setMode,
    undo,
    startReview,
    exitReview,
    startBranchFromReview,
    startTraining,
    shareReviewGame,
    shareReviewChallenge,
    startPositionEditor,
    exitPositionEditor,
    startGameFromEditor,
    getGame: () => game,
    getSettings: () => ({ ...settings }),
    getPerformanceStats: () => ({
      analysis: analysisService.stats(),
      aiClient: aiClient.stats(),
      derived: derivedService.stats(),
      board: boardView.stats(),
      review: reviewView.stats(),
      game: gameController.stats(),
    }),
  });
})(window.Gomoku = window.Gomoku || {});
