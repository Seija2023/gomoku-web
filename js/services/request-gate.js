(function (G) {
  class RequestGate {
    constructor() {
      this.versions = new Map();
    }

    next(channel) {
      const version = (this.versions.get(channel) || 0) + 1;
      this.versions.set(channel, version);
      return version;
    }

    invalidate(channel) {
      return this.next(channel);
    }

    isCurrent(channel, version) {
      return this.versions.get(channel) === version;
    }

    current(channel) {
      return this.versions.get(channel) || 0;
    }
  }

  G.Services = G.Services || {};
  G.Services.RequestGate = RequestGate;
})(window.Gomoku = window.Gomoku || {});
