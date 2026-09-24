(function (G) {
  const REQUIRED = Object.freeze([
    ['Config', () => G.Config],
    ['Game.Game', () => G.Game?.Game],
    ['AppCore.WorkspaceManager', () => G.AppCore?.WorkspaceManager],
    ['AppCore.SessionWorkflow', () => G.AppCore?.SessionWorkflow],
    ['Services.AnalysisService', () => G.Services?.AnalysisService],
    ['Services.AIClient', () => G.Services?.createAIClient || G.Services?.MainThreadAIClient],
    ['Controllers.GameController', () => G.Controllers?.GameController],
    ['Controllers.ReviewController', () => G.Controllers?.ReviewController],
    ['Controllers.TrainingController', () => G.Controllers?.TrainingController],
    ['Controllers.PositionEditorController', () => G.Controllers?.PositionEditorController],
    ['Controllers.VariationController', () => G.Controllers?.VariationController],
    ['UI.BoardView', () => G.UI?.BoardView],
    ['UI.WorkspaceView', () => G.UI?.WorkspaceView],
    ['AppCore.RenderCoordinator', () => G.AppCore?.RenderCoordinator],
  ]);

  function missing() {
    return REQUIRED.filter(([, resolve]) => {
      try {
        return !resolve();
      } catch {
        return true;
      }
    }).map(([name]) => name);
  }

  function assertReady() {
    const unresolved = missing();
    if (!unresolved.length) return true;
    throw new Error(`Gomoku bootstrap dependency missing: ${unresolved.join(', ')}`);
  }

  G.AppCore = G.AppCore || {};
  G.AppCore.BootGuard = Object.freeze({ REQUIRED, missing, assertReady });
})(window.Gomoku = window.Gomoku || {});
