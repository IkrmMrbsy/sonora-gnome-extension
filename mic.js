export class MicMonitor {
  constructor(onChange) {
    this._onChange = onChange;
    this._control = null;
    this._active = false;
  }

  async start() {
    let Gvc;
    try {
      ({default: Gvc} = await import('gi://Gvc'));
    } catch {
      console.debug('spotify-ext: mic monitor unavailable (Gvc import failed)');
      return false;
    }

    try {
      const control = new Gvc.MixerControl({name: 'Spotify Lyrics'});
      control.open();

      const update = () => this._set(control.get_source_outputs().length > 0);
      control.connect('state-changed', update);
      control.connect('stream-added', update);
      control.connect('stream-removed', update);

      this._control = control;
      update();
      console.debug('spotify-ext: mic monitor active');
      return true;
    } catch (error) {
      console.debug(`spotify-ext: mic monitor unavailable (${error})`);
      return false;
    }
  }

  _set(active) {
    if (active === this._active)
      return;

    this._active = active;
    this._onChange(active);
  }

  destroy() {
    try {
      this._control?.close();
    } catch {
      // Gvc teardown is best-effort.
    }
    this._control = null;
  }
}
