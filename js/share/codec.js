(function (G) {
  function toBase64Url(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function fromBase64Url(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function compactMove(move) {
    return [move.r, move.c, move.player];
  }

  function expandMove(tuple) {
    return { r: tuple[0], c: tuple[1], player: tuple[2] };
  }

  function encode(payload) {
    const compact = {
      v: 1,
      k: payload.kind || 'game',
      m: (payload.moves || []).map(compactMove),
      i: Number.isInteger(payload.index) ? payload.index : undefined,
      w: payload.winner || 0,
      mode: payload.mode || G.Config.MODES.PVP,
    };
    return toBase64Url(JSON.stringify(compact));
  }

  function decode(value) {
    try {
      const parsed = JSON.parse(fromBase64Url(value));
      if (parsed?.v !== 1 || !Array.isArray(parsed.m)) return null;
      const moves = parsed.m.map(expandMove);
      for (const move of moves) {
        if (!Number.isInteger(move.r) || !Number.isInteger(move.c) || ![G.Config.BLACK, G.Config.WHITE].includes(move.player)) return null;
        if (move.r < 0 || move.c < 0 || move.r >= G.Config.SIZE || move.c >= G.Config.SIZE) return null;
      }
      return {
        kind: parsed.k === 'challenge' ? 'challenge' : 'game',
        moves,
        index: Number.isInteger(parsed.i) ? parsed.i : moves.length,
        winner: parsed.w || 0,
        mode: parsed.mode === G.Config.MODES.AI ? G.Config.MODES.AI : G.Config.MODES.PVP,
      };
    } catch {
      return null;
    }
  }

  function parseHash(hash = location.hash) {
    const match = String(hash || '').match(/^#(g|challenge)=([A-Za-z0-9_-]+)$/);
    if (!match) return null;
    const payload = decode(match[2]);
    if (!payload) return null;
    payload.kind = match[1] === 'challenge' ? 'challenge' : payload.kind;
    return payload;
  }

  function makeHash(payload) {
    return `#${payload.kind === 'challenge' ? 'challenge' : 'g'}=${encode(payload)}`;
  }

  G.ShareCodec = Object.freeze({ encode, decode, parseHash, makeHash });
})(window.Gomoku = window.Gomoku || {});
