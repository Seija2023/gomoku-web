self.window = self;
self.Gomoku = self.Gomoku || {};
importScripts(
  '../config.js',
  '../core/rules.js',
  '../game/position.js',
  'evaluator.js',
  'search.js',
  '../analysis/heatmap.js',
  '../analysis/advantage.js',
  '../services/analysis-service.js',
  '../services/counterfactual-service.js',
  'worker-runtime.js'
);
