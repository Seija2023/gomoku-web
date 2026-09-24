(function (G) {
  class ShareController {
    constructor({ insights, adapter }) {
      this.insights = insights;
      this.adapter = adapter;
    }

    async share(payload, label) {
      const url = `${location.href.split('#')[0]}${G.ShareCodec.makeHash(payload)}`;
      const native = await this.adapter.share({
        title: `五子棋 · ${label}`,
        text: label,
        url,
      });

      if (native.handled) {
        if (native.shared) this.insights.showShareNotice('已打开系统分享面板。');
        return native.shared;
      }

      const copied = await this.adapter.copyText(url);
      this.insights.showShareNotice(copied ? '分享链接已复制。' : `分享链接：${url}`);
      return copied;
    }
  }

  G.Controllers = G.Controllers || {};
  G.Controllers.ShareController = ShareController;
})(window.Gomoku = window.Gomoku || {});
