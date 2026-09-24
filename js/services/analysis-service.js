(function (G) {
  class LruCache {
    constructor(limit = 96) {
      this.limit = limit;
      this.map = new Map();
    }

    get(key) {
      if (!this.map.has(key)) return undefined;
      const value = this.map.get(key);
      this.map.delete(key);
      this.map.set(key, value);
      return value;
    }

    set(key, value) {
      if (this.map.has(key)) this.map.delete(key);
      this.map.set(key, value);
      while (this.map.size > this.limit) {
        this.map.delete(this.map.keys().next().value);
      }
      return value;
    }

    clear() {
      this.map.clear();
    }

    get size() {
      return this.map.size;
    }
  }

  class AnalysisService {
    constructor(options = {}) {
      this.rankCache = new LruCache(options.rankLimit || 96);
      this.resultCache = new LruCache(options.resultLimit || 128);
      this.metrics = { rankHits: 0, rankMisses: 0, resultHits: 0, resultMisses: 0 };
    }

    positionKey(board, moves, currentPlayer = 0) {
      if (board) return G.Position.boardKey(board, currentPlayer);
      return G.Position.keyFromMoves(moves || [], currentPlayer);
    }

    cached(cache, key, producer, metricPrefix) {
      const hit = cache.get(key);
      if (hit !== undefined) {
        this.metrics[`${metricPrefix}Hits`] += 1;
        return hit;
      }
      this.metrics[`${metricPrefix}Misses`] += 1;
      return cache.set(key, producer());
    }

    ranked(board, moves, player, persona) {
      const key = `rank|${this.positionKey(board, moves, player)}|${persona}`;
      return this.cached(
        this.rankCache,
        key,
        () => G.AI.rankMoves(board, moves, player, persona),
        'rank',
      );
    }

    candidates(board, moves, player, persona, limit = 3) {
      const positionKey = this.positionKey(board, moves, player);
      const key = `cand|${positionKey}|${persona}|${limit}`;
      return this.cached(this.resultCache, key, () => {
        const ranked = this.ranked(board, moves, player, persona);
        const base = ranked.slice(0, limit).map((item, index) => ({
          rank: index + 1,
          r: item.r,
          c: item.c,
          score: Math.round(item.score),
          attack: item.attack,
          defense: item.defense,
          attackLevel: item.attackLevel,
          defenseLevel: item.defenseLevel,
          reason: item.reason,
          personaLabel: item.personaLabel,
        }));
        return base.map(candidate => {
          const preview = this.ghost(board, moves, candidate.r, candidate.c, player, persona);
          return {
            ...candidate,
            reply: preview?.reply || null,
            followUp: preview?.followUp || null,
            line: preview?.line || [],
          };
        });
      }, 'result');
    }

    ghost(board, moves, r, c, player, persona) {
      const key = `ghost|${this.positionKey(board, moves, player)}|${persona}|${r},${c}`;
      return this.cached(
        this.resultCache,
        key,
        () => G.AISearch.previewLine(board, moves, r, c, player, persona),
        'result',
      );
    }

    heatmap(board, moves, mode) {
      const key = `heat|${this.positionKey(board, moves, 0)}|${mode}`;
      return this.cached(
        this.resultCache,
        key,
        () => G.Heatmap.generate(board, moves, mode),
        'result',
      );
    }

    advantage(moves) {
      const key = `adv|${G.Position.keyFromMoves(moves, 0)}`;
      return this.cached(
        this.resultCache,
        key,
        () => G.Advantage.series(moves),
        'result',
      );
    }

    chooseMove(board, moves, difficulty, player, persona, rng = Math.random, searchOptions = {}) {
      if (G.AISearch?.chooseMoveAdvanced) {
        return G.AISearch.chooseMoveAdvanced(
          board,
          moves,
          difficulty,
          player,
          persona,
          searchOptions,
        );
      }
      const ranked = this.ranked(board, moves, player, persona);
      return G.AI.chooseMoveDetailed(board, moves, difficulty, player, persona, rng, ranked);
    }

    clear() {
      this.rankCache.clear();
      this.resultCache.clear();
    }

    stats() {
      return {
        ...this.metrics,
        rankEntries: this.rankCache.size,
        resultEntries: this.resultCache.size,
      };
    }
  }

  G.Services = G.Services || {};
  G.Services.AnalysisService = AnalysisService;
})(window.Gomoku = window.Gomoku || {});
