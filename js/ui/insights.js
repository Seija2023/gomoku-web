(function (G) {
  const { BLACK } = G.Config;

  class InsightsView {
    constructor(doc) {
      this.difficulty = doc.getElementById('difficultySelect');
      this.heatToggle = doc.getElementById('heatmapToggle');
      this.heatMode = doc.getElementById('heatmapMode');
      this.explain = doc.getElementById('aiExplain');
      this.profile = doc.getElementById('profileContent');
      this.trainingBtn = doc.getElementById('trainingBtn');
      this.trainingCount = doc.getElementById('trainingCount');
      this.branchBar = doc.getElementById('branchBar');
      this.branchText = doc.getElementById('branchText');
      this.branchExit = doc.getElementById('branchExitBtn');
      this.trainingCard = doc.getElementById('trainingCard');
      this.trainingPrompt = doc.getElementById('trainingPrompt');
      this.trainingFeedback = doc.getElementById('trainingFeedback');
      this.trainingNext = doc.getElementById('trainingNextBtn');
      this.trainingExit = doc.getElementById('trainingExitBtn');
    }

    bind(handlers) {
      this.difficulty.addEventListener('change', () => handlers.changeDifficulty(this.difficulty.value));
      this.heatToggle.addEventListener('click', handlers.toggleHeatmap);
      this.heatMode.addEventListener('change', () => handlers.changeHeatmapMode(this.heatMode.value));
      this.trainingBtn.addEventListener('click', handlers.startTraining);
      this.branchExit.addEventListener('click', handlers.exitBranch);
      this.trainingNext.addEventListener('click', handlers.nextTraining);
      this.trainingExit.addEventListener('click', handlers.exitTraining);
    }

    renderSettings(settings) {
      this.difficulty.value = settings.difficulty;
      this.heatMode.value = settings.heatmapMode;
      this.heatToggle.textContent = `热力图：${settings.heatmap ? '开' : '关'}`;
      this.heatToggle.setAttribute('aria-pressed', String(settings.heatmap));
    }

    renderExplanation(insight) {
      this.explain.innerHTML = '';
      if (!insight?.move || !insight?.explanation) {
        this.explain.textContent = 'AI落子后，这里会显示它为什么选择该位置。';
        return;
      }

      const title = document.createElement('strong');
      title.textContent = `AI：${G.History.coordinate(insight.move)}`;
      this.explain.appendChild(title);

      const reason = document.createElement('p');
      reason.textContent = insight.explanation.reason;
      this.explain.appendChild(reason);

      const meta = document.createElement('p');
      meta.className = 'analysis-note';
      meta.textContent = `进攻价值：${insight.explanation.attackLevel} · 防守价值：${insight.explanation.defenseLevel}`;
      this.explain.appendChild(meta);

      if (insight.candidates?.length) {
        const small = document.createElement('p');
        small.className = 'analysis-note';
        small.textContent = `候选：${insight.candidates.map(item => G.History.coordinate(item)).join(' / ')}`;
        this.explain.appendChild(small);
      }
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

    renderTrainingCount(count) {
      this.trainingCount.textContent = String(count);
      this.trainingBtn.disabled = count === 0;
    }

    showBranch(index, player) {
      this.branchText.textContent = `分支推演 · 从第 ${index} 手后开始 · 你执${player === BLACK ? '黑' : '白'}`;
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
  }

  G.UI = G.UI || {};
  G.UI.InsightsView = InsightsView;
})(window.Gomoku = window.Gomoku || {});
