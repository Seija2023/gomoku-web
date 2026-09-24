(function (G) {
  const CURRENT_KEY = 'gomoku-current-v2';
  const HISTORY_KEY = 'gomoku-history-v2';
  const MAX_HISTORY = 20;
  function read(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
  function clearCurrent() {
    try { localStorage.removeItem(CURRENT_KEY); return true; }
    catch { return false; }
  }
  function saveCurrent(snapshot) {
    if (!snapshot || snapshot.gameOver || !snapshot.moves?.length) return clearCurrent();
    return write(CURRENT_KEY, snapshot);
  }
  function loadCurrent() { return read(CURRENT_KEY, null); }
  function listHistory() {
    const list = read(HISTORY_KEY, []);
    return Array.isArray(list) ? list : [];
  }
  function saveFinished(record) {
    const list = listHistory().filter(item => item.id !== record.id);
    list.unshift(record);
    return write(HISTORY_KEY, list.slice(0, MAX_HISTORY));
  }
  function removeHistory(id) {
    return write(HISTORY_KEY, listHistory().filter(item => item.id !== id));
  }
  G.Storage = Object.freeze({ CURRENT_KEY, HISTORY_KEY, saveCurrent, loadCurrent, clearCurrent, listHistory, saveFinished, removeHistory });
})(window.Gomoku = window.Gomoku || {});
