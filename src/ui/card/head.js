import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {setArtImage} from '../../util/art.js';
import {ellipsize, iconButton} from '../widgets.js';

const REPEAT_ORDER = ['None', 'Playlist', 'Track'];
const REPEAT_ICON = {
  None: 'media-playlist-repeat-symbolic',
  Playlist: 'media-playlist-repeat-symbolic',
  Track: 'media-playlist-repeat-song-symbolic',
};

function repeatLabel(mode) {
  switch (mode) {
  case 'Playlist':
    return _('Repeat all');
  case 'Track':
    return _('Repeat one');
  default:
    return _('Repeat off');
  }
}

export const COVER_SIZE = 64;

// Cover, title and playback controls, including the repeat toggle.
export class CardHead {
  constructor(callbacks = {}) {
    this._callbacks = callbacks;
    this._mode = 'None';

    this.actor = new St.BoxLayout({style_class: 'sonora-head'});

    this._art = new St.Widget({
      style_class: 'sonora-art',
      width: COVER_SIZE,
      height: COVER_SIZE,
      reactive: true,
      accessible_name: _('Album art, double-click to open in Spotify'),
    });
    this._art.connect('button-release-event', (actor, event) => {
      if (event.get_button() === 1 && event.get_click_count() >= 2) {
        this._callbacks.onOpenSpotify?.();
        return Clutter.EVENT_STOP;
      }
      return Clutter.EVENT_PROPAGATE;
    });

    const info = new St.BoxLayout({
      orientation: Clutter.Orientation.VERTICAL,
      x_expand: true,
      style_class: 'sonora-info',
    });
    this._title = new St.Label({text: _('Nothing playing'), style_class: 'sonora-song'});
    this._artist = new St.Label({text: '', style_class: 'sonora-artist'});
    ellipsize(this._title);
    ellipsize(this._artist);
    info.add_child(this._title);
    info.add_child(this._artist);

    const controls = new St.BoxLayout({
      style_class: 'sonora-controls',
      y_align: Clutter.ActorAlign.CENTER,
    });

    this._prev = iconButton('sonora-btn', 'media-skip-backward-symbolic',
      () => this._callbacks.onPrev?.(), 15, _('Previous track'));

    this._play = new St.Button({
      style_class: 'sonora-play',
      child: new St.Icon({icon_name: 'media-playback-start-symbolic', icon_size: 16}),
      accessible_name: _('Play'),
    });
    this._playIcon = this._play.get_child();
    this._play.connect('clicked', () => this._callbacks.onTogglePlay?.());

    this._next = iconButton('sonora-btn', 'media-skip-forward-symbolic',
      () => this._callbacks.onNext?.(), 15, _('Next track'));

    this._repeat = new St.Button({
      style_class: 'sonora-repeat',
      child: new St.Icon({
        icon_name: REPEAT_ICON.None,
        icon_size: 15,
        style_class: 'sonora-repeat-icon',
      }),
      accessible_name: _('Repeat off'),
    });
    this._repeatIcon = this._repeat.get_child();
    this._repeat.connect('clicked', () => this._cycleRepeat());

    controls.add_child(this._prev);
    controls.add_child(this._play);
    controls.add_child(this._next);
    controls.add_child(this._repeat);

    this.actor.add_child(this._art);
    this.actor.add_child(info);
    this.actor.add_child(controls);
  }

  setTrack(track) {
    if (!track) {
      this._title.text = _('Nothing playing');
      this._artist.text = '';
      return;
    }

    this._title.text = track.title || _('Unknown');
    this._artist.text = [track.artist, track.album].filter(Boolean).join(' · ');
  }

  setPlaying(playing) {
    this._playIcon.icon_name = playing
      ? 'media-playback-pause-symbolic'
      : 'media-playback-start-symbolic';
    this._play.accessible_name = playing ? _('Pause') : _('Play');
    this._art.set_opacity(playing ? 255 : 150);
  }

  setArt(pixbuf) {
    if (!pixbuf) {
      this._art.set_content(null);
      return;
    }

    this._art.set_style('');
    setArtImage(this._art, pixbuf, COVER_SIZE, 14);
  }

  setPlaceholder(alphaStyle) {
    this._art.set_style(alphaStyle);
  }

  get mode() {
    return this._mode;
  }

  setRepeat(mode) {
    if (!REPEAT_ORDER.includes(mode))
      return;

    this._mode = mode;
    this._repeatIcon.icon_name = REPEAT_ICON[mode];
    this._repeat.remove_style_class_name('on');
    if (mode !== 'None')
      this._repeat.add_style_class_name('on');

    this._repeat.accessible_name = repeatLabel(mode);
  }

  _cycleRepeat() {
    const next = REPEAT_ORDER[(REPEAT_ORDER.indexOf(this._mode) + 1) % REPEAT_ORDER.length];
    this.setRepeat(next);
    this._callbacks.onRepeat?.(next);
  }
}
