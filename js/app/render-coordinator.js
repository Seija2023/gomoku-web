(function (G) {
  const { BLACK, WHITE, MODES } = G.Config;
  const { RenderFlags, hasRenderFlag, Activities } = G.AppCore;

  class RenderCoordinator {
    constructor(options) {
      Object.assign(this, options);
    }

    displayGame() {
      const activity = this.workspace.activity();
      if (activity === Activities.VARIATION) return this.controllers.variation.target();
      if (activity === Activities.POSITION_EDITOR) return this.controllers.positionEditor.target();
      if (activity === Activities.TRAINING) return this.controllers.training.state.target;
      if (activity === Activities.BRANCH) return this.controllers.branch.state.game;
      if (activity === Activities.REVIEW) return this.controllers.review.state.target;
      return this.game;
    }

    displayedBoardAndMoves(shown) {
      const review = this.controllers.review.state;
      if (this.workspace.isActivity(Activities.REVIEW)) {
        return {
          board: G.History.boardAt(shown.moves, review.index),
          moves: shown.moves.slice(0, review.index),
        };
      }
      return { board: shown.board, moves: shown.moves };
    }

    analysisPlayer(shown) {
      const activity = this.workspace.activity();
      if (activity === Activities.VARIATION) return shown.currentPlayer;
      if (activity === Activities.POSITION_EDITOR) {
        return this.controllers.positionEditor.state.analysisEnabled ? shown.currentPlayer : null;
      }
      if (activity === Activities.TRAINING) {
        const training = this.controllers.training.state;
        return training.puzzles[training.index]?.player || BLACK;
      }
      if (activity === Activities.REVIEW) {
        const review = this.controllers.review.state;
        if (review.index >= shown.moves.length) return null;
        return review.index % 2 === 0 ? BLACK : WHITE;
      }
      if (shown.gameOver) return null;
      return shown.currentPlayer;
    }

    interactionState(shown) {
      const activity = this.workspace.activity();

      if (activity === Activities.VARIATION) {
        const state = this.controllers.variation.state;
        return {
          locked: state.expanding || shown.gameOver,
          statusOverride: state.expanding ? '变化树 AI 扩展中' : '变化树实验室',
          thinking: state.expanding,
        };
      }

      if (activity === Activities.POSITION_EDITOR) {
        const state = this.controllers.positionEditor.state;
        return {
          locked: false,
          statusOverride: state.comparing
            ? '反事实分析中'
            : state.compareMode
              ? '选择要比较的下一手'
              : state.analysisEnabled ? '摆局分析' : '自由摆局',
          thinking: state.comparing,
        };
      }

      if (activity === Activities.TRAINING) {
        return {
          locked: Boolean(this.controllers.training.state.feedback),
          statusOverride: '自适应训练',
          thinking: false,
        };
      }

      if (activity === Activities.BRANCH) {
        const branch = this.controllers.branch.state;
        const locked = branch.aiThinking
          || branch.game.gameOver
          || branch.game.currentPlayer !== branch.humanPlayer;
        return {
          locked,
          statusOverride: branch.shared
            ? (branch.aiThinking ? '挑战 AI 思考中' : '分享挑战')
            : (branch.aiThinking ? '分支 AI 思考中' : '分支推演'),
          thinking: branch.aiThinking,
        };
      }

      if (activity === Activities.REVIEW) {
        return { locked: true, statusOverride: '复盘中', thinking: false };
      }

      return {
        locked: this.gameController.aiThinking
          || (this.game.mode === MODES.AI && this.game.currentPlayer === WHITE),
        statusOverride: null,
        thinking: this.gameController.aiThinking,
      };
    }

    previewAt(r, c) {
      const activity = this.workspace.activity();
      if (!this.settings.ghost) return null;
      if ([Activities.REVIEW, Activities.TRAINING, Activities.POSITION_EDITOR].includes(activity)) return null;

      const shown = this.displayGame();
      if (!shown || shown.gameOver || shown.board[r]?.[c] !== 0) return null;
      if (activity === Activities.VARIATION && this.controllers.variation.state.expanding) return null;
      if (
        activity === Activities.BRANCH
        && shown.currentPlayer !== this.controllers.branch.state.humanPlayer
      ) return null;
      if (
        activity === Activities.GAME
        && shown.mode === MODES.AI
        && shown.currentPlayer === WHITE
      ) return null;

      return this.aiClient.preview({
        board: shown.board,
        moves: shown.moves,
        r,
        c,
        player: shown.currentPlayer,
        persona: this.settings.persona,
      });
    }

    refresh(mask = RenderFlags.ALL) {
      const activity = this.workspace.activity();
      const review = this.controllers.review.state;
      const branch = this.controllers.branch.state;
      const training = this.controllers.training.state;
      const editor = this.controllers.positionEditor.state;
      const variation = this.controllers.variation.state;
      const shown = this.displayGame();

      const needsDisplayed =
        hasRenderFlag(mask, RenderFlags.BOARD)
        || hasRenderFlag(mask, RenderFlags.ANALYSIS);
      const displayed = needsDisplayed ? this.displayedBoardAndMoves(shown) : null;

      const needsInteraction =
        hasRenderFlag(mask, RenderFlags.BOARD)
        || hasRenderFlag(mask, RenderFlags.STATUS);
      const state = needsInteraction ? this.interactionState(shown) : null;

      if (hasRenderFlag(mask, RenderFlags.BOARD)) {
        let heatmap = [];
        if (
          this.settings.heatmap
          && activity !== Activities.TRAINING
          && activity !== Activities.POSITION_EDITOR
          && G.Position.countStones(displayed.board)
        ) {
          heatmap = this.aiClient.heatmap({
            board: displayed.board,
            moves: displayed.moves,
            mode: this.settings.heatmapMode,
          });
        }

        const reviewIndex = activity === Activities.REVIEW ? review.index : null;
        const showWinningLine =
          activity === Activities.REVIEW && review.index < shown.moves.length
            ? null
            : shown.winningLine;
        const ghostEnabled = this.settings.ghost
          && ![Activities.TRAINING, Activities.REVIEW, Activities.POSITION_EDITOR].includes(activity)
          && !state.locked;

        this.boardView.render(shown, {
          locked: state.locked,
          reviewIndex,
          winningLine: showWinningLine,
          heatmap,
          ghostEnabled,
          boardOverride: displayed.board,
          movesOverride: displayed.moves,
          comparison: activity === Activities.POSITION_EDITOR ? editor.comparison : null,
        });
      }

      if (hasRenderFlag(mask, RenderFlags.STATUS)) {
        const modePresentation = activity === Activities.BRANCH
          ? { ...shown, mode: MODES.AI }
          : activity === Activities.VARIATION ? { ...shown, mode: this.game.mode } : shown;

        this.panel.updateMode(modePresentation);
        this.panel.updateStatus(
          shown,
          state.thinking,
          this.audio.enabled,
          this.workspace.isSpecialActive(),
          state.statusOverride,
        );

        const progress = this.aiClient.progress?.() || null;
        this.insights.renderSearchStatus(progress);
        this.insights.renderSearchInspector(this.aiClient.searchTrace?.() || [], progress);
        this.workspaceView.render(this.workspace.snapshot());
      }

      if (hasRenderFlag(mask, RenderFlags.SETTINGS)) {
        this.insights.renderSettings(this.settings);
      }

      if (hasRenderFlag(mask, RenderFlags.ANALYSIS)) {
        this.insights.renderExplanation(
          activity === Activities.BRANCH ? branch.lastInsight : this.gameController.lastAiInsight,
        );
        const player = activity === Activities.TRAINING ? null : this.analysisPlayer(shown);
        const canAnalyze = activity === Activities.POSITION_EDITOR
          ? editor.analysisEnabled
          : G.Position.countStones(displayed.board) > 0;
        const candidates = player && canAnalyze
          ? this.aiClient.candidates({
              board: displayed.board,
              moves: displayed.moves,
              player,
              persona: this.settings.persona,
              limit: 3,
            })
          : [];
        this.insights.renderCandidates(candidates, player, this.boardView.pinnedKey());
      }

      if (hasRenderFlag(mask, RenderFlags.REVIEW)) {
        if (activity === Activities.REVIEW) {
          this.reviewView.show();
          this.reviewView.render(
            shown.moves,
            review.index,
            review.playing,
            review.analysis,
            index => this.controllers.review.seek(index),
            review.keyOnly,
          );
          this.advantageChart.set(review.advantage, review.index);
        } else {
          this.reviewView.hide();
          this.advantageChart.set([], 0);
        }
      }

      if (hasRenderFlag(mask, RenderFlags.OVERLAYS)) {
        if (activity === Activities.BRANCH) {
          this.insights.showBranch(branch.originIndex, branch.humanPlayer, branch.shared);
        } else {
          this.insights.hideBranch();
        }

        if (activity === Activities.TRAINING) {
          this.insights.showTraining(training);
        } else {
          this.insights.hideTraining();
        }

        this.positionEditorView.render(editor, this.controllers.positionEditor.canStart());
        this.variationView.render(variation);
        this.variationView.renderSavedAvailability(
          Boolean(this.storage.loadVariationTree()),
          activity === Activities.VARIATION,
        );
        this.workspaceView.render(this.workspace.snapshot());
      }
    }
  }

  G.AppCore = G.AppCore || {};
  G.AppCore.RenderCoordinator = RenderCoordinator;
})(window.Gomoku = window.Gomoku || {});
