(function (G) {
  const SCHEMA_KEY = 'gomoku-schema-version';
  const SETTINGS_KEY = 'gomoku-settings-v23';
  const LEGACY_SOUND_KEY = 'gomoku-sound';
  const CURRENT_SCHEMA = 5;

  function safeRead(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function safeReadText(key) {
    try {
      return localStorage.getItem(key);
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

  function safeRemove(key) {
    try {
      localStorage.removeItem(key);
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
    const currentSettings = safeRead(SETTINGS_KEY);
    if (!currentSettings) {
      const legacy = safeRead('gomoku-settings-v22');
      if (legacy) safeWrite(SETTINGS_KEY, legacy);
    }
  }

  function migrateTo5() {
    const settings = safeRead(SETTINGS_KEY) || {};
    const legacySound = safeReadText(LEGACY_SOUND_KEY);
    if (settings.sound === undefined && (legacySound === 'on' || legacySound === 'off')) {
      settings.sound = legacySound !== 'off';
      safeWrite(SETTINGS_KEY, settings);
    }
    safeRemove(LEGACY_SOUND_KEY);
  }

  function migrate() {
    let version = currentVersion();
    if (version < 3) {
      migrateTo3();
      version = 3;
    }
    if (version < 4) version = 4;
    if (version < 5) {
      migrateTo5();
      version = 5;
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
