(function (G) {
  const MAX_NODES = 160;

  function cloneMove(move) {
    return move ? { r: move.r, c: move.c, player: move.player } : null;
  }

  function cloneBoard(board) {
    return G.Position.cloneBoard(board);
  }

  class VariationTree {
    constructor(rootPosition, options = {}) {
      const parsed = G.Position.fromBoard(
        rootPosition?.board || G.Position.emptyBoard(),
        rootPosition?.currentPlayer || G.Config.BLACK,
      );
      if (!parsed) throw new Error('Invalid variation root position');

      this.version = 1;
      this.rootBoard = cloneBoard(parsed.board);
      this.rootPlayer = parsed.currentPlayer;
      this.rootLabel = options.rootLabel || '根局面';
      this.createdAt = options.createdAt || Date.now();
      this.updatedAt = options.updatedAt || this.createdAt;
      this.sequence = 1;
      this.currentId = 'root';
      this.nodes = new Map();
      this.nodes.set('root', {
        id: 'root',
        parentId: null,
        move: null,
        label: this.rootLabel,
        source: options.source || 'root',
        favorite: false,
        score: null,
        depth: 0,
        createdAt: this.createdAt,
        children: [],
      });
    }

    touch() {
      this.updatedAt = Date.now();
    }

    get size() {
      return this.nodes.size;
    }

    node(id = this.currentId) {
      return this.nodes.get(id) || null;
    }

    current() {
      return this.node(this.currentId);
    }

    children(id = this.currentId) {
      const node = this.node(id);
      return node ? node.children.map(childId => this.node(childId)).filter(Boolean) : [];
    }

    path(id = this.currentId) {
      const path = [];
      let node = this.node(id);
      while (node && node.parentId) {
        path.push(node);
        node = this.node(node.parentId);
      }
      return path.reverse();
    }

    position(id = this.currentId) {
      const board = cloneBoard(this.rootBoard);
      let currentPlayer = this.rootPlayer;
      const continuation = [];

      for (const node of this.path(id)) {
        const move = node.move;
        if (
          !move
          || move.player !== currentPlayer
          || !G.Rules.isInside(board, move.r, move.c)
          || board[move.r][move.c] !== 0
        ) return null;

        board[move.r][move.c] = move.player;
        continuation.push(cloneMove(move));
        currentPlayer = currentPlayer === G.Config.BLACK ? G.Config.WHITE : G.Config.BLACK;
      }

      const inspection = G.Position.inspectBoard(board);
      return {
        board,
        moves: continuation,
        currentPlayer,
        gameOver: inspection.terminal,
        winner: inspection.winner,
        winningLine: inspection.winningLine,
        source: 'variation-tree',
        nodeId: id,
      };
    }

    findChild(parentId, move) {
      return this.children(parentId).find(node =>
        node.move
        && node.move.r === move.r
        && node.move.c === move.c
        && node.move.player === move.player
      ) || null;
    }

    addChild(parentId, move, metadata = {}) {
      if (this.nodes.size >= MAX_NODES) return null;
      const parent = this.node(parentId);
      if (!parent || !move) return null;
      const parentPosition = this.position(parentId);
      if (!parentPosition || parentPosition.gameOver) return null;
      if (
        move.player !== parentPosition.currentPlayer
        || !G.Rules.isInside(parentPosition.board, move.r, move.c)
        || parentPosition.board[move.r][move.c] !== 0
      ) return null;

      const existing = this.findChild(parentId, move);
      if (existing) {
        if (metadata.score != null) existing.score = metadata.score;
        if (metadata.label && existing.source === 'ai') existing.label = metadata.label;
        if (metadata.search) existing.search = { ...metadata.search };
        this.touch();
        return existing;
      }

      const id = `n${this.sequence++}`;
      const node = {
        id,
        parentId,
        move: cloneMove(move),
        label: metadata.label || G.History.coordinate(move),
        source: metadata.source || 'manual',
        favorite: Boolean(metadata.favorite),
        score: metadata.score ?? null,
        search: metadata.search ? { ...metadata.search } : null,
        depth: parent.depth + 1,
        createdAt: Date.now(),
        children: [],
      };
      this.nodes.set(id, node);
      parent.children.push(id);
      this.touch();
      return node;
    }

    addLine(parentId, line, metadata = {}) {
      let cursor = parentId;
      let first = null;
      for (let index = 0; index < (line || []).length; index += 1) {
        const move = line[index];
        const node = this.addChild(cursor, move, {
          source: metadata.source || 'ai',
          label: index === 0 ? metadata.label : undefined,
          score: index === 0 ? metadata.score : null,
          search: index === 0 ? metadata.search : null,
        });
        if (!node) break;
        if (!first) first = node;
        cursor = node.id;
      }
      return first;
    }

    select(id) {
      if (!this.nodes.has(id)) return false;
      this.currentId = id;
      this.touch();
      return true;
    }

    selectParent() {
      const current = this.current();
      return current?.parentId ? this.select(current.parentId) : false;
    }

    selectRoot() {
      return this.select('root');
    }

    rename(id, label) {
      const node = this.node(id);
      const value = String(label || '').trim().slice(0, 36);
      if (!node || !value) return false;
      node.label = value;
      this.touch();
      return true;
    }

    toggleFavorite(id) {
      const node = this.node(id);
      if (!node) return false;
      node.favorite = !node.favorite;
      this.touch();
      return node.favorite;
    }

    removeSubtree(id) {
      if (id === 'root') return false;
      const node = this.node(id);
      if (!node) return false;
      const parent = this.node(node.parentId);
      if (parent) parent.children = parent.children.filter(childId => childId !== id);

      const remove = targetId => {
        const target = this.node(targetId);
        if (!target) return;
        for (const childId of [...target.children]) remove(childId);
        this.nodes.delete(targetId);
      };
      remove(id);
      this.currentId = parent?.id || 'root';
      this.touch();
      return true;
    }

    flatten() {
      const result = [];
      const walk = id => {
        const node = this.node(id);
        if (!node) return;
        result.push(node);
        for (const childId of node.children) walk(childId);
      };
      walk('root');
      return result;
    }

    serialize() {
      return {
        version: this.version,
        rootBoard: cloneBoard(this.rootBoard),
        rootPlayer: this.rootPlayer,
        rootLabel: this.rootLabel,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        sequence: this.sequence,
        currentId: this.currentId,
        nodes: this.flatten().map(node => ({
          ...node,
          move: cloneMove(node.move),
          search: node.search ? { ...node.search } : null,
          children: [...node.children],
        })),
      };
    }

    static restore(payload) {
      if (
        !payload
        || payload.version !== 1
        || !Array.isArray(payload.nodes)
        || !G.Position.validateBoard(payload.rootBoard).ok
        || ![G.Config.BLACK, G.Config.WHITE].includes(payload.rootPlayer)
      ) return null;

      const tree = new VariationTree({
        board: payload.rootBoard,
        currentPlayer: payload.rootPlayer,
      }, {
        rootLabel: payload.rootLabel,
        createdAt: payload.createdAt,
        updatedAt: payload.updatedAt,
      });

      tree.nodes = new Map();
      for (const raw of payload.nodes) {
        if (!raw?.id || !Array.isArray(raw.children)) return null;
        tree.nodes.set(raw.id, {
          ...raw,
          move: cloneMove(raw.move),
          search: raw.search ? { ...raw.search } : null,
          children: [...raw.children],
        });
      }
      if (!tree.nodes.has('root') || tree.nodes.size > MAX_NODES) return null;

      tree.currentId = tree.nodes.has(payload.currentId) ? payload.currentId : 'root';

      for (const node of tree.nodes.values()) {
        if (node.id === 'root' && node.parentId !== null) return null;
        if (node.id !== 'root' && (!node.parentId || !tree.nodes.has(node.parentId))) return null;
        for (const childId of node.children) {
          const child = tree.nodes.get(childId);
          if (!child || child.parentId !== node.id) return null;
        }
      }

      const visiting = new Set();
      const visited = new Set();
      const validateGraph = id => {
        if (visiting.has(id)) return false;
        if (visited.has(id)) return true;
        const node = tree.nodes.get(id);
        if (!node) return false;
        visiting.add(id);
        for (const childId of node.children) {
          if (!validateGraph(childId)) return false;
        }
        visiting.delete(id);
        visited.add(id);
        return true;
      };
      if (!validateGraph('root') || visited.size !== tree.nodes.size) return null;

      const numericIds = [...tree.nodes.keys()]
        .map(id => /^n(\d+)$/.exec(id))
        .filter(Boolean)
        .map(match => Number(match[1]));
      const safeSequence = numericIds.length ? Math.max(...numericIds) + 1 : 1;
      tree.sequence = Math.max(
        safeSequence,
        Number.isInteger(payload.sequence) ? payload.sequence : safeSequence,
      );

      if (!tree.position(tree.currentId)) return null;
      return tree;
    }
  }

  VariationTree.MAX_NODES = MAX_NODES;
  G.Lab = G.Lab || {};
  G.Lab.VariationTree = VariationTree;
})(window.Gomoku = window.Gomoku || {});
