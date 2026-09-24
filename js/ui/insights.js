(function (G) {
  const { BLACK } = G.Config;

  class InsightsView {
    constructor(doc) {
      this.difficulty = doc.getElementById('difficultySelect');
      this.persona = doc.getElementById('personaSelect');
      this.heatToggle = doc.getElementById('heatmapToggle');
      this.heatMode = doc.getElementById('heatmapMode');
      this.ghostToggle = doc.getElementById('ghostToggle');
      this.explain = doc.getElementById('aiExplain');
      this.searchStatus = doc.getElementById('aiSearchStatus');
      this.candidateCompare = doc.getElementById('candidateCompare');
      this.candidateSide = doc.getElementById('candidateSide');
      this.profile = doc.getElementById('profileContent');
      this.trainingBtn = doc.getElementById('trainingBtn');
      this.trainingCount = doc.getElementById('trainingCount');
      this.trainingStats = doc.getElementById('trainingStats');
      this.openingLibrary = doc.getElementById('openingLibrary');
      this.branchBar = doc.getElementById('branchBar');
      this.branchText = doc.getElementById('branchText');
      this.branchExit = doc.getElementById('branchExitBtn');
      this.trainingCard = doc.getElementById('trainingCard');
      this.trainingPrompt = doc.getElementById('trainingPrompt');
      this.trainingFeedback = doc.getElementById('trainingFeedback');
      this.trainingNext = doc.getElementById('trainingNextBtn');
      this.trainingExit = doc.getElementById('trainingExitBtn');
      this.shareNotice = doc.getElementById('shareNotice');
      this.shareNoticeText = doc.getElementById('shareNoticeText');
      this.shareNoticeClose = doc.getElementById('shareNoticeClose');
      this.renderKeys = { settings: '', explanation: '', candidates: '', search: '' };
    }

    bind(handlers) {
      this.difficulty.addEventListener('change', () => handlers.changeDifficulty(this.difficulty.value));
      this.persona.addEventListener('change', () => handlers.changePersona(this.persona.value));
      this.heatToggle.addEventListener('click', handlers.toggleHeatmap);
      this.heatMode.addEventListener('change', () => handlers.changeHeatmapMode(this.heatMode.value));
      this.ghostToggle.addEventListener('click', handlers.toggleGhost);
      this.trainingBtn.addEventListener('click', handlers.startTraining);
      this.branchExit.addEventListener('click', handlers.exitBranch);
      this.trainingNext.addEventListener('click', handlers.nextTraining);
      this.trainingExit.addEventListener('click', handlers.exitTraining);
      this.shareNoticeClose.addEventListener('click', () => this.shareNotice.classList.add('hidden'));
    }

    renderSettings(settings) {
      const key = `${settings.difficulty}|${settings.persona}|${settings.heatmap}|${settings.heatmapMode}|${settings.ghost}`;
      if (key === this.renderKeys.settings) return;
      this.renderKeys.settings = key;
      this.difficulty.value = settings.difficulty;
      this.persona.value = settings.persona;
      this.heatMode.value = settings.heatmapMode;
      this.heatToggle.textContent = `热力图：${settings.heatmap ? '开' : '关'}`;
      this.heatToggle.setAttribute('aria-pressed', String(settings.heatmap));
      this.ghostToggle.textContent = `幽灵线：${settings.ghost ? '开' : '关'}`;
      this.ghostToggle.setAttribute('aria-pressed', String(settings.ghost));
    }

    renderExplanation(insight) {
      const key = insight?.move && insight?.explanation
        ? `${insight.move.r},${insight.move.c}|${insight.explanation.reason}|${insight.explanation.attackLevel}|${insight.explanation.defenseLevel}|${insight.explanation.lookahead || ''}|${insight.explanation.personaLabel || ''}`
        : 'empty';
      if (key === this.renderKeys.explanation) return;
      this.renderKeys.explanation = key;
      this.explain.innerHTML = '';
      if (!insight?.move || !insight?.explanation) {
        this.explain.textContent = 'AI落子后，这里会显示它为什么选择该位置。';
        return;
      }

      const title = document.createElement('strong');
      title.textContent = `AI：${G.History.coordinate(insight.move)} · ${insight.explanation.personaLabel || '均衡型'}`;
      this.explain.appendChild(title);

      const reason = document.createElement('p');
      reason.textContent = insight.explanation.reason;
      this.explain.appendChild(reason);

      const meta = document.createElement('p');
      meta.className = 'analysis-note';
      meta.textContent = `进攻价值：${insight.explanation.attackLevel} · 防守价值：${insight.explanation.defenseLevel}`;
      this.explain.appendChild(meta);

      if (insight.explanation.lookahead) {
        const lookahead = document.createElement('p');
        lookahead.className = 'analysis-note';
        lookahead.textContent = insight.explanation.lookahead;
        this.explain.appendChild(lookahead);
      }
    }

    renderSearchStatus(progress) {
      const key = progress
        ? `${progress.mode || ''}|${progress.channel || ''}|${progress.active}|${progress.depth || 0}|${progress.nodes || 0}|${progress.elapsedMs || 0}|${progress.cacheHits || 0}|${progress.tacticalNodes || 0}|${progress.bestMove?.r ?? '-'},${progress.bestMove?.c ?? '-'}`
        : 'empty';
      if (key === this.renderKeys.search) return;
      this.renderKeys.search = key;

      if (!progress) {
        this.searchStatus.classList.add('hidden');
        this.searchStatus.textContent = '';
        return;
      }

      const parts = [];
      parts.push(progress.mode === 'worker' ? 'Worker AI' : '主线程 AI');
      if (progress.depth) parts.push(`深度 ${progress.depth}`);
      if (progress.nodes != null) parts.push(`${progress.nodes.toLocaleString()} 节点`);
      if (progress.elapsedMs != null) parts.push(`${progress.elapsedMs} ms`);
      if (progress.cacheHits) parts.push(`缓存命中 ${progress.cacheHits}`);
      if (progress.tacticalNodes) parts.push(`战术节点 ${progress.tacticalNodes}`);
      if (progress.bestMove?.r != null) parts.push(`当前推荐 ${G.History.coordinate(progress.bestMove)}`);

      this.searchStatus.textContent = `${progress.active ? 'AI 搜索中 · ' : '最近搜索 · '}${parts.join(' · ')}`;
      this.searchStatus.classList.remove('hidden');
    }

    renderCandidates(candidates, player) {
      const key = `${player || 0}|${(candidates || []).map(item =>
        `${item.r},${item.c},${item.score},${item.attackLevel},${item.defenseLevel},${item.reply?.r ?? '-'},${item.reply?.c ?? '-'},${item.followUp?.r ?? '-'},${item.followUp?.c ?? '-'}`
      ).join(';')}`;
      if (key === this.renderKeys.candidates) return;
      this.renderKeys.candidates = key;
      this.candidateCompare.innerHTML = '';
      this.candidateSide.textContent = player ? `${player === BLACK ? '黑' : '白'}方视角` : '';

      if (!candidates?.length) {
        const empty = document.createElement('p');
        empty.className = 'helper-text';
        empty.textContent = '落子后会显示前三个候选点。';
        this.candidateCompare.appendChild(empty);
        return;
      }

      candidates.forEach((item, index) => {
        const card = document.createElement('article');
        card.className = 'candidate-card';
        const letter = String.fromCharCode(65 + index);
        const reply = item.reply ? G.History.coordinate(item.reply) : '—';
        const follow = item.followUp ? G.History.coordinate(item.followUp) : '—';
        card.innerHTML = `
          <div class="candidate-title"><strong>${letter} · ${G.History.coordinate(item)}</strong><span>${item.score}</span></div>
          <div class="candidate-row"><span>进攻</span><strong>${item.attackLevel}</strong></div>
          <div class="candidate-row"><span>防守</span><strong>${item.defenseLevel}</strong></div>
          <div class="candidate-row"><span>对手回应</span><strong>${reply}</strong></div>
          <div class="candidate-row"><span>后续建议</span><strong>${follow}</strong></div>
        `;
        this.candidateCompare.appendChild(card);
      });
    }

    renderProfile(profile) {
      this.profile.innerHTML = '';
      const rows = [
        ['人机对局', profile.games],
        ['胜 / 负 / 平', `${profile.wins} / ${profile.losses} / ${profile.draws}`],
        ['平均手数', profile.avgMoves || '-'],
        ['中心落子率', `${profile.centerRate}%`],
        ['进攻关键手', profile.attackMoments],
        ['关键防守', profile.defenseMoments],
        ['明显失误', profile.mistakes],
        ['棋风', profile.style],
      ];

      rows.forEach(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'profile-row';
        const a = document.createElement('span');
        a.textContent = label;
        const b = document.createElement('strong');
        b.textContent = String(value);
        row.append(a, b);
        this.profile.appendChild(row);
      });
    }

    renderTrainingCount(count, total = count) {
      this.trainingCount.textContent = String(count);
      this.trainingBtn.disabled = total === 0;
    }

    renderTrainingStats(stats) {
      this.trainingStats.innerHTML = '';
      const items = [
        ['今日复习', stats.due],
        ['待加强', stats.weak],
        ['已掌握', stats.mastered],
      ];
      items.forEach(([label, value]) => {
        const item = document.createElement('div');
        item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
        this.trainingStats.appendChild(item);
      });
    }

    renderOpenings(openings) {
      this.openingLibrary.innerHTML = '';
      if (!openings?.length) {
        const empty = document.createElement('p');
        empty.className = 'helper-text';
        empty.textContent = '完成更多棋局后会自动整理常用开局。';
        this.openingLibrary.appendChild(empty);
        return;
      }

      openings.forEach(item => {
        const card = document.createElement('article');
        card.className = 'opening-card';
        card.innerHTML = `
          <strong>${item.label || '开局'}</strong>
          <span>使用 ${item.uses} 次 · 黑胜 ${item.wins} · 白胜 ${item.losses} · 平 ${item.draws}</span>
          <span>平均 ${item.avgMoves} 手结束</span>
        `;
        this.openingLibrary.appendChild(card);
      });
    }

    showBranch(index, player, shared = false) {
      this.branchText.textContent = shared
        ? `分享挑战 · 从第 ${index} 手开始 · 你执${player === BLACK ? '黑' : '白'}`
        : `分支推演 · 从第 ${index} 手后开始 · 你执${player === BLACK ? '黑' : '白'}`;
      this.branchExit.textContent = shared ? '退出挑战' : '返回原局';
      this.branchBar.classList.remove('hidden');
    }

    hideBranch() {
      this.branchBar.classList.add('hidden');
    }

    showTraining(puzzle, index, total, feedback = '') {
      this.trainingPrompt.textContent = `训练 ${index + 1}/${total} · ${puzzle.prompt}`;
      this.trainingFeedback.textContent = feedback;
      this.trainingNext.disabled = !feedback;
      this.trainingCard.classList.remove('hidden');
    }

    hideTraining() {
      this.trainingCard.classList.add('hidden');
    }

    showShareNotice(message) {
      this.shareNoticeText.textContent = message;
      this.shareNotice.classList.remove('hidden');
    }
  }

  G.UI = G.UI || {};
  G.UI.InsightsView = InsightsView;
})(window.Gomoku = window.Gomoku || {});
