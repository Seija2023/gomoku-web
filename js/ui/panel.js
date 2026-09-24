(function (G) {
  const { BLACK, MODES } = G.Config;
  const { moveLabel } = G.History;

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
      this.resultCard = doc.getElementById('resultCard');
      this.resultTitle = doc.getElementById('resultTitle');
      this.resultText = doc.getElementById('resultText');
      this.resultUndoBtn = doc.getElementById('resultUndoBtn');
      this.resultReviewBtn = doc.getElementById('resultReviewBtn');
      this.resultRestartBtn = doc.getElementById('resultRestartBtn');
      this.resultCloseBtn = doc.getElementById('resultCloseBtn');
      this.historyList = doc.getElementById('historyList');
      this.resumeNotice = doc.getElementById('resumeNotice');
      this.resumeNoticeClose = doc.getElementById('resumeNoticeClose');
    }

    bind(handlers) {
      this.undoBtn.addEventListener('click', handlers.undo);
      this.soundBtn.addEventListener('click', handlers.toggleSound);
      this.restartBtn.addEventListener('click', handlers.restart);
      this.pvpModeBtn.addEventListener('click', () => handlers.setMode(MODES.PVP));
      this.aiModeBtn.addEventListener('click', () => handlers.setMode(MODES.AI));
      this.resultUndoBtn.addEventListener('click', handlers.undo);
      this.resultReviewBtn.addEventListener('click', () => handlers.startReview());
      this.resultRestartBtn.addEventListener('click', handlers.restart);
      this.resultCloseBtn.addEventListener('click', () => this.hideResult());
      this.resumeNoticeClose.addEventListener('click', () => this.resumeNotice.classList.add('hidden'));
    }

    showResumeNotice() { this.resumeNotice.classList.remove('hidden'); }
    hideResult() { this.resultCard.classList.add('hidden'); }

    showResult(game) {
      let title;
      if (game.winner === 0) title = '本局平局';
      else if (game.mode === MODES.AI) title = game.winner === BLACK ? '你获胜了' : '电脑获胜';
      else title = game.winner === BLACK ? '黑棋获胜' : '白棋获胜';
      this.resultTitle.textContent = title;
      this.resultText.textContent = game.winner
        ? `第 ${game.moves.length} 手完成五子连线。棋盘会保留，你可以悔棋、复盘或直接再来一局。`
        : `棋盘已满，共 ${game.moves.length} 手。你可以复盘整局。`;
      this.resultUndoBtn.disabled = game.moves.length === 0;
      this.resultCard.classList.remove('hidden');
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

    updateStatus(game, aiThinking, soundEnabled, interactionLocked = false, statusOverride = null) {
      const blackCount = game.moves.filter(move => move.player === BLACK).length;
      const whiteCount = game.moves.length - blackCount;
      this.blackCount.textContent = String(blackCount);
      this.whiteCount.textContent = String(whiteCount);
      this.moveCount.textContent = String(game.moves.length);
      this.undoBtn.disabled = game.moves.length === 0 || interactionLocked;
      this.restartBtn.disabled = interactionLocked;
      this.pvpModeBtn.disabled = interactionLocked;
      this.aiModeBtn.disabled = interactionLocked;

      const stone = this.turnIndicator.querySelector('.stone');
      stone.className = `stone ${game.currentPlayer === BLACK ? 'black' : 'white'}`;
      this.thinkingBadge.classList.toggle('hidden', !aiThinking);

      if (statusOverride) this.turnText.textContent = statusOverride;
      else if (game.gameOver) this.turnText.textContent = '对局结束';
      else if (game.mode === MODES.AI) this.turnText.textContent = game.currentPlayer === BLACK ? '你 · 黑棋' : '电脑 · 白棋';
      else this.turnText.textContent = game.currentPlayer === BLACK ? '黑棋' : '白棋';

      this.soundBtn.textContent = `音效：${soundEnabled ? '开' : '关'}`;
      this.soundBtn.setAttribute('aria-pressed', String(soundEnabled));
    }

    renderHistory(records, onOpen) {
      this.historyList.innerHTML = '';
      if (!records.length) {
        const empty = document.createElement('p');
        empty.className = 'helper-text';
        empty.textContent = '完成对局后会在这里保存最近 20 局。';
        this.historyList.appendChild(empty);
        return;
      }
      records.slice(0, 8).forEach(record => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'history-item';
        const when = new Date(record.finishedAt).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const result = record.winner === 0 ? '平局' : record.winner === BLACK ? '黑胜' : '白胜';
        btn.innerHTML = `<strong>${result}</strong><span>${record.mode === MODES.AI ? '人机' : '双人'} · ${record.moves.length}手 · ${when}</span>`;
        btn.addEventListener('click', () => onOpen(record));
        this.historyList.appendChild(btn);
      });
    }
  }

  G.UI = G.UI || {};
  G.UI.PanelView = PanelView;
})(window.Gomoku = window.Gomoku || {});
