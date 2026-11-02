const SEEK_TOLERANCE = 2;

export function playThreshold(duration) {
  const value = Number(duration);
  return value > 0 ? Math.min(30, value * 0.5) : 30;
}

// Tracks a play by song position instead of accumulated wall time. A play is
// counted once the position passes min(30s, half the duration); moving back
// below that threshold re-arms the counter for the next pass.
export class PlaybackTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this._id = null;
    this._lastPosition = null;
    this._lastSeenAt = null;
    this._counted = false;
  }

  pause(position, now) {
    if (Number.isFinite(position))
      this._lastPosition = Math.max(0, position);
    this._lastSeenAt = Number.isFinite(now) ? now : null;
  }

  update(track, position, now, playing = true) {
    if (!track) {
      this.reset();
      return {seconds: 0, counted: false};
    }

    const id = `${track.id ?? ''}|${track.title ?? ''}`;
    const threshold = playThreshold(track.duration);
    if (id !== this._id) {
      this._id = id;
      this._lastPosition = null;
      this._lastSeenAt = null;
      this._counted = false;
    }

    if (!playing) {
      this.pause(position, now);
      return {seconds: 0, counted: false};
    }

    const pos = Number.isFinite(position) ? Math.max(0, position) : null;
    let seconds = 0;
    let seeked = false;

    if (this._lastSeenAt !== null) {
      const elapsed = Math.max(0, now - this._lastSeenAt);
      if (pos === null || this._lastPosition === null) {
        seconds = elapsed;
      } else {
        const delta = pos - this._lastPosition;
        if (delta >= 0 && delta <= elapsed + SEEK_TOLERANCE) {
          seconds = delta;
        } else if (delta < 0) {
          // Seek back or replay: count the playback since the last sample and
          // re-arm only when the new position is before the threshold.
          seconds = elapsed;
          seeked = true;
          this._counted = pos >= threshold;
        } else {
          // Forward seek: don't count the skipped part as listening time.
          seconds = elapsed;
          seeked = true;
        }
      }
    }

    this._lastPosition = pos;
    this._lastSeenAt = now;

    let counted = false;
    if (!this._counted && pos !== null && pos >= threshold) {
      this._counted = true;
      counted = !seeked;
    }

    return {seconds, counted};
  }
}
