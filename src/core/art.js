export class ArtTracker {
  constructor(retryMs = 30000) {
    this.retryMs = retryMs;
    this._for = null;
    this._loading = null;
    this._failedFor = null;
    this._retryAt = 0;
    this._token = 0;
  }

  get for() {
    return this._for;
  }

  get loading() {
    return this._loading;
  }

  get failedFor() {
    return this._failedFor;
  }

  hasState() {
    return Boolean(this._for || this._loading || this._failedFor);
  }

  clear() {
    this._for = null;
    this._loading = null;
    this._failedFor = null;
    this._retryAt = 0;
    this._token++;
  }

  begin(url, now) {
    if (!url) {
      this.clear();
      return null;
    }

    if (url === this._for || url === this._loading)
      return null;

    if (url === this._failedFor && now < this._retryAt)
      return null;

    const previous = this._for;
    this._for = null;
    this._loading = url;
    return {token: ++this._token, previous};
  }

  finish(token, url, ok, now) {
    if (token !== this._token)
      return null;

    this._loading = null;
    if (!ok) {
      this._failedFor = url;
      this._retryAt = now + this.retryMs;
      return false;
    }

    this._failedFor = null;
    this._retryAt = 0;
    this._for = url;
    return true;
  }
}
