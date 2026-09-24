(function (G) {
  class VariationController {
    constructor({ settings, aiClient, storage, refresh, flags }) {
      this.settings = settings;
      this.aiClient = aiClient;
      this.storage = storage;
      this.refresh = refresh;
      this.flags = flags;
      this.state = this.makeInitialState();
    }

    makeInitialState() {
      return {
        active: false,
        tree: null,
        origin: 'game',
        expanding: false,
        lastExpansion: null,
      };
    }

    target() {
      return this.state.active ? this.state.tree?.position() || null : null;
    }

    persist() {
      if (!this.state.tree) return false;
      return this.storage.saveVariationTree(this.state.tree.serialize());
    }

    start(position, options = {}) {
      if (this.state.active || !position?.board) return false;
      const inspection = G.Position.inspectBoard(position.board);
      if (!inspection.ok) return false;

      this.aiClient.cancel('variation');
      this.state = {
        active: true,
        tree: new G.Lab.VariationTree({
          board: position.board,
          currentPlayer: position.currentPlayer,
        }, {
          rootLabel: options.rootLabel || '当前局面',
          source: options.source || 'game',
        }),
        origin: options.origin || 'game',
        expanding: false,
        lastExpansion: null,
      };
      this.persist();
      return true;
    }

    startFromReview(prefix, index) {
      const moves = G.Position.cloneMoves(prefix || []);
      return this.start({
        board: G.History.boardAt(moves),
        currentPlayer: G.Position.nextPlayerFor(moves),
      }, {
        rootLabel: `复盘第 ${index} 手`,
        source: 'review',
        origin: 'review',
      });
    }

    startFromGame(game) {
      if (!game) return false;
      return this.start({
        board: G.Position.cloneBoard(game.board),
        currentPlayer: game.currentPlayer,
      }, {
        rootLabel: game.customPosition ? '自定义局面' : `当前第 ${game.moves.length} 手`,
        source: 'game',
        origin: 'game',
      });
    }

    resumeSaved() {
      const payload = this.storage.loadVariationTree();
      const tree = G.Lab.VariationTree.restore(payload);
      if (!tree) {
        this.storage.clearVariationTree();
        return false;
      }
      this.aiClient.cancel('variation');
      this.state = {
        active: true,
        tree,
        origin: 'game',
        expanding: false,
        lastExpansion: null,
      };
      return true;
    }

    clearSaved() {
      return this.storage.clearVariationTree();
    }

    handleMove(r, c) {
      if (!this.state.active || this.state.expanding) return false;
      const position = this.target();
      if (!position || position.gameOver || position.board[r]?.[c] !== 0) return false;

      const move = { r, c, player: position.currentPlayer };
      const node = this.state.tree.addChild(this.state.tree.currentId, move, {
        source: 'manual',
        label: `我的尝试 · ${G.History.coordinate(move)}`,
      });
      if (!node) return false;
      this.state.tree.select(node.id);
      this.persist();
      this.refresh(this.flags.BOARD | this.flags.STATUS | this.flags.ANALYSIS | this.flags.OVERLAYS);
      return true;
    }

    select(id) {
      if (!this.state.active || !this.state.tree.select(id)) return false;
      this.aiClient.cancel('variation');
      this.state.expanding = false;
      this.persist();
      this.refresh(this.flags.BOARD | this.flags.STATUS | this.flags.ANALYSIS | this.flags.OVERLAYS);
      return true;
    }

    parent() {
      if (!this.state.active || !this.state.tree.selectParent()) return false;
      this.aiClient.cancel('variation');
      this.state.expanding = false;
      this.persist();
      this.refresh();
      return true;
    }

    root() {
      if (!this.state.active) return false;
      this.state.tree.selectRoot();
      this.aiClient.cancel('variation');
      this.state.expanding = false;
      this.persist();
      this.refresh();
      return true;
    }

    rename(label) {
      if (!this.state.active || !this.state.tree.rename(this.state.tree.currentId, label)) return false;
      this.persist();
      this.refresh(this.flags.OVERLAYS);
      return true;
    }

    toggleFavorite() {
      if (!this.state.active) return false;
      const result = this.state.tree.toggleFavorite(this.state.tree.currentId);
      this.persist();
      this.refresh(this.flags.OVERLAYS);
      return result;
    }

    removeCurrent() {
      if (!this.state.active || this.state.tree.currentId === 'root') return false;
      if (!this.state.tree.removeSubtree(this.state.tree.currentId)) return false;
      this.persist();
      this.refresh();
      return true;
    }

    addAiLine(candidate, index, search = null) {
      const position = this.target();
      if (!position || !candidate) return null;
      const letter = String.fromCharCode(65 + index);
      const baseMove = {
        r: candidate.r,
        c: candidate.c,
        player: position.currentPlayer,
      };
      const line = candidate.line?.length
        ? candidate.line.map((point, lineIndex) => ({
            r: point.r,
            c: point.c,
            player: point.player ?? (lineIndex % 2 === 0
              ? position.currentPlayer
              : (position.currentPlayer === G.Config.BLACK ? G.Config.WHITE : G.Config.BLACK)),
          }))
        : [baseMove];

      return this.state.tree.addLine(this.state.tree.currentId, line, {
        source: 'ai',
        label: `AI ${letter} · ${G.History.coordinate(baseMove)}`,
        score: candidate.score,
        search,
      });
    }

    async expand() {
      if (!this.state.active || this.state.expanding) return false;
      const position = this.target();
      if (!position || position.gameOver) return false;

      this.state.expanding = true;
      this.state.lastExpansion = null;
      this.refresh(this.flags.STATUS | this.flags.OVERLAYS);

      const shallowCandidates = this.aiClient.candidates({
        board: position.board,
        moves: position.moves,
        player: position.currentPlayer,
        persona: this.settings.persona,
        limit: 3,
      });

      const response = await this.aiClient.chooseMove({
        board: position.board,
        moves: position.moves,
        difficulty: G.Config.AI_DIFFICULTIES.HARD,
        player: position.currentPlayer,
        persona: this.settings.persona,
        analysis: true,
        searchOptions: {
          timeBudgetMs: G.Config.AI_BUDGET_MS.analysis,
          maxDepth: G.Config.AI_MAX_DEPTH.analysis,
        },
        onProgress: () => this.refresh(this.flags.STATUS | this.flags.OVERLAYS),
      }, 'variation');

      if (!this.state.active || response.stale) return false;
      this.state.expanding = false;
      const detail = response.result;
      if (!detail?.move) {
        this.refresh(this.flags.STATUS | this.flags.OVERLAYS);
        return false;
      }

      const candidates = shallowCandidates.map(item => ({ ...item }));
      const bestIndex = candidates.findIndex(item =>
        item.r === detail.move.r && item.c === detail.move.c
      );
      if (bestIndex >= 0 && detail.principalVariation?.length) {
        candidates[bestIndex].line = detail.principalVariation.map(point => ({ ...point }));
      } else if (detail.principalVariation?.length) {
        candidates.unshift({
          rank: 1,
          r: detail.move.r,
          c: detail.move.c,
          score: detail.explanation?.score ?? detail.search?.score ?? 0,
          line: detail.principalVariation.map(point => ({ ...point })),
        });
      }

      const created = [];
      candidates.slice(0, 3).forEach((candidate, index) => {
        const node = this.addAiLine(candidate, index, index === 0 ? detail.search : null);
        if (node) created.push(node.id);
      });

      this.state.lastExpansion = {
        created,
        bestMove: { ...detail.move },
        depth: detail.search?.depth || 0,
        nodes: detail.search?.nodes || 0,
      };
      this.persist();
      this.refresh();
      return created.length > 0;
    }

    exit() {
      if (!this.state.active) return { exited: false, origin: 'game' };
      const origin = this.state.origin;
      this.aiClient.cancel('variation');
      this.persist();
      this.state = this.makeInitialState();
      return { exited: true, origin };
    }

    reset() {
      this.aiClient.cancel('variation');
      this.state = this.makeInitialState();
    }
  }

  G.Controllers = G.Controllers || {};
  G.Controllers.VariationController = VariationController;
})(window.Gomoku = window.Gomoku || {});
