import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const BUS_NAME = 'org.mpris.MediaPlayer2.spotify';
const OBJECT_PATH = '/org/mpris/MediaPlayer2';
const PLAYER = 'org.mpris.MediaPlayer2.Player';

export function parseTrackMetadata(metadata) {
  const read = name => metadata.lookup_value(name, null)?.deepUnpack() ?? null;
  const title = read('xesam:title');
  if (!title)
    return null;

  const artist = read('xesam:artist');
  return {
    id: read('mpris:trackid') ?? title,
    title,
    artist: Array.isArray(artist) ? artist.join(', ') : (artist ?? ''),
    album: read('xesam:album') ?? '',
    duration: Math.round((read('mpris:length') ?? 0) / 1e6),
    artUrl: read('mpris:artUrl') ?? '',
    url: read('xesam:url') ?? '',
  };
}

export class Spotify {
  constructor() {
    this._bus = Gio.DBus.session;
    this._proxy = null;
  }

  _proxyOrNull() {
    if (this._proxy)
      return this._proxy;

    const proxy = new Gio.DBusProxy({
      g_connection: this._bus,
      g_name: BUS_NAME,
      g_object_path: OBJECT_PATH,
      g_interface_name: PLAYER,
    });

    try {
      proxy.init(null);
      this._proxy = proxy;
    } catch {
      this._proxy = null;
    }

    return this._proxy;
  }

  status() {
    const proxy = this._proxyOrNull();
    if (!proxy)
      return null;

    try {
      return proxy.get_cached_property('PlaybackStatus')?.unpack() ?? null;
    } catch {
      this._proxy = null;
      return null;
    }
  }

  track() {
    const proxy = this._proxyOrNull();
    if (!proxy)
      return null;

    let metadata;
    try {
      metadata = proxy.get_cached_property('Metadata');
    } catch {
      this._proxy = null;
      return null;
    }
    if (!metadata)
      return null;

    return parseTrackMetadata(metadata);
  }

  // ponytail: sync Get once per second on the local bus, negligible cost.
  position() {
    const value = this._getProperty('Position');
    return value === null ? null : value / 1e6;
  }

  volume() {
    return this._getProperty('Volume');
  }

  loopStatus() {
    return this._getProperty('LoopStatus');
  }

  setLoopStatus(value) {
    if (!['None', 'Track', 'Playlist'].includes(value))
      return false;
    return this._setProperty('LoopStatus', new GLib.Variant('s', value));
  }

  setVolume(value) {
    return this._setProperty('Volume', new GLib.Variant('d', value));
  }

  pause() {
    return this._call('Pause');
  }

  play() {
    return this._call('Play');
  }

  next() {
    return this._call('Next');
  }

  previous() {
    return this._call('Previous');
  }

  setPosition(trackId, usec) {
    if (!trackId || !String(trackId).startsWith('/'))
      return false;
    return this._callArgs('SetPosition', new GLib.Variant('(ox)', [trackId, usec]));
  }

  _getProperty(name) {
    try {
      const reply = this._bus.call_sync(
        BUS_NAME, OBJECT_PATH,
        'org.freedesktop.DBus.Properties', 'Get',
        new GLib.Variant('(ss)', [PLAYER, name]),
        new GLib.VariantType('(v)'),
        Gio.DBusCallFlags.NONE, 400, null);

      return reply.get_child_value(0).get_variant().deepUnpack();
    } catch {
      return null;
    }
  }

  _setProperty(name, variant) {
    try {
      this._bus.call_sync(
        BUS_NAME, OBJECT_PATH,
        'org.freedesktop.DBus.Properties', 'Set',
        new GLib.Variant('(ssv)', [PLAYER, name, variant]),
        null, Gio.DBusCallFlags.NONE, 400, null);
      return true;
    } catch {
      return false;
    }
  }

  _call(method) {
    return this._callArgs(method, null);
  }

  _callArgs(method, params) {
    try {
      this._bus.call_sync(
        BUS_NAME, OBJECT_PATH, PLAYER, method,
        params, null, Gio.DBusCallFlags.NONE, 400, null);
      return true;
    } catch {
      this._proxy = null;
      return false;
    }
  }
}
