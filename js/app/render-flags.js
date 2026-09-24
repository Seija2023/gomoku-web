(function (G) {
  const RenderFlags = Object.freeze({
    BOARD: 1 << 0,
    STATUS: 1 << 1,
    ANALYSIS: 1 << 2,
    REVIEW: 1 << 3,
    OVERLAYS: 1 << 4,
    SETTINGS: 1 << 5,
    ALL: (1 << 6) - 1,
  });

  function has(mask, flag) {
    return (mask & flag) === flag;
  }

  G.AppCore = G.AppCore || {};
  G.AppCore.RenderFlags = RenderFlags;
  G.AppCore.hasRenderFlag = has;
})(window.Gomoku = window.Gomoku || {});
