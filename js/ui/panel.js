(function (G) {
  const { BLACK, MODES } = G.Config;

  class PanelView {
    constructor(doc) {
      this.subtitle = doc.getElementById('subtitle');
      this.turnText = doc.getElementById('turnText');
      this.turnIndicator = doc.getElementById('turnIndicator');
      this.thinkingBadge = doc.getElementById('thinkingBadge');
      this.moveCount = doc.getElementById('moveCount');
      this.blackCount = doc.getElementById('blackCount');
      this.whiteCount = doc.getElementById('whiteCount');
      this.blackLabel = doc.getElementById('blackLabel');
      this.whiteLabel = doc.getElementById('whiteLabel');
      this.undoBtn = doc.getElementById('undoBtn');
      this.soundBtn = doc.getElementById('soundBtn');
      this.restartBtn = doc.getElementById('restartBtn');
      this.pvpModeBtn = doc.getElementById('pvpModeBtn');
      this.aiModeBtn = doc.getElementById('aiModeBtn');
      this.modeHint = doc.getElementById('modeHint');
      this.playAgainBtn = doc.getElementById('playAgainBtn');
      this.modal = doc.getElementById('modal');
      this.resultTitle = doc.getElementById('resultTitle');
      this.resultText = doc.getElementById('resultText');
    }

    bind(handlers) {
      this.undoBtn.addEventListener('click', handlers.undo);
      this.soundBtn.addEventListener('click', handlers.toggleSound);
      this.restartBtn.addEventListener('click', handlers.restart);
      this.playAgainBtn.addEventListener('click', handlers.restart);
      this.pvpModeBtn.addEventListener('click', () => handlers.setMode(MODES.PVP));
      this.aiModeBtn.addEventListener('click', () => handlers.setMode(MODES.AI));
    }

    hideModal() {
      this.modal.classList.add('hidden');
    }

    showResult(game, player) {
      let name;
      if (game.mode === MODES.AI) name = player === BLACK ? '你获胜了' : '电脑获胜';
      else name = player === BLACK ? '黑棋获胜' : '白棋获胜';
      this.resultTitle.textContent = name;
      this.resultText.textContent = `第 ${game.moves.length} 手完成五子连线。`;
      this.modal.classList.remove('hidden');
    }

    showDraw() {
      this.resultTitle.textContent = '平局';
      this.resultText.textContent = '棋盘已满，本局未分胜负。';
      this.modal.classList.remove('hidden');
    }

    updateMode(game) {
      const aiMode = game.mode === MODES.AI;
      this.pvpModeBtn.classList.toggle('active', !aiMode);
      this.aiModeBtn.classList.toggle('active', aiMode);
      this.pvpModeBtn.setAttribute('aria-pressed', String(!aiMode));
      this.aiModeBtn.setAttribute('aria-pressed', String(aiMode));
      this.subtitle.textContent = aiMode
        ? '人机对战 · 你执黑棋，电脑执白棋'
        : '双人本地对战 · 连成五子即可获胜';
      this.modeHint.textContent = aiMode
        ? '你执黑先手；电脑会优先进攻、拦截五连，并根据棋形选择落点。'
        : '两名玩家在同一设备轮流落子。';
      this.blackLabel.textContent = aiMode ? '你（黑棋）' : '黑棋';
      this.whiteLabel.textContent = aiMode ? '电脑（白棋）' : '白棋';
    }

    updateStatus(game, aiThinking, soundEnabled) {
      const blackCount = game.moves.filter(move => move.player === BLACK).length;
      const whiteCount = game.moves.length - blackCount;
      this.blackCount.textContent = String(blackCount);
      this.whiteCount.textContent = String(whiteCount);
      this.moveCount.textContent = String(game.moves.length);
      this.undoBtn.disabled = game.moves.length === 0;

      const stone = this.turnIndicator.querySelector('.stone');
      stone.className = `stone ${game.currentPlayer === BLACK ? 'black' : 'white'}`;
      this.thinkingBadge.classList.toggle('hidden', !aiThinking);

      if (game.gameOver) {
        this.turnText.textContent = '对局结束';
      } else if (game.mode === MODES.AI) {
        this.turnText.textContent = game.currentPlayer === BLACK ? '你 · 黑棋' : '电脑 · 白棋';
      } else {
        this.turnText.textContent = game.currentPlayer === BLACK ? '黑棋' : '白棋';
      }

      this.soundBtn.textContent = `音效：${soundEnabled ? '开' : '关'}`;
      this.soundBtn.setAttribute('aria-pressed', String(soundEnabled));
    }
  }

  G.UI = G.UI || {};
  G.UI.PanelView = PanelView;
})(window.Gomoku = window.Gomoku || {});
