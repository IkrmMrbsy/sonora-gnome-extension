import GLib from 'gi://GLib';

const DUCK_RATIO = 0.3;

export class VolumeController {
  constructor(spotify) {
    this._spotify = spotify;
    this._base = null;
    this._ducked = false;
    this._rampId = 0;
  }

  _stopRamp() {
    if (!this._rampId)
      return;

    GLib.source_remove(this._rampId);
    this._rampId = 0;
  }

  _fadeTo(target, ms) {
    this._stopRamp();

    const from = this._spotify.volume();
    if (from === null)
      return Promise.resolve();

    const steps = Math.max(1, Math.round(ms / 100));
    return new Promise(resolve => {
      let step = 0;
      this._rampId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
        step++;
        const ratio = Math.min(1, step / steps);
        this._spotify.setVolume(from + (target - from) * ratio);

        if (step >= steps) {
          this._rampId = 0;
          resolve();
          return GLib.SOURCE_REMOVE;
        }
        return GLib.SOURCE_CONTINUE;
      });
    });
  }

  duck() {
    if (this._ducked)
      return;

    const current = this._spotify.volume();
    if (current === null || current < 0.02)
      return;

    this._base = current;
    this._ducked = true;
    this._fadeTo(current * DUCK_RATIO, 400);
  }

  unduck() {
    if (!this._ducked)
      return;

    this._ducked = false;
    const base = this._base ?? this._spotify.volume() ?? 1;
    this._base = null;
    this._fadeTo(base, 600);
  }

  async fadeOutAndPause() {
    const original = this._spotify.volume() ?? 1;
    await this._fadeTo(0, 5000);
    this._spotify.pause();
    this._spotify.setVolume(original);
    this._ducked = false;
    this._base = null;
  }

  destroy() {
    this._stopRamp();
  }
}
