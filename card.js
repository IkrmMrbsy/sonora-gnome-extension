import Cairo from 'gi://cairo';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {extensionDir} from './path.js';

import {setArtImage} from './art.js';

export const CARD_WIDTH = 360;
const PADDING = 16;
const GAP = 6;
const ARROW = 12;
const HOVER_CLOSE_MS = 320;

export function formatClock(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function formatWeek(seconds) {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60)
    return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function ellipsize(label) {
  label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
  label.clutter_text.line_wrap = false;
}

function iconButton(iconName, callback) {
  const button = new St.Button({
    style_class: 'cadence-btn',
    child: new St.Icon({icon_name: iconName, icon_size: 15}),
  });
  button.connect('clicked', () => callback());
  return button;
}

export class NowPlayingCard {
  constructor(callbacks = {}) {
    this._callbacks = callbacks;
    this._accent = [53, 132, 228];
    this._pixbuf = null;
    this._duration = 0;
    this._position = 0;
    this._stats = null;
    this._lyricsVisible = true;
    this._seeking = false;
    this._open = false;
    this._anchor = null;
    this._positionMode = 'right';
    this._eventId = 0;

    this._build();
    Main.layoutManager.addChrome(this._actor, {trackFullscreen: true});
    this._actor.visible = false;
    this._relayout();
    this._updateFooter();

    this._overviewId = Main.overview.connect('showing', () => this.close(false));
  }

  _build() {
    this._actor = new St.Widget({
      style_class: 'cadence-card',
      layout_manager: new Clutter.FixedLayout(),
      width: CARD_WIDTH,
      height: 220,
      reactive: true,
      clip_to_allocation: false,
    });

    this._tint = new St.DrawingArea();
    this._tint.connect('repaint', area => this._drawTint(area));
    this._actor.add_child(this._tint);

    this._arrow = new St.DrawingArea();
    this._arrow.set_size(ARROW, GAP);
    this._arrow.connect('repaint', area => this._drawArrow(area));
    this._actor.add_child(this._arrow);

    this._box = new St.BoxLayout({vertical: true, style_class: 'cadence-card-box'});
    this._actor.add_child(this._box);

    this._head = new St.BoxLayout({style_class: 'cadence-head'});
    this._popArt = new St.Widget({
      style_class: 'cadence-art',
      width: 64,
      height: 64,
      reactive: true,
    });
    this._popArt.connect('button-release-event', (actor, event) => {
      if (event.get_button() === 1 && event.get_click_count() >= 2) {
        this._callbacks.onOpenSpotify?.();
        return Clutter.EVENT_STOP;
      }
      return Clutter.EVENT_PROPAGATE;
    });

    this._info = new St.BoxLayout({
      vertical: true,
      x_expand: true,
      style_class: 'cadence-info',
    });
    this._popTitle = new St.Label({text: 'Nothing playing', style_class: 'cadence-song'});
    this._popArtist = new St.Label({text: '', style_class: 'cadence-artist'});
    ellipsize(this._popTitle);
    ellipsize(this._popArtist);
    this._info.add_child(this._popTitle);
    this._info.add_child(this._popArtist);

    this._controls = new St.BoxLayout({
      style_class: 'cadence-controls',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._prev = iconButton('media-skip-backward-symbolic', () => this._callbacks.onPrev?.());
    this._play = new St.Button({
      style_class: 'cadence-play',
      child: new St.Icon({icon_name: 'media-playback-start-symbolic', icon_size: 16}),
    });
    this._playIcon = this._play.get_child();
    this._play.connect('clicked', () => this._callbacks.onTogglePlay?.());
    this._next = iconButton('media-skip-forward-symbolic', () => this._callbacks.onNext?.());
    this._controls.add_child(this._prev);
    this._controls.add_child(this._play);
    this._controls.add_child(this._next);

    this._head.add_child(this._popArt);
    this._head.add_child(this._info);
    this._head.add_child(this._controls);
    this._box.add_child(this._head);

    this._lyricsBox = new St.BoxLayout({vertical: true, style_class: 'cadence-lyrics'});
    this._lyric = new St.Label({text: '', style_class: 'cadence-lyric'});
    this._nextLyric = new St.Label({text: '', style_class: 'cadence-next'});
    ellipsize(this._lyric);
    ellipsize(this._nextLyric);
    this._lyricsBox.add_child(this._lyric);
    this._lyricsBox.add_child(this._nextLyric);
    this._box.add_child(this._lyricsBox);

    // FixedLayout, not BinLayout: BinLayout ignores x_align and centres the
    // fill, so the bar grew from the middle outwards.
    this._progress = new St.Widget({
      style_class: 'cadence-progress',
      reactive: true,
      track_hover: true,
      layout_manager: new Clutter.FixedLayout(),
      height: 3,
      x_expand: true,
    });
    this._fill = new St.Widget({
      style_class: 'cadence-fill',
      height: 3,
      width: 0,
    });
    this._progress.add_child(this._fill);
    this._fill.set_position(0, 0);
    this._progress.connect('button-press-event', (actor, event) => {
      if (event.get_button() !== 1)
        return Clutter.EVENT_PROPAGATE;
      this._seeking = true;
      this._seekFromEvent(event);
      return Clutter.EVENT_STOP;
    });
    this._progress.connect('motion-event', (actor, event) => {
      if (!this._seeking)
        return Clutter.EVENT_PROPAGATE;
      this._seekFromEvent(event);
      return Clutter.EVENT_STOP;
    });
    this._progress.connect('button-release-event', () => {
      this._seeking = false;
      return Clutter.EVENT_STOP;
    });
    this._box.add_child(this._progress);

    this._foot = new St.BoxLayout({style_class: 'cadence-foot'});
    this._footIcon = new St.Icon({
      icon_name: 'audio-x-generic-symbolic',
      icon_size: 14,
      style_class: 'cadence-foot-icon',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._footLabel = new St.Label({
      text: 'This week 0m',
      style_class: 'cadence-foot-label',
      x_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
    });
    ellipsize(this._footLabel);

    this._footStats = new St.BoxLayout({
      style_class: 'cadence-foot-stats',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._streakBox = new St.BoxLayout({
      style_class: 'cadence-streak',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._flame = new St.Icon({
      gicon: Gio.icon_new_for_string(
        `${extensionDir()}/icons/cadence-flame-symbolic.svg`),
      icon_size: 14,
      style_class: 'cadence-flame',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._streakLabel = new St.Label({
      text: '0d',
      style_class: 'cadence-streak-label',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._streakBox.add_child(this._flame);
    this._streakBox.add_child(this._streakLabel);

    this._bestLabel = new St.Label({
      text: '',
      style_class: 'cadence-best-label',
      y_align: Clutter.ActorAlign.CENTER,
    });

    this._footStats.add_child(this._streakBox);
    this._footStats.add_child(this._bestLabel);

    this._foot.add_child(this._footIcon);
    this._foot.add_child(this._footLabel);
    this._foot.add_child(this._footStats);
    this._box.add_child(this._foot);

    this._actor.connect('enter-event', () => {
      this._cancelClose();
      this._callbacks.onEnter?.();
      return Clutter.EVENT_PROPAGATE;
    });
    this._actor.connect('leave-event', () => {
      this._callbacks.onLeave?.();
      return Clutter.EVENT_PROPAGATE;
    });

  }

  _relayout() {
    const inner = CARD_WIDTH - PADDING * 2;
    this._box.set_width(inner);
    const [, natural] = this._box.get_preferred_height(inner);
    const height = Math.max(1, natural);

    this._actor.set_size(CARD_WIDTH, height + PADDING * 2);
    this._tint.set_position(0, 0);
    this._tint.set_size(CARD_WIDTH, height + PADDING * 2);
    this._box.set_position(PADDING, PADDING);
    this._box.set_size(inner, height);

    this._renderProgress();
    if (this._open)
      this._place();
  }

  _place() {
    if (!this._anchor)
      return;

    const [ax] = this._anchor.get_transformed_position();
    const [aw] = this._anchor.get_size();
    const monitor = Main.layoutManager.findMonitorForActor(this._anchor) ??
      Main.layoutManager.primaryMonitor;

    let x;
    if (this._positionMode === 'left')
      x = ax;
    else if (this._positionMode === 'center')
      x = ax + aw / 2 - CARD_WIDTH / 2;
    else
      x = ax + aw - CARD_WIDTH;

    const minX = monitor.x + 12;
    const maxX = monitor.x + monitor.width - CARD_WIDTH - 12;
    x = Math.round(Math.max(minX, Math.min(x, maxX)));

    const y = Math.round(monitor.y + Main.panel.height + GAP);
    this._actor.set_position(x, y);

    const arrowX = Math.max(20, Math.min(CARD_WIDTH - 20, ax + aw / 2 - x));
    this._arrow.set_position(Math.round(arrowX - ARROW / 2), -GAP);
  }

  open(anchor, positionMode) {
    this._anchor = anchor;
    this._positionMode = positionMode ?? 'right';

    this._relayout();
    this._place();

    this._open = true;
    this._actor.visible = true;
    this._actor.set_pivot_point(0.5, 0);
    this._actor.set_opacity(0);
    this._actor.set_scale(0.985, 0.985);
    this._actor.translation_y = -6;
    this._actor.ease({
      opacity: 255,
      scale_x: 1,
      scale_y: 1,
      translation_y: 0,
      duration: 180,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
    });

    this._grabEvents();
  }

  close(animate = true) {
    this._cancelClose();
    if (!this._open)
      return;

    this._open = false;
    this._releaseEvents();

    const hide = () => {
      this._actor.visible = false;
      this._actor.translation_y = 0;
    };

    if (!animate) {
      hide();
      return;
    }

    this._actor.ease({
      opacity: 0,
      scale_x: 0.985,
      scale_y: 0.985,
      translation_y: -6,
      duration: 120,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
      onComplete: hide,
    });
  }

  isOpen() {
    return this._open;
  }

  scheduleClose() {
    this._cancelClose();
    this._closeTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, HOVER_CLOSE_MS, () => {
      this._closeTimer = 0;
      this.close();
      return GLib.SOURCE_REMOVE;
    });
  }

  _cancelClose() {
    if (this._closeTimer)
      GLib.source_remove(this._closeTimer);
    this._closeTimer = 0;
  }

  // ponytail: no fullscreen blocker; one captured-event handler covers
  // Esc and click-outside, so panel hover keeps working while open.
  _grabEvents() {
    this._releaseEvents();
    this._eventId = global.stage.connect('captured-event', (actor, event) => {
      if (event.type() === Clutter.EventType.KEY_PRESS) {
        if (event.get_key_symbol() === Clutter.KEY_Escape) {
          this.close();
          return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
      }

      if (event.type() !== Clutter.EventType.BUTTON_PRESS)
        return Clutter.EVENT_PROPAGATE;

      const [x, y] = event.get_coords();
      if (this._inside(x, y, this._actor, -GAP) || this._inside(x, y, this._anchor, 0))
        return Clutter.EVENT_PROPAGATE;

      this.close();
      return Clutter.EVENT_PROPAGATE;
    });
  }

  _inside(x, y, actor, padY) {
    if (!actor)
      return false;

    const [ax, ay] = actor.get_transformed_position();
    const [aw, ah] = actor.get_size();
    return x >= ax && x < ax + aw && y >= ay + padY && y < ay + ah;
  }

  _releaseEvents() {
    if (this._eventId) {
      global.stage.disconnect(this._eventId);
      this._eventId = 0;
    }
  }

  _drawTint(area) {
    const cr = area.get_context();
    const width = area.width;
    const height = area.height;
    if (!width || !height)
      return;

    const [surfaceWidth] = area.get_surface_size();
    const scale = surfaceWidth && width ? surfaceWidth / width : 1;
    const [r, g, b] = this._accent;

    const cx = width * 0.11 * scale;
    const cy = height * 0.17 * scale;
    const radius = Math.max(width, height) * 0.62 * scale;

    const gradient = new Cairo.RadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStopRGBA(0, r / 255, g / 255, b / 255, 0.50);
    gradient.addColorStopRGBA(0.55, r / 255, g / 255, b / 255, 0.16);
    gradient.addColorStopRGBA(1, r / 255, g / 255, b / 255, 0);
    cr.setSource(gradient);
    cr.paint();
  }

  _drawArrow(area) {
    const cr = area.get_context();
    const [surfaceWidth, surfaceHeight] = area.get_surface_size();
    const scale = surfaceWidth && surfaceHeight ? surfaceWidth / ARROW : 1;
    const w = ARROW * scale;
    const h = GAP * scale;
    const [r, g, b] = this._accent;

    cr.moveTo(0, h);
    cr.lineTo(w / 2, 0);
    cr.lineTo(w, h);
    cr.closePath();
    cr.setSourceRGBA(13 / 255, 13 / 255, 18 / 255, 0.94);
    cr.fillPreserve();
    cr.setSourceRGBA(r / 255, g / 255, b / 255, 0.42);
    cr.setLineWidth(1 * scale);
    cr.stroke();
  }

  setArt(pixbuf) {
    this._pixbuf = pixbuf;
    if (!pixbuf) {
      this._popArt.set_content(null);
      this._applyAccent();
      return;
    }

    this._popArt.set_style('');
    setArtImage(this._popArt, pixbuf, 64, 14);
  }

  setAccent(rgb) {
    this._accent = rgb;
    this._applyAccent();
  }

  _applyAccent() {
    const [r, g, b] = this._accent;
    const rgba = alpha => `rgba(${r},${g},${b},${alpha})`;

    // St accepts a single box-shadow per node; a second one only warns.
    this._actor.set_style(
      `border: 1px solid ${rgba(0.40)}; box-shadow: 0 12px 34px ${rgba(0.42)};`);
    // Halo, karena St tidak bisa menebalkan garis glyph ikon.
    this._footIcon.set_style(
      `color: rgb(${r},${g},${b}); icon-shadow: 0 0 2px ${rgba(0.75)};`);
    // icon-shadow accepts exactly one shadow, unlike box-shadow.
    this._flame.set_style('icon-shadow: 0 0 3px rgba(255,120,20,0.85);');

    if (!this._pixbuf)
      this._popArt.set_style(`background-color: ${rgba(0.28)};`);

    this._tint.queue_repaint();
    this._arrow.queue_repaint();
  }

  setTrack(track) {
    if (!track) {
      this._popTitle.text = 'Nothing playing';
      this._popArtist.text = '';
      this._position = 0;
      this._duration = 0;
      this._renderProgress();
    } else {
      this._popTitle.text = track.title || 'Unknown';
      this._popArtist.text = [track.artist, track.album].filter(Boolean).join(' · ');
    }

  }

  setPlaying(playing) {
    this._playIcon.icon_name = playing
      ? 'media-playback-pause-symbolic'
      : 'media-playback-start-symbolic';
    this._popArt.set_opacity(playing ? 255 : 150);
    if (playing)
      this._box.remove_style_class_name('paused');
    else
      this._box.add_style_class_name('paused');
  }

  setPosition(position, duration) {
    this._position = position;
    this._duration = duration;
    if (!this._seeking)
      this._renderProgress();
  }

  _renderProgress() {
    const width = this._progress.width || CARD_WIDTH - PADDING * 2;
    const pct = this._duration > 0
      ? Math.min(1, Math.max(0, this._position / this._duration))
      : 0;
    this._fill.set_width(Math.round(width * pct));
  }

  _seekFromEvent(event) {
    if (!(this._duration > 0))
      return;

    const [x] = event.get_coords();
    const [ax] = this._progress.get_transformed_position();
    const width = this._progress.width || 1;
    const pct = Math.min(1, Math.max(0, (x - ax) / width));
    this._position = pct * this._duration;
    this._renderProgress();
    this._callbacks.onSeek?.(Math.round(pct * this._duration * 1e6));
  }

  setLyrics(current, next) {
    this._lyric.text = current || '';
    this._nextLyric.text = next || '';
    this._updateLyricsVisibility();
  }

  setLyricsVisible(visible) {
    this._lyricsVisible = visible;
    this._updateLyricsVisibility();
  }

  _updateLyricsVisibility() {
    const visible = this._lyricsVisible && Boolean(this._lyric.text || this._nextLyric.text);
    if (this._lyricsBox.visible === visible)
      return;

    this._lyricsBox.visible = visible;
    this._relayout();
  }

  setStats(stats) {
    this._stats = stats;
    this._updateFooter();
  }

  _updateFooter() {
    const seconds = (this._stats?.week ?? []).reduce((sum, value) => sum + value, 0);
    const top = this._stats?.topArtist ?? '';
    const week = `<b>${GLib.markup_escape_text(formatWeek(seconds), -1)}</b>`;
    const text = top
      ? `This week ${week} · top <b>${GLib.markup_escape_text(top, -1)}</b>`
      : `This week ${week}`;
    this._footLabel.clutter_text.set_markup(text);

    const streak = this._stats?.streak ?? 0;
    const best = this._stats?.bestStreak ?? 0;
    this._streakBox.visible = streak > 0;
    this._streakLabel.text = `${streak}d`;
    this._bestLabel.visible = best > 0;
    this._bestLabel.clutter_text.set_markup(
      `best <b>${GLib.markup_escape_text(String(best), -1)}d</b>`);
  }

  cancelClose() {
    this._cancelClose();
  }

  destroy() {
    this._cancelClose();
    this._releaseEvents();

    if (this._overviewId) {
      Main.overview.disconnect(this._overviewId);
      this._overviewId = 0;
    }

    Main.layoutManager.removeChrome(this._actor);
    this._actor.destroy();
    this._actor = null;
  }
}
