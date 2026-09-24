(function (G) {
  const SCHEMA_KEY = 'gomoku-schema-version';
  const CURRENT_SCHEMA = 3;

  function safeRead(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function safeWrite(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  function currentVersion() {
    const value = Number(safeRead(SCHEMA_KEY));
    return Number.isFinite(value) ? value : 0;
  }

  function migrateTo3() {
    const currentSettings = safeRead('gomoku-settings-v23');
    if (!currentSettings) {
      const legacy = safeRead('gomoku-settings-v22');
      if (legacy) safeWrite('gomoku-settings-v23', legacy);
    }
  }

  function migrate() {
    let version = currentVersion();
    if (version < 3) {
      migrateTo3();
      version = 3;
    }
    safeWrite(SCHEMA_KEY, Math.max(version, CURRENT_SCHEMA));
    return CURRENT_SCHEMA;
  }

  G.StorageMigrations = Object.freeze({
    SCHEMA_KEY,
    CURRENT_SCHEMA,
    currentVersion,
    migrate,
  });
})(window.Gomoku = window.Gomoku || {});
