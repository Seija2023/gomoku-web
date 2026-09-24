(function (scope) {
  const G = scope.Gomoku;
  const analysis = new G.Services.AnalysisService();
  const counterfactual = new G.Services.CounterfactualService(analysis);

  function progressReporter(id, channel) {
    return progress => {
      scope.postMessage({ type: 'progress', id, channel, progress });
    };
  }

  scope.addEventListener('message', event => {
    const message = event.data || {};
    if (message.type !== 'request') return;

    const { id, channel, operation, context = {} } = message;
    try {
      const searchOptions = {
        ...(context.searchOptions || {}),
        onProgress: progressReporter(id, channel),
      };

      let result = null;
      if (operation === 'choose') {
        result = analysis.chooseMove(
          context.board,
          context.moves || [],
          context.difficulty,
          context.player,
          context.persona,
          Math.random,
          searchOptions,
        );
      } else if (operation === 'compare') {
        result = counterfactual.compare({
          ...context,
          searchOptions,
        });
      } else {
        throw new Error('Unsupported worker operation: ' + operation);
      }

      scope.postMessage({ type: 'result', id, channel, result });
    } catch (error) {
      scope.postMessage({
        type: 'error',
        id,
        channel,
        error: error?.message || String(error),
      });
    }
  });

  scope.postMessage({ type: 'ready' });
})(self);
