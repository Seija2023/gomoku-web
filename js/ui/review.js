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
      this.moveList = doc.getElementById('moveList');
      this.analysis = doc.getElementById('analysisContent');
    }
    bind(handlers) {
      this.startBtn.addEventListener('click', () => handlers.seek(0));
      this.prevBtn.addEventListener('click', () => handlers.seekRelative(-1));
      this.playBtn.addEventListener('click', handlers.togglePlay);
      this.nextBtn.addEventListener('click', () => handlers.seekRelative(1));
      this.endBtn.addEventListener('click', handlers.seekEnd);
      this.exitBtn.addEventListener('click', handlers.exit);
    }
    show() { this.card.classList.remove('hidden'); }
    hide() { this.card.classList.add('hidden'); }
    render(moves, index, playing, analysis, onSeek) {
      this.position.textContent = `第 ${index} / ${moves.length} 手`;
      this.playBtn.textContent = playing ? '暂停' : '自动播放';
      this.startBtn.disabled = index === 0;
      this.prevBtn.disabled = index === 0;
      this.nextBtn.disabled = index >= moves.length;
      this.endBtn.disabled = index >= moves.length;
      this.moveList.innerHTML = '';
      moves.forEach((move, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `move-item${i + 1 === index ? ' active' : ''}`;
        btn.textContent = moveLabel(move, i);
        btn.addEventListener('click', () => onSeek(i + 1));
        this.moveList.appendChild(btn);
      });
      const active = this.moveList.querySelector('.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
      this.analysis.innerHTML = '';
      const summary = document.createElement('p');
      summary.innerHTML = `<strong>${analysis.winnerText}</strong> · 共 ${analysis.totalMoves} 手${analysis.winner ? ` · ${analysis.direction}` : ''}`;
      this.analysis.appendChild(summary);
      const list = document.createElement('ul');
      if (analysis.moments.length) {
        analysis.moments.forEach(item => {
          const li = document.createElement('li');
          li.textContent = `第${item.index + 1}手 ${item.player === BLACK ? '黑' : '白'} ${item.coordinate}：${item.label}`;
          list.appendChild(li);
        });
      } else {
        const li = document.createElement('li');
        li.textContent = '未检测到明显的四连或五连节点。';
        list.appendChild(li);
      }
      this.analysis.appendChild(list);
      const note = document.createElement('p');
      note.className = 'analysis-note';
      note.textContent = '分析基于棋形规则与启发式判断，不代表专业求解器的唯一最佳手。';
      this.analysis.appendChild(note);
    }
  }
  G.UI = G.UI || {};
  G.UI.ReviewView = ReviewView;
})(window.Gomoku = window.Gomoku || {});
