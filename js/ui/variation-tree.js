(function (G) {
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);
  }

  class VariationTreeView {
    constructor(doc) {
      this.card = doc.getElementById('variationCard');
      this.summary = doc.getElementById('variationSummary');
      this.tree = doc.getElementById('variationTreeList');
      this.children = doc.getElementById('variationChildren');
      this.nameInput = doc.getElementById('variationNameInput');
      this.saveNameBtn = doc.getElementById('variationSaveNameBtn');
      this.favoriteBtn = doc.getElementById('variationFavoriteBtn');
      this.parentBtn = doc.getElementById('variationParentBtn');
      this.rootBtn = doc.getElementById('variationRootBtn');
      this.expandBtn = doc.getElementById('variationExpandBtn');
      this.deleteBtn = doc.getElementById('variationDeleteBtn');
      this.exitBtn = doc.getElementById('variationExitBtn');
      this.openBtn = doc.getElementById('variationStartBtn');
      this.resumeBtn = doc.getElementById('variationResumeBtn');
      this.lastKey = '';
    }

    bind(handlers) {
      this.openBtn.addEventListener('click', handlers.startCurrent);
      this.resumeBtn.addEventListener('click', handlers.resumeSaved);
      this.parentBtn.addEventListener('click', handlers.parent);
      this.rootBtn.addEventListener('click', handlers.root);
      this.expandBtn.addEventListener('click', handlers.expand);
      this.favoriteBtn.addEventListener('click', handlers.toggleFavorite);
      this.deleteBtn.addEventListener('click', handlers.removeCurrent);
      this.exitBtn.addEventListener('click', handlers.exit);
      this.saveNameBtn.addEventListener('click', () => handlers.rename(this.nameInput.value));
      this.nameInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') handlers.rename(this.nameInput.value);
      });
      this.tree.addEventListener('click', event => {
        const button = event.target.closest('[data-variation-node]');
        if (button) handlers.select(button.dataset.variationNode);
      });
      this.children.addEventListener('click', event => {
        const button = event.target.closest('[data-variation-child]');
        if (button) handlers.select(button.dataset.variationChild);
      });
    }

    renderSavedAvailability(available, active) {
      this.openBtn.disabled = Boolean(active);
      this.resumeBtn.disabled = Boolean(active) || !available;
    }

    render(state) {
      const active = Boolean(state?.active && state.tree);
      this.card.classList.toggle('hidden', !active);
      if (!active) {
        this.lastKey = '';
        return;
      }

      const tree = state.tree;
      const current = tree.current();
      const position = tree.position();
      const flat = tree.flatten();
      const key = [
        tree.updatedAt,
        tree.currentId,
        state.expanding,
        state.lastExpansion?.depth || 0,
        flat.length,
        current?.label || '',
        current?.favorite || false,
      ].join('|');
      if (key === this.lastKey) return;
      this.lastKey = key;

      this.nameInput.value = current?.label || '';
      this.favoriteBtn.textContent = current?.favorite ? '★ 已收藏' : '☆ 收藏';
      this.favoriteBtn.setAttribute('aria-pressed', String(Boolean(current?.favorite)));
      this.parentBtn.disabled = !current?.parentId || state.expanding;
      this.rootBtn.disabled = tree.currentId === 'root' || state.expanding;
      this.deleteBtn.disabled = tree.currentId === 'root' || state.expanding;
      this.expandBtn.disabled = Boolean(state.expanding || position?.gameOver);
      this.expandBtn.textContent = state.expanding ? 'AI 扩展中…' : 'AI 扩展候选';

      const playerLabel = position?.currentPlayer === G.Config.BLACK ? '黑' : '白';
      const expansion = state.lastExpansion
        ? ` · 最近扩展深度 ${state.lastExpansion.depth} / ${state.lastExpansion.nodes} 节点`
        : '';
      this.summary.textContent =
        `${current?.label || '局面'} · 节点 ${flat.length}/${G.Lab.VariationTree.MAX_NODES} · 下一手：${playerLabel}${expansion}`;

      this.children.replaceChildren();
      const children = tree.children();
      if (!children.length) {
        const empty = document.createElement('span');
        empty.className = 'variation-empty';
        empty.textContent = position?.gameOver ? '该节点已终局。' : '点击棋盘落子，或让 AI 扩展多个候选分支。';
        this.children.appendChild(empty);
      } else {
        for (const child of children) {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.variationChild = child.id;
          button.className = 'variation-child';
          button.innerHTML = `<strong>${child.favorite ? '★ ' : ''}${escapeHtml(child.label)}</strong><span>${child.source === 'ai' ? 'AI' : '手动'}${child.score != null ? ` · ${Math.round(child.score)}` : ''}</span>`;
          this.children.appendChild(button);
        }
      }

      this.tree.replaceChildren();
      for (const node of flat) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.variationNode = node.id;
        button.className = `variation-node${node.id === tree.currentId ? ' active' : ''}`;
        button.style.setProperty('--depth', String(Math.min(8, node.depth || 0)));
        const move = node.move ? G.History.coordinate(node.move) : 'ROOT';
        button.innerHTML = `
          <span class="variation-node-line"><strong>${node.favorite ? '★ ' : ''}${escapeHtml(node.label)}</strong><em>${move}</em></span>
          <small>${node.source === 'ai' ? 'AI 分支' : node.id === 'root' ? '根局面' : '手动分支'}${node.search?.depth ? ` · D${node.search.depth}` : ''}</small>
        `;
        this.tree.appendChild(button);
      }
    }
  }

  G.UI = G.UI || {};
  G.UI.VariationTreeView = VariationTreeView;
})(window.Gomoku = window.Gomoku || {});
