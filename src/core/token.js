export class RequestToken {
  constructor() {
    this._value = 0;
  }

  next() {
    return ++this._value;
  }

  invalidate() {
    this._value++;
  }

  isCurrent(token) {
    return token === this._value;
  }
}
