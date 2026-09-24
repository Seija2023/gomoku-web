(function (G) {
  const WORKSPACES = Object.freeze({
    GAME: 'game',
    ANALYSIS: 'analysis',
    TRAINING: 'training',
    LAB: 'lab',
  });

  const ACTIVITIES = Object.freeze({
    GAME: 'game',
    REVIEW: 'review',
    BRANCH: 'branch',
    TRAINING: 'training',
    POSITION_EDITOR: 'position-editor',
    VARIATION: 'variation',
  });

  const ACTIVITY_WORKSPACE = Object.freeze({
    [ACTIVITIES.REVIEW]: WORKSPACES.ANALYSIS,
    [ACTIVITIES.BRANCH]: WORKSPACES.ANALYSIS,
    [ACTIVITIES.TRAINING]: WORKSPACES.TRAINING,
    [ACTIVITIES.POSITION_EDITOR]: WORKSPACES.LAB,
    [ACTIVITIES.VARIATION]: WORKSPACES.LAB,
  });

  class WorkspaceManager {
    constructor({ controllers, initialWorkspace = WORKSPACES.GAME, onWorkspaceChange = null }) {
      this.controllers = controllers;
      this.selectedWorkspace = Object.values(WORKSPACES).includes(initialWorkspace)
        ? initialWorkspace
        : WORKSPACES.GAME;
      this.onWorkspaceChange = onWorkspaceChange;
    }

    activity() {
      if (this.controllers.variation.state.active) return ACTIVITIES.VARIATION;
      if (this.controllers.positionEditor.state.active) return ACTIVITIES.POSITION_EDITOR;
      if (this.controllers.training.state.active) return ACTIVITIES.TRAINING;
      if (this.controllers.branch.state.active) return ACTIVITIES.BRANCH;
      if (this.controllers.review.state.active) return ACTIVITIES.REVIEW;
      return ACTIVITIES.GAME;
    }

    isActivity(activity) {
      return this.activity() === activity;
    }

    isSpecialActive() {
      return this.activity() !== ACTIVITIES.GAME;
    }

    effectiveWorkspace() {
      return ACTIVITY_WORKSPACE[this.activity()] || this.selectedWorkspace;
    }

    select(workspace) {
      if (!Object.values(WORKSPACES).includes(workspace)) return false;
      if (this.isSpecialActive()) return false;
      if (workspace === this.selectedWorkspace) return true;
      this.selectedWorkspace = workspace;
      this.onWorkspaceChange?.(workspace);
      return true;
    }

    canEnterFromGame() {
      return this.activity() === ACTIVITIES.GAME;
    }

    resetSpecialModes() {
      this.controllers.review.reset();
      this.controllers.branch.reset();
      this.controllers.training.reset();
      this.controllers.positionEditor.reset();
      this.controllers.variation.reset();
    }

    snapshot() {
      return {
        activity: this.activity(),
        selected: this.selectedWorkspace,
        effective: this.effectiveWorkspace(),
        special: this.isSpecialActive(),
      };
    }
  }

  G.AppCore = G.AppCore || {};
  G.AppCore.Workspaces = WORKSPACES;
  G.AppCore.Activities = ACTIVITIES;
  G.AppCore.WorkspaceManager = WorkspaceManager;
})(window.Gomoku = window.Gomoku || {});
