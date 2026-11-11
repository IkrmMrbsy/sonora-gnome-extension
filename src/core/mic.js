export class MicMonitor {
  constructor(onChange) {
    this._onChange = onChange;
    this._control = null;
    this._active = false;
    this._destroyed = false;
    this._signalIds = [];
  }

  async start() {
    let Gvc;
    try {
      ({default: Gvc} = await import('gi://Gvc'));
    } catch {
      console.debug('spotify-ext: mic monitor unavailable (Gvc import failed)');
      return false;
    }

    if (this._destroyed)
      return false;

    let control = null;
    try {
      control = new Gvc.MixerControl({name: 'Spotify Lyrics'});
      control.open();

      const update = () => this._set(control.get_source_outputs().length > 0);
      this._signalIds = [
        control.connect('state-changed', update),
        control.connect('stream-added', update),
        control.connect('stream-removed', update),
      ];

      this._control = control;
      update();
      console.debug('spotify-ext: mic monitor active');
      return true;
    } catch (error) {
      this._signalIds = [];
      this._control = null;
      try {
        control?.close();
      } catch {
        // Gvc teardown is best-effort.
      }
      console.debug(`spotify-ext: mic monitor unavailable (${error})`);
      return false;
    }
  }

  _set(active) {
    if (this._destroyed || active === this._active)
      return;

    this._active = active;
    this._onChange?.(active);
  }

  destroy() {
    this._destroyed = true;

    for (const id of this._signalIds)
      this._control?.disconnect(id);
    this._signalIds = [];

    try {
      this._control?.close();
    } catch {
      // Gvc teardown is best-effort.
    }
    this._control = null;
    this._onChange = null;
  }
}
