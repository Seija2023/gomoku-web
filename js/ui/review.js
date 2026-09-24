(function (G) {
  const { BLACK } = G.Config;
  const { moveLabel } = G.History;

  class ReviewView {
    constructor(doc) {
      this.card = doc.getElementById('reviewCard');
      this.position = doc.getElementById('reviewPosition');
      this.startBtn = doc.getElementById('reviewStartBtn');
      this.prevBtn = doc.getElementById('reviewPrevBtn');
      this.playBtn = doc.getElementById('reviewPlayBtn');
      this.nextBtn = doc.getElementById('reviewNextBtn');
      this.endBtn = doc.getElementById('reviewEndBtn');
      this.exitBtn = doc.getElementById('reviewExitBtn');
      this.branchBtn = doc.getElementById('reviewBranchBtn');
      this.keyOnlyBtn = doc.getElementById('reviewKeyOnlyBtn');
      this.shareBtn = doc.getElementById('reviewShareBtn');
      this.challengeBtn = doc.getElementById('reviewChallengeBtn');
      this.timeline = doc.getElementById('reviewTimeline');
      this.keyMarkers = doc.getElementById('reviewKeyMarkers');
      this.moveList = doc.getElementById('moveList');
      this.analysis = doc.getElementById('analysisContent');

      this.onSeek = null;
      this.moveButtons = new Map();
      this.activeMoveIndex = null;
      this.structureKey = '';
      this.analysisKey = '';
      this.metrics = { renders: 0, listBuilds: 0, markerBuilds: 0, analysisBuilds: 0 };

      this.moveList.addEventListener('click', event => {
        const button = event.target.closest('[data-move-index]');
        if (!button || !this.moveList.contains(button) || !this.onSeek) return;
        this.onSeek(Number(button.dataset.moveIndex) + 1);
      });

      this.keyMarkers.addEventListener('click', event => {
        const button = event.target.closest('[data-review-index]');
        if (!button || !this.keyMarkers.contains(button) || !this.onSeek) return;
        this.onSeek(Number(button.dataset.reviewIndex));
      });
    }

    bind(handlers) {
      this.startBtn.addEventListener('click', () => handlers.seek(0));
      this.prevBtn.addEventListener('click', () => handlers.seekRelative(-1));
      this.playBtn.addEventListener('click', handlers.togglePlay);
      this.nextBtn.addEventListener('click', () => handlers.seekRelative(1));
      this.endBtn.addEventListener('click', handlers.seekEnd);
      this.exitBtn.addEventListener('click', handlers.exit);
      this.branchBtn.addEventListener('click', handlers.startBranch);
      this.keyOnlyBtn.addEventListener('click', handlers.toggleKeyOnly);
      this.shareBtn.addEventListener('click', handlers.shareGame);
      this.challengeBtn.addEventListener('click', handlers.shareChallenge);
      this.timeline.addEventListener('input', () => handlers.seek(Number(this.timeline.value)));
    }

    show() { this.card.classList.remove('hidden'); }
    hide() { this.card.classList.add('hidden'); }

    makeStructureKey(moves, analysis, keyOnly) {
      return [
        moves.length,
        keyOnly ? 1 : 0,
        analysis.moments.map(item => `${item.index}:${item.type}:${item.label}`).join('|'),
      ].join('::');
    }

    makeAnalysisKey(analysis) {
      return [
        analysis.totalMoves,
        analysis.winner,
        analysis.winnerText,
        analysis.direction,
        analysis.moments.map(item => `${item.index}:${item.player}:${item.coordinate}:${item.label}`).join('|'),
      ].join('::');
    }

    rebuildMoveList(moves, analysis, keyOnly) {
      const keyMap = new Map(analysis.moments.map(item => [item.index, item]));
      const fragment = document.createDocumentFragment();
      this.moveButtons.clear();

      moves.forEach((move, i) => {
        const moment = keyMap.get(i);
        if (keyOnly && !moment) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `move-item${moment ? ' key' : ''}`;
        btn.dataset.moveIndex = String(i);
        btn.textContent = `${moment ? '★ ' : ''}${moveLabel(move, i)}`;
        if (moment) btn.title = moment.label;
        this.moveButtons.set(i + 1, btn);
        fragment.appendChild(btn);
      });

      this.moveList.replaceChildren(fragment);
      this.activeMoveIndex = null;
      this.metrics.listBuilds += 1;
    }

    rebuildMarkers(moves, analysis) {
      const fragment = document.createDocumentFragment();
      analysis.moments.forEach(moment => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `timeline-marker marker-${moment.type}`;
        btn.style.left = `${moves.length ? ((moment.index + 1) / moves.length) * 100 : 0}%`;
        btn.title = `第${moment.index + 1}手：${moment.label}`;
        btn.setAttribute('aria-label', btn.title);
        btn.dataset.reviewIndex = String(moment.index + 1);
        fragment.appendChild(btn);
      });
      this.keyMarkers.replaceChildren(fragment);
      this.metrics.markerBuilds += 1;
    }

    rebuildAnalysis(analysis) {
      const fragment = document.createDocumentFragment();

      const summary = document.createElement('p');
      summary.innerHTML = `<strong>${analysis.winnerText}</strong> · 共 ${analysis.totalMoves} 手${analysis.winner ? ` · ${analysis.direction}` : ''}`;
      fragment.appendChild(summary);

      const list = document.createElement('ul');
      const displayed = analysis.moments.slice(-10);
      if (displayed.length) {
        displayed.forEach(item => {
          const li = document.createElement('li');
          li.className = `analysis-${item.type}`;
          li.textContent = `第${item.index + 1}手 ${item.player === BLACK ? '黑' : '白'} ${item.coordinate}：${item.label}`;
          list.appendChild(li);
        });
      } else {
        const li = document.createElement('li');
        li.textContent = '未检测到明显的关键棋形。';
        list.appendChild(li);
      }
      fragment.appendChild(list);

      const note = document.createElement('p');
      note.className = 'analysis-note';
      note.textContent = '关键手、失误与优势曲线来自本地棋形规则和启发式评分，不等同于专业求解器的唯一最佳手。';
      fragment.appendChild(note);

      this.analysis.replaceChildren(fragment);
      this.metrics.analysisBuilds += 1;
    }

    updateActiveMove(index) {
      if (this.activeMoveIndex === index) return;
      this.moveButtons.get(this.activeMoveIndex)?.classList.remove('active');
      this.moveButtons.get(index)?.classList.add('active');
      this.activeMoveIndex = index;
    }

    render(moves, index, playing, analysis, onSeek, keyOnly = false) {
      this.metrics.renders += 1;
      this.onSeek = onSeek;
      this.position.textContent = `第 ${index} / ${moves.length} 手`;
      this.playBtn.textContent = playing ? '暂停' : '自动播放';
      this.keyOnlyBtn.textContent = keyOnly ? '显示全部手' : '只看关键手';
      this.startBtn.disabled = index === 0;
      this.prevBtn.disabled = index === 0;
      this.nextBtn.disabled = index >= moves.length;
      this.endBtn.disabled = index >= moves.length;
      this.branchBtn.disabled = index >= moves.length;
      this.challengeBtn.disabled = index >= moves.length;
      this.timeline.min = '0';
      this.timeline.max = String(moves.length);
      this.timeline.value = String(index);

      const structureKey = this.makeStructureKey(moves, analysis, keyOnly);
      if (structureKey !== this.structureKey) {
        this.structureKey = structureKey;
        this.rebuildMoveList(moves, analysis, keyOnly);
        this.rebuildMarkers(moves, analysis);
      }

      const analysisKey = this.makeAnalysisKey(analysis);
      if (analysisKey !== this.analysisKey) {
        this.analysisKey = analysisKey;
        this.rebuildAnalysis(analysis);
      }

      this.updateActiveMove(index);
    }

    stats() {
      return { ...this.metrics };
    }
  }

  G.UI = G.UI || {};
  G.UI.ReviewView = ReviewView;
})(window.Gomoku = window.Gomoku || {});
