import GLib from 'gi://GLib';

const FADE_STEP_MS = 100;

export class VolumeController {
  constructor(spotify) {
    this._spotify = spotify;
    this._base = null;
    this._ducked = false;
    this._rampId = 0;
    this._pausedForMic = false;
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

    const steps = Math.max(1, Math.round(ms / FADE_STEP_MS));
    return new Promise(resolve => {
      let step = 0;
      this._rampId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, FADE_STEP_MS, () => {
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

  // levelPercent is the volume kept while ducking, e.g. 30 -> 30% of current.
  duck(levelPercent = 30) {
    if (this._ducked)
      return;

    const current = this._spotify.volume();
    if (current === null || current < 0.02)
      return;

    const ratio = Math.max(0.05, Math.min(0.95, levelPercent / 100));
    this._base = current;
    this._ducked = true;
    this._fadeTo(current * ratio, 400);
  }

  unduck() {
    if (!this._ducked)
      return;

    this._ducked = false;
    const base = this._base ?? this._spotify.volume() ?? 1;
    this._base = null;
    this._fadeTo(base, 600);
  }

  // Pause-mode mic handling. Only resumes what we were responsible for pausing.
  pauseForMic() {
    if (this._pausedForMic)
      return;

    if (this._spotify.status() !== 'Playing')
      return;

    this._pausedForMic = true;
    this._spotify.pause();
  }

  resumeFromMic() {
    if (!this._pausedForMic)
      return;

    this._pausedForMic = false;
    this._spotify.play();
  }

  isPausedForMic() {
    return this._pausedForMic;
  }

  async fadeOutAndPause() {
    const original = this._spotify.volume() ?? 1;
    await this._fadeTo(0, 5000);
    this._spotify.pause();
    this._spotify.setVolume(original);
    this._ducked = false;
    this._base = null;
    this._pausedForMic = false;
  }

  destroy() {
    this._stopRamp();
  }
}
