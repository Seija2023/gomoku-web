(function (G) {
  const {
    BLACK,
    WHITE,
    MODES,
    AI_DIFFICULTIES,
    AI_PERSONAS,
    AI_DELAY_MS,
    RESULT_DELAY_MS,
    REVIEW_STEP_MS,
  } = G.Config;

  const game = new G.Game.Game();
  const audio = new G.Audio.AudioManager();
  const panel = new G.UI.PanelView(document);
  const reviewView = new G.UI.ReviewView(document);
  const insights = new G.UI.InsightsView(document);
  const settings = G.Storage.loadSettings();
  const analysisService = new G.Services.AnalysisService();
  const derivedService = new G.Services.DerivedService();
  const requestGate = new G.Services.RequestGate();
  const { RenderFlags, hasRenderFlag } = G.AppCore;
  let trainingProgress = G.Storage.loadTrainingProgress();

  let aiThinking = false;
  let aiTimer = null;
  let resultTimer = null;
  let currentHistoryId = null;
  let lastAiInsight = null;
  let availablePuzzles = [];

  const review = {
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

  const branchState = {
    active: false,
    game: null,
    originIndex: 0,
    humanPlayer: BLACK,
    aiPlayer: WHITE,
    aiThinking: false,
    lastInsight: null,
    shared: false,
  };

  const training = {
    active: false,
    index: 0,
    puzzles: [],
    target: null,
    feedback: '',
  };

  const boardView = new G.UI.BoardView(
    document.getElementById('board'),
    handleCellClick,
    handleCellPreview,
  );

  const advantageChart = new G.UI.AdvantageChart(
    document.getElementById('advantageChart'),
    document.getElementById('advantageLabel'),
    index => seekReview(index),
  );

  function cloneMoves(moves) {
    return G.Position.cloneMoves(moves || []);
  }

  function opponentOf(player) {
    return player === BLACK ? WHITE : BLACK;
  }

  function clearHash() {
    if (!location.hash) return;
    try {
      history.replaceState(null, '', `${location.pathname}${location.search}`);
    } catch {
      location.hash = '';
    }
  }

  function clearAiAndResultTimers() {
    if (aiTimer) clearTimeout(aiTimer);
    if (resultTimer) clearTimeout(resultTimer);
    aiTimer = null;
    resultTimer = null;
    requestGate.invalidate('ai');
    requestGate.invalidate('branch');
    aiThinking = false;
    branchState.aiThinking = false;
  }

  function stopReviewPlayback() {
    if (review.timer) clearTimeout(review.timer);
    review.timer = null;
    review.playing = false;
  }

  function deriveWinningLine(moves, winner) {
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

  function makeReviewTarget(source) {
    const moves = cloneMoves(source.moves || []);
    const winner = source.winner || 0;
    return {
      mode: source.mode || MODES.PVP,
      moves,
      board: G.History.boardAt(moves),
      currentPlayer: source.currentPlayer || (moves.length % 2 === 0 ? BLACK : WHITE),
      gameOver: true,
      winner,
      winningLine: source.winningLine
        ? source.winningLine.map(cell => ({ ...cell }))
        : deriveWinningLine(moves, winner),
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

  function analysisPlayer(shown, displayed) {
    if (training.active) return training.puzzles[training.index]?.player || BLACK;
    if (review.active) {
      if (review.index >= shown.moves.length) return null;
      return review.index % 2 === 0 ? BLACK : WHITE;
    }
    if (shown.gameOver) return null;
    return shown.currentPlayer;
  }

  function refreshDerived() {
    const records = G.Storage.listHistory();
    const derived = derivedService.training(records, trainingProgress);
    panel.renderHistory(records, openHistoryRecord);
    availablePuzzles = derived.puzzles;

    insights.renderTrainingCount(derived.trainingStats.due, derived.trainingStats.total);
    insights.renderTrainingStats(derived.trainingStats);
    insights.renderProfile(derived.profile);
    insights.renderOpenings(derived.openings);
  }

  function saveSettings() {
    G.Storage.saveSettings(settings);
  }

  function buildCandidateAnalysis(board, moves, player) {
    if (!player || !moves.length) return [];
    return analysisService.candidates(board, moves, player, settings.persona, 3);
  }

  function interactionState(shown) {
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
      statusOverride = branchState.shared
        ? (branchState.aiThinking ? '挑战 AI 思考中' : '分享挑战')
        : (branchState.aiThinking ? '分支 AI 思考中' : '分支推演');
      thinking = branchState.aiThinking;
    } else if (review.active) {
      locked = true;
      statusOverride = '复盘中';
      thinking = false;
    } else {
      locked = aiThinking || (game.mode === MODES.AI && game.currentPlayer === WHITE);
    }

    return { locked, statusOverride, thinking };
  }

  function refresh(mask = RenderFlags.ALL) {
    const needsDisplayed =
      hasRenderFlag(mask, RenderFlags.BOARD)
      || hasRenderFlag(mask, RenderFlags.ANALYSIS);
    const shown = displayGame();
    const displayed = needsDisplayed ? displayedBoardAndMoves(shown) : null;
    const state =
      hasRenderFlag(mask, RenderFlags.BOARD)
      || hasRenderFlag(mask, RenderFlags.STATUS)
        ? interactionState(shown)
        : null;

    if (hasRenderFlag(mask, RenderFlags.BOARD)) {
      let heatmap = [];
      if (settings.heatmap && !training.active && displayed.moves.length) {
        heatmap = analysisService.heatmap(displayed.board, displayed.moves, settings.heatmapMode);
      }

      const reviewIndex = review.active ? review.index : null;
      const showWinningLine = review.active && review.index < shown.moves.length ? null : shown.winningLine;
      const ghostEnabled = settings.ghost && !training.active && !review.active && !state.locked;

      boardView.render(shown, {
        locked: state.locked,
        reviewIndex,
        winningLine: showWinningLine,
        heatmap,
        ghostEnabled,
        boardOverride: displayed.board,
        movesOverride: displayed.moves,
      });
    }

    if (hasRenderFlag(mask, RenderFlags.STATUS)) {
      const modePresentation = branchState.active ? { ...shown, mode: MODES.AI } : shown;
      panel.updateMode(modePresentation);
      panel.updateStatus(
        shown,
        state.thinking,
        audio.enabled,
        review.active || branchState.active || training.active,
        state.statusOverride,
      );
    }

    if (hasRenderFlag(mask, RenderFlags.SETTINGS)) {
      insights.renderSettings(settings);
    }

    if (hasRenderFlag(mask, RenderFlags.ANALYSIS)) {
      insights.renderExplanation(branchState.active ? branchState.lastInsight : lastAiInsight);
      const candidatePlayer = training.active ? null : analysisPlayer(shown, displayed);
      const candidates = candidatePlayer
        ? buildCandidateAnalysis(displayed.board, displayed.moves, candidatePlayer)
        : [];
      insights.renderCandidates(candidates, candidatePlayer);
    }

    if (hasRenderFlag(mask, RenderFlags.REVIEW)) {
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
        advantageChart.set(review.advantage, review.index);
      } else {
        reviewView.hide();
        advantageChart.set([], 0);
      }
    }

    if (hasRenderFlag(mask, RenderFlags.OVERLAYS)) {
      if (branchState.active) {
        insights.showBranch(branchState.originIndex, branchState.humanPlayer, branchState.shared);
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
  }

  function handleCellPreview(r, c) {
    if (!settings.ghost || review.active || training.active) return null;
    const shown = displayGame();
    if (!shown || shown.gameOver || shown.board[r]?.[c] !== 0) return null;
    if (branchState.active && shown.currentPlayer !== branchState.humanPlayer) return null;
    if (!branchState.active && shown.mode === MODES.AI && shown.currentPlayer === WHITE) return null;

    return analysisService.ghost(
      shown.board,
      shown.moves,
      r,
      c,
      shown.currentPlayer,
      settings.persona,
    );
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
      persona: settings.persona,
      moves: cloneMoves(game.moves),
      winner: game.winner,
      winningLine: game.winningLine ? game.winningLine.map(cell => ({ ...cell })) : null,
    };
  }

  function finishGame() {
    G.Storage.clearCurrent();
    G.Storage.saveFinished(createRecord());
    derivedService.invalidateHistory();
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
    review.advantage = [];
    review.keyOnly = false;
    review.shared = false;
    branchState.active = false;
    branchState.game = null;
    branchState.lastInsight = null;
    branchState.shared = false;
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
    clearHash();
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
    const requestId = requestGate.next('ai');
    aiThinking = true;
    refresh(RenderFlags.BOARD | RenderFlags.STATUS);

    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (!requestGate.isCurrent('ai', requestId)) return;
      if (game.gameOver || review.active || branchState.active || training.active || game.mode !== MODES.AI || game.currentPlayer !== WHITE) {
        aiThinking = false;
        refresh(RenderFlags.BOARD | RenderFlags.STATUS);
        return;
      }

      const detail = analysisService.chooseMove(
        game.board,
        game.moves,
        settings.difficulty,
        WHITE,
        settings.persona,
      );
      if (!requestGate.isCurrent('ai', requestId)) return;

      aiThinking = false;
      if (detail.move) {
        lastAiInsight = { ...detail, move: { ...detail.move } };
        performMove(detail.move.r, detail.move.c);
      } else {
        refresh(RenderFlags.BOARD | RenderFlags.STATUS);
      }
    }, AI_DELAY_MS);
  }

  function undo() {
    if (review.active || branchState.active || training.active || game.moves.length === 0) return;
    const wasOver = game.gameOver;
    clearAiAndResultTimers();
    panel.hideResult();

    if (wasOver && currentHistoryId) {
      G.Storage.removeHistory(currentHistoryId);
      derivedService.invalidateHistory();
    }
    if (wasOver) currentHistoryId = null;

    game.undo();
    lastAiInsight = null;
    persistCurrent();
    if (wasOver) refreshDerived();
    refresh();
  }

  function toggleSound() {
    audio.toggle();
    refresh(RenderFlags.STATUS);
  }

  function startReview(target = null, shared = false) {
    if (review.active || branchState.active || training.active) return;
    clearAiAndResultTimers();
    panel.hideResult();
    review.target = makeReviewTarget(target || game);
    review.analysis = G.Analyzer.analyze(review.target);
    review.advantage = analysisService.advantage(review.target.moves);
    review.index = review.target.moves.length;
    review.active = true;
    review.playing = false;
    review.keyOnly = false;
    review.shared = shared;
    refresh();
  }

  function openHistoryRecord(record) {
    startReview(record);
  }

  function seekReview(index) {
    if (!review.active) return;
    stopReviewPlayback();
    review.index = Math.max(0, Math.min(index, review.target.moves.length));
    refresh(RenderFlags.BOARD | RenderFlags.ANALYSIS | RenderFlags.REVIEW);
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
    refresh(RenderFlags.REVIEW);
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
    refresh(RenderFlags.BOARD | RenderFlags.ANALYSIS | RenderFlags.REVIEW);
    review.timer = setTimeout(reviewStep, REVIEW_STEP_MS);
  }

  function toggleReviewPlay() {
    if (!review.active) return;
    if (review.playing) {
      stopReviewPlayback();
      refresh(RenderFlags.REVIEW);
      return;
    }

    const restarted = review.index >= review.target.moves.length;
    if (restarted) review.index = 0;
    review.playing = true;
    refresh(restarted
      ? RenderFlags.BOARD | RenderFlags.ANALYSIS | RenderFlags.REVIEW
      : RenderFlags.REVIEW);
    review.timer = setTimeout(reviewStep, 420);
  }

  function exitReview() {
    if (!review.active) return;
    const wasShared = review.shared;
    stopReviewPlayback();
    review.active = false;
    review.target = null;
    review.analysis = null;
    review.advantage = [];
    review.keyOnly = false;
    review.shared = false;
    if (wasShared) clearHash();
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
    branchState.shared = false;
    branchState.active = true;
    review.active = false;
    refresh();
  }

  function startSharedChallenge(payload) {
    clearAiAndResultTimers();
    const prefix = cloneMoves(payload.moves || []).slice(0, payload.index);
    const branchGame = new G.Game.Game();
    const nextPlayer = prefix.length % 2 === 0 ? BLACK : WHITE;
    const restored = branchGame.restore({
      mode: MODES.PVP,
      moves: prefix,
      currentPlayer: nextPlayer,
      gameOver: false,
    });
    if (!restored || branchGame.gameOver) return false;

    branchState.game = branchGame;
    branchState.originIndex = prefix.length;
    branchState.humanPlayer = branchGame.currentPlayer;
    branchState.aiPlayer = opponentOf(branchState.humanPlayer);
    branchState.lastInsight = null;
    branchState.shared = true;
    branchState.active = true;
    review.active = false;
    panel.hideResult();
    refresh();
    return true;
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
      return;
    }
    if (result.draw) {
      audio.playDraw();
      return;
    }

    scheduleBranchAi();
  }

  function scheduleBranchAi() {
    if (!branchState.active || !branchState.game || branchState.game.gameOver) return;
    const requestId = requestGate.next('branch');
    branchState.aiThinking = true;
    refresh(RenderFlags.BOARD | RenderFlags.STATUS);

    aiTimer = setTimeout(() => {
      aiTimer = null;
      if (!requestGate.isCurrent('branch', requestId)) return;
      if (!branchState.active || !branchState.game || branchState.game.gameOver || branchState.game.currentPlayer !== branchState.aiPlayer) {
        branchState.aiThinking = false;
        refresh(RenderFlags.BOARD | RenderFlags.STATUS);
        return;
      }

      const detail = analysisService.chooseMove(
        branchState.game.board,
        branchState.game.moves,
        settings.difficulty,
        branchState.aiPlayer,
        settings.persona,
      );
      if (!requestGate.isCurrent('branch', requestId)) return;

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
    const shared = branchState.shared;
    clearAiAndResultTimers();
    branchState.active = false;
    branchState.game = null;
    branchState.lastInsight = null;
    branchState.shared = false;

    if (shared) {
      clearHash();
      game.reset();
      refresh();
      return;
    }

    review.active = true;
    refresh();
  }

  function startTraining() {
    if (review.active || branchState.active || training.active || !availablePuzzles.length) return;
    clearAiAndResultTimers();
    panel.hideResult();
    const ordered = G.TrainingScheduler.order(availablePuzzles, trainingProgress);
    const now = Date.now();
    const due = ordered.filter(puzzle => {
      const state = G.TrainingScheduler.stateFor(trainingProgress, puzzle.id);
      return !state.dueAt || state.dueAt <= now;
    });
    training.puzzles = (due.length ? due : ordered).slice();
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
    trainingProgress = G.TrainingScheduler.update(trainingProgress, puzzle.id, result.correct);
    G.Storage.saveTrainingProgress(trainingProgress);
    derivedService.invalidateTraining();
    refreshDerived();
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
    refresh(RenderFlags.SETTINGS);
  }

  function changePersona(value) {
    if (!Object.values(AI_PERSONAS).includes(value)) return;
    settings.persona = value;
    lastAiInsight = null;
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

  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
    }
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return Promise.resolve(ok);
    } catch {
      return Promise.resolve(false);
    }
  }

  async function sharePayload(payload, label) {
    const url = `${location.href.split('#')[0]}${G.ShareCodec.makeHash(payload)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `五子棋 · ${label}`, text: label, url });
        insights.showShareNotice('已打开系统分享面板。');
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    const copied = await copyText(url);
    insights.showShareNotice(copied ? '分享链接已复制。' : `分享链接：${url}`);
  }

  function shareReviewGame() {
    if (!review.active) return;
    sharePayload({
      kind: 'game',
      moves: review.target.moves,
      index: review.target.moves.length,
      winner: review.target.winner,
      mode: review.target.mode,
    }, '完整棋局');
  }

  function shareReviewChallenge() {
    if (!review.active || review.index >= review.target.moves.length) return;
    sharePayload({
      kind: 'challenge',
      moves: review.target.moves.slice(0, review.index),
      index: review.index,
      winner: 0,
      mode: MODES.PVP,
    }, `第 ${review.index} 手挑战`);
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

  refreshDerived();
  saveSettings();

  const shared = G.ShareCodec.parseHash();
  if (shared?.kind === 'game') {
    startReview(shared, true);
  } else if (shared?.kind === 'challenge' && startSharedChallenge(shared)) {
    insights.showShareNotice('已进入分享挑战：请从当前局面继续。');
  } else {
    const saved = G.Storage.loadCurrent();
    if (saved && game.restore(saved) && game.moves.length && !game.gameOver) {
      panel.showResumeNotice();
      refresh();
      if (game.mode === MODES.AI && game.currentPlayer === WHITE) scheduleAiMove();
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
    getGame: () => game,
    getSettings: () => ({ ...settings }),
    getPerformanceStats: () => ({
      analysis: analysisService.stats(),
      derived: derivedService.stats(),
      board: boardView.stats(),
      review: reviewView.stats(),
      requests: {
        ai: requestGate.current('ai'),
        branch: requestGate.current('branch'),
      },
    }),
  });
})(window.Gomoku = window.Gomoku || {});
