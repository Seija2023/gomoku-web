(function (G) {
  const { WHITE, MODES, AI_DIFFICULTIES, AI_PERSONAS } = G.Config;
  const { RenderFlags, Activities } = G.AppCore;

  const game = new G.Game.Game();
  const audio = new G.Audio.AudioManager();
  const panel = new G.UI.PanelView(document);
  const reviewView = new G.UI.ReviewView(document);
  const insights = new G.UI.InsightsView(document);
  const positionEditorView = new G.UI.PositionEditorView(document);
  const variationView = new G.UI.VariationTreeView(document);
  const workspaceView = new G.UI.WorkspaceView(document);
  const settings = G.Storage.loadSettings();

  let renderCoordinator = null;
  function refresh(mask = RenderFlags.ALL) {
    renderCoordinator?.refresh(mask);
  }

  const analysisService = new G.Services.AnalysisService();
  const derivedService = new G.Services.DerivedService();
  const requestGate = new G.Services.RequestGate();
  const aiClient = G.Services.createAIClient
    ? G.Services.createAIClient(analysisService, requestGate)
    : new G.Services.MainThreadAIClient(analysisService, requestGate);
  const shareController = new G.Controllers.ShareController(insights);

  let availablePuzzles = [];
  let availableMistakes = [];

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

  const variationController = new G.Controllers.VariationController({
    settings,
    aiClient,
    storage: G.Storage,
    refresh,
    flags: RenderFlags,
  });

  const workspaceManager = new G.AppCore.WorkspaceManager({
    controllers: {
      review: reviewController,
      branch: branchController,
      training: trainingController,
      positionEditor: positionEditorController,
      variation: variationController,
    },
    initialWorkspace: settings.workspace,
    onWorkspaceChange: workspace => {
      settings.workspace = workspace;
      G.Storage.saveSettings(settings);
      refresh(RenderFlags.STATUS | RenderFlags.SETTINGS | RenderFlags.ANALYSIS | RenderFlags.OVERLAYS);
    },
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
    isSpecialActive: () => workspaceManager.isSpecialActive(),
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

  const variationWorkflow = new G.Lab.VariationWorkflow({
    game,
    gameController,
    reviewController,
    branchController,
    trainingController,
    positionEditorController,
    variationController,
    panel,
    boardView,
    settings,
    workspace: workspaceManager,
    refresh,
    flags: RenderFlags,
  });

  const trainingWorkflow = new G.Training.Workflow({
    game,
    gameController,
    reviewController,
    branchController,
    trainingController,
    positionEditorController,
    variationController,
    variationWorkflow,
    panel,
    refresh,
    workspace: workspaceManager,
    getPuzzles: () => availablePuzzles,
    getMistakes: () => availableMistakes,
  });

  const advantageChart = new G.UI.AdvantageChart(
    document.getElementById('advantageChart'),
    document.getElementById('advantageLabel'),
    index => reviewController.seek(index),
  );

  renderCoordinator = new G.AppCore.RenderCoordinator({
    game,
    gameController,
    workspace: workspaceManager,
    controllers: {
      review: reviewController,
      branch: branchController,
      training: trainingController,
      positionEditor: positionEditorController,
      variation: variationController,
    },
    boardView,
    panel,
    reviewView,
    insights,
    positionEditorView,
    variationView,
    workspaceView,
    advantageChart,
    aiClient,
    audio,
    settings,
    storage: G.Storage,
  });

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
    availableMistakes = derived.mistakes || [];
    insights.renderTrainingCount(
      derived.trainingStats.due,
      derived.trainingStats.total,
      derived.adaptive?.trainableMistakes || 0,
    );
    insights.renderTrainingStats(derived.trainingStats);
    insights.renderAdaptiveTraining(derived.adaptive, derived.puzzles);
    return derived;
  }

  function refreshDerived() {
    const records = G.Storage.listHistory();
    const derived = refreshTrainingDerived(records);
    panel.renderHistory(records, openHistoryRecord);
    insights.renderProfile(derived.profile);
    insights.renderOpenings(derived.openings);
  }

  function handleCellPreview(r, c) {
    return renderCoordinator?.previewAt(r, c) || null;
  }

  function resetSpecialModes() {
    workspaceManager.resetSpecialModes();
    boardView.clearGhost();
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
    if (!workspaceManager.canEnterFromGame() || game.mode === mode) return;

    gameController.clearTimers();
    panel.hideResult();
    G.Storage.clearCurrent();
    gameController.resetMetadata();
    game.setMode(mode);
    refresh();
  }

  function handleCellClick(r, c) {
    if (boardView.pinnedKey()) boardView.clearGhost();

    switch (workspaceManager.activity()) {
      case Activities.VARIATION:
        variationController.handleMove(r, c);
        return;
      case Activities.POSITION_EDITOR:
        positionEditorController.handleCell(r, c);
        return;
      case Activities.TRAINING:
        trainingController.handleMove(r, c);
        return;
      case Activities.BRANCH:
        branchController.handleMove(r, c);
        return;
      case Activities.REVIEW:
        return;
      default:
        break;
    }

    if (game.gameOver || gameController.aiThinking || game.board[r][c] !== 0) return;
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
    if (!workspaceManager.canEnterFromGame()) return false;
    if (!target && game.customPosition) return false;

    gameController.clearTimers();
    panel.hideResult();
    reviewController.start(target || game, shared);
    refresh();
    return true;
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

  function startPositionEditor() {
    if (!workspaceManager.canEnterFromGame()) return false;

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
      !workspaceManager.isActivity(Activities.POSITION_EDITOR)
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

  workspaceView.bind(workspace => {
    if (workspaceManager.select(workspace)) {
      refresh(RenderFlags.STATUS | RenderFlags.SETTINGS | RenderFlags.ANALYSIS | RenderFlags.OVERLAYS);
    }
  });
  panel.bind({ undo, toggleSound, restart, setMode, startReview });
  reviewView.bind({
    seek: index => reviewController.seek(index),
    seekRelative: delta => reviewController.seekRelative(delta),
    seekEnd: () => reviewController.seekEnd(),
    togglePlay: () => reviewController.togglePlay(),
    exit: exitReview,
    startBranch: () => variationWorkflow.startFromReview(),
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
    toggleCandidateGhost: candidate => variationWorkflow.toggleCandidateGhost(candidate),
    startTraining: () => trainingWorkflow.startAdaptive(),
    startMistakeTraining: () => trainingWorkflow.startMistakes(),
    startMistake: id => trainingWorkflow.startOne(id),
    openTrainingVariation: () => trainingWorkflow.openVariation(),
    exitBranch,
    nextTraining: () => trainingWorkflow.next(),
    exitTraining: () => trainingWorkflow.exit(),
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
  variationView.bind({
    startCurrent: () => variationWorkflow.startCurrent(),
    resumeSaved: () => variationWorkflow.resumeSaved(),
    select: id => {
      boardView.clearGhost();
      return variationController.select(id);
    },
    parent: () => {
      boardView.clearGhost();
      return variationController.parent();
    },
    root: () => {
      boardView.clearGhost();
      return variationController.root();
    },
    expand: () => variationController.expand(),
    rename: label => variationController.rename(label),
    toggleFavorite: () => variationController.toggleFavorite(),
    removeCurrent: () => {
      boardView.clearGhost();
      return variationController.removeCurrent();
    },
    exit: () => variationWorkflow.exit(),
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
    startTraining: () => trainingWorkflow.startAdaptive(),
    startMistakeTraining: () => trainingWorkflow.startMistakes(),
    startMistake: id => trainingWorkflow.startOne(id),
    openTrainingVariation: () => trainingWorkflow.openVariation(),
    shareReviewGame,
    shareReviewChallenge,
    startPositionEditor,
    exitPositionEditor,
    startGameFromEditor,
    startVariationCurrent: () => variationWorkflow.startCurrent(),
    startVariationFromReview: () => variationWorkflow.startFromReview(),
    resumeVariation: () => variationWorkflow.resumeSaved(),
    exitVariation: () => variationWorkflow.exit(),
    setWorkspace: workspace => workspaceManager.select(workspace),
    getWorkspace: () => workspaceManager.snapshot(),
    getGame: () => game,
    getSettings: () => ({ ...settings }),
    getPerformanceStats: () => ({
      analysis: analysisService.stats(),
      aiClient: aiClient.stats(),
      derived: derivedService.stats(),
      board: boardView.stats(),
      review: reviewView.stats(),
      game: gameController.stats(),
      workspace: workspaceManager.snapshot(),
    }),
  });
})(window.Gomoku = window.Gomoku || {});
