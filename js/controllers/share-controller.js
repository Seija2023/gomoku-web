(function (G) {
  class ShareController {
    constructor(insights) {
      this.insights = insights;
    }

    copyText(text) {
      if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
      }

      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        return Promise.resolve(ok);
      } catch {
        return Promise.resolve(false);
      }
    }

    async share(payload, label) {
      const url = `${location.href.split('#')[0]}${G.ShareCodec.makeHash(payload)}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: `五子棋 · ${label}`, text: label, url });
          this.insights.showShareNotice('已打开系统分享面板。');
          return true;
        } catch (error) {
          if (error?.name === 'AbortError') return false;
        }
      }

      const copied = await this.copyText(url);
      this.insights.showShareNotice(copied ? '分享链接已复制。' : `分享链接：${url}`);
      return copied;
    }
  }

  G.Controllers = G.Controllers || {};
  G.Controllers.ShareController = ShareController;
})(window.Gomoku = window.Gomoku || {});
