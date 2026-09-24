(function (G) {
  class WorkspaceView {
    constructor(doc) {
      this.nav = doc.getElementById('workspaceNav');
      this.context = doc.getElementById('workspaceContext');
      this.buttons = [...doc.querySelectorAll('[data-workspace-target]')];
      this.sections = [...doc.querySelectorAll('[data-workspaces]')];
      this.lastKey = '';
    }

    bind(onSelect) {
      this.nav.addEventListener('click', event => {
        const button = event.target.closest('[data-workspace-target]');
        if (!button || button.disabled) return;
        onSelect(button.dataset.workspaceTarget);
      });
    }

    render(snapshot) {
      const key = `${snapshot.activity}|${snapshot.selected}|${snapshot.effective}|${snapshot.special}`;
      if (key === this.lastKey) return;
      this.lastKey = key;

      for (const button of this.buttons) {
        const active = button.dataset.workspaceTarget === snapshot.effective;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
        button.disabled = snapshot.special && !active;
      }

      for (const section of this.sections) {
        const allowed = String(section.dataset.workspaces || '').split(/\s+/).filter(Boolean);
        section.classList.toggle('workspace-visible', allowed.includes(snapshot.effective));
      }

      const labels = {
        game: '对局',
        review: '复盘',
        branch: '分支推演',
        training: '自适应训练',
        'position-editor': '自由摆局',
        variation: '变化树实验室',
      };
      this.context.textContent = snapshot.special
        ? `当前：${labels[snapshot.activity] || snapshot.activity}`
        : '';
      this.context.classList.toggle('hidden', !snapshot.special);
      document.body.dataset.workspace = snapshot.effective;
      document.body.dataset.activity = snapshot.activity;
    }
  }

  G.UI = G.UI || {};
  G.UI.WorkspaceView = WorkspaceView;
})(window.Gomoku = window.Gomoku || {});
