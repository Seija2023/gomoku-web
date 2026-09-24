(function (G) {
  class ShareAdapter {
    async copyText(text) {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          // Fall through to the DOM compatibility path.
        }
      }

      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        area.setAttribute('aria-hidden', 'true');
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return ok;
      } catch {
        return false;
      }
    }

    async share({ title, text, url }) {
      if (!navigator.share) return { handled: false, shared: false };
      try {
        await navigator.share({ title, text, url });
        return { handled: true, shared: true };
      } catch (error) {
        if (error?.name === 'AbortError') return { handled: true, shared: false };
        return { handled: false, shared: false };
      }
    }
  }

  G.Platform = G.Platform || {};
  G.Platform.ShareAdapter = ShareAdapter;
})(window.Gomoku = window.Gomoku || {});
