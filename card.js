import Cairo from 'gi://cairo';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {extensionDir} from './src/util/path.js';

import {setArtImage} from './src/util/art.js';

export const CARD_WIDTH = 360;
export const CARD_CLOSED_WIDTH = CARD_WIDTH;

const PADDING = 16;
const GAP = 6;
const ARROW = 12;
const HOVER_CLOSE_MS = 320;

const LYRICS_W = 300;
const STATS_H = 256;
const STATS_GRID_GAP = 14;

const REPEAT_ORDER = ['None', 'Playlist', 'Track'];
const REPEAT_ICON = {
  None: 'media-playlist-repeat-symbolic',
  Playlist: 'media-playlist-repeat-symbolic',
  Track: 'media-playlist-repeat-song-symbolic',
};
const REPEAT_LABEL = {None: 'off', Playlist: 'all', Track: 'one'};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

function iconButton(styleClass, iconName, callback, iconSize = 15) {
  const button = new St.Button({
    style_class: styleClass,
    child: new St.Icon({icon_name: iconName, icon_size: iconSize}),
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
    this._lyrics = [];
    this._lyricIndex = -1;
    this._lyricsVisible = true;
    this._seeking = false;
    this._open = false;
    this._anchor = null;
    this._positionMode = 'right';
    this._eventId = 0;
    this._repeatMode = 'None';

    this._lyricsOpen = false;
    this._statsOpen = false;
    this._exitTimer = 0;

    this._contentH = 0;
    this._targetW = CARD_WIDTH;
    this._targetH = 0;

    this._build();
    this._actor.connect('destroy', () => {
      this._destroyed = true;
    });
    Main.layoutManager.addChrome(this._actor, {trackFullscreen: true});
    this._actor.visible = false;
    this._relayout(false);

    this._overviewId = Main.overview.connect('showing', () => this.close(false));
  }

  _build() {
    this._actor = new St.Widget({
      style_class: 'sonora-card',
      layout_manager: new Clutter.FixedLayout(),
      width: CARD_WIDTH,
      height: 220,
      reactive: true,
      clip_to_allocation: false,
    });

    // The card animates its own width/height, so children must follow every
    // frame — otherwise the drawers stay at their pre-animation size.
    this._actor.connect('notify::width', () => this._layoutChildren());
    this._actor.connect('notify::height', () => this._layoutChildren());

    this._tint = new St.DrawingArea();
    this._tint.connect('repaint', area => this._drawTint(area));
    this._actor.add_child(this._tint);

    this._arrow = new St.DrawingArea();
    this._arrow.set_size(ARROW, GAP);
    this._arrow.connect('repaint', area => this._drawArrow(area));
    this._actor.add_child(this._arrow);

    // FixedLayout, not BoxLayout: the lyrics panel is positioned at a fixed
    // offset so the left column keeps its exact width when the card widens.
    this._cols = new St.Widget({
      style_class: 'sonora-cols',
      layout_manager: new Clutter.FixedLayout(),
    });
    this._actor.add_child(this._cols);

    this._left = new St.BoxLayout({vertical: true, style_class: 'sonora-card-box'});
    this._left.set_width(CARD_WIDTH - PADDING * 2);
    this._cols.add_child(this._left);

    this._buildHead();
    this._buildTimer();
    this._buildFooter();

    this._buildLyrics();
    this._buildStats();

    this._buildAffordances();

    this._actor.connect('enter-event', () => {
      this._cancelClose();
      this._cancelPointerExit();
      this._callbacks.onEnter?.();
      return Clutter.EVENT_PROPAGATE;
    });
    this._actor.connect('leave-event', () => {
      this._schedulePointerExit();
      return Clutter.EVENT_PROPAGATE;
    });
  }

  _buildHead() {
    this._head = new St.BoxLayout({style_class: 'sonora-head'});

    this._popArt = new St.Widget({
      style_class: 'sonora-art',
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
      style_class: 'sonora-info',
    });
    this._popTitle = new St.Label({text: 'Nothing playing', style_class: 'sonora-song'});
    this._popArtist = new St.Label({text: '', style_class: 'sonora-artist'});
    ellipsize(this._popTitle);
    ellipsize(this._popArtist);
    this._info.add_child(this._popTitle);
    this._info.add_child(this._popArtist);

    this._controls = new St.BoxLayout({
      style_class: 'sonora-controls',
      y_align: Clutter.ActorAlign.CENTER,
    });

    this._prev = iconButton('sonora-btn', 'media-skip-backward-symbolic',
      () => this._callbacks.onPrev?.());
    this._play = new St.Button({
      style_class: 'sonora-play',
      child: new St.Icon({icon_name: 'media-playback-start-symbolic', icon_size: 16}),
    });
    this._playIcon = this._play.get_child();
    this._play.connect('clicked', () => this._callbacks.onTogglePlay?.());
    this._next = iconButton('sonora-btn', 'media-skip-forward-symbolic',
      () => this._callbacks.onNext?.());

    this._repeat = new St.Button({
      style_class: 'sonora-repeat',
      child: new St.Icon({
        icon_name: REPEAT_ICON.None,
        icon_size: 15,
        style_class: 'sonora-repeat-icon',
      }),
    });
    this._repeatIcon = this._repeat.get_child();
    this._repeat.connect('clicked', () => this._cycleRepeat());

    this._controls.add_child(this._prev);
    this._controls.add_child(this._play);
    this._controls.add_child(this._next);
    this._controls.add_child(this._repeat);

    this._head.add_child(this._popArt);
    this._head.add_child(this._info);
    this._head.add_child(this._controls);
    this._left.add_child(this._head);
  }

  _buildTimer() {
    this._timerRow = new St.BoxLayout({
      style_class: 'sonora-timerow',
      y_align: Clutter.ActorAlign.CENTER,
    });

    this._cur = new St.Label({text: '0:00', style_class: 'sonora-time'});
    this._dur = new St.Label({text: '0:00', style_class: 'sonora-time sonora-time-end'});

    this._bar = new St.Widget({
      style_class: 'sonora-bar',
      reactive: true,
      track_hover: true,
      layout_manager: new Clutter.FixedLayout(),
      x_expand: true,
      height: 14,
    });

    this._barTrack = new St.Widget({style_class: 'sonora-bar-track', height: 3, width: 0});
    this._barTrack.set_position(0, 6);
    this._barFill = new St.Widget({style_class: 'sonora-bar-fill', height: 3, width: 0});
    this._barFill.set_position(0, 6);
    this._barKnob = new St.Widget({style_class: 'sonora-bar-knob', width: 9, height: 9});
    this._bar.add_child(this._barTrack);
    this._bar.add_child(this._barFill);
    this._bar.add_child(this._barKnob);

    this._bar.connect('button-press-event', (actor, event) => {
      if (event.get_button() !== 1)
        return Clutter.EVENT_PROPAGATE;
      this._seeking = true;
      this._bar.add_style_class_name('dragging');
      this._seekFromEvent(event);
      return Clutter.EVENT_STOP;
    });
    this._bar.connect('motion-event', (actor, event) => {
      if (!this._seeking)
        return Clutter.EVENT_PROPAGATE;
      this._seekFromEvent(event);
      return Clutter.EVENT_STOP;
    });
    this._bar.connect('button-release-event', () => {
      this._seeking = false;
      this._bar.remove_style_class_name('dragging');
      return Clutter.EVENT_STOP;
    });

    this._timerRow.add_child(this._cur);
    this._timerRow.add_child(this._bar);
    this._timerRow.add_child(this._dur);
    this._left.add_child(this._timerRow);
  }

  _buildFooter() {
    this._foot = new St.BoxLayout({style_class: 'sonora-foot'});
    this._footIcon = new St.Icon({
      icon_name: 'audio-x-generic-symbolic',
      icon_size: 14,
      style_class: 'sonora-foot-icon',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._footLabel = new St.Label({
      text: 'This week 0m',
      style_class: 'sonora-foot-label',
      x_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
    });
    ellipsize(this._footLabel);

    this._footStats = new St.BoxLayout({
      style_class: 'sonora-foot-stats',
      y_align: Clutter.ActorAlign.CENTER,
    });

    this._streakBox = new St.BoxLayout({
      style_class: 'sonora-streak',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._flame = new St.Icon({
      gicon: Gio.icon_new_for_string(
        `${extensionDir()}/icons/sonora-flame-symbolic.svg`),
      icon_size: 14,
      style_class: 'sonora-flame',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._streakLabel = new St.Label({
      text: '0d',
      style_class: 'sonora-streak-label',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._streakBox.add_child(this._flame);
    this._streakBox.add_child(this._streakLabel);

    this._bestLabel = new St.Label({
      text: '',
      style_class: 'sonora-best-label',
      y_align: Clutter.ActorAlign.CENTER,
    });

    this._footStats.add_child(this._streakBox);
    this._footStats.add_child(this._bestLabel);

    this._foot.add_child(this._footIcon);
    this._foot.add_child(this._footLabel);
    this._foot.add_child(this._footStats);
    this._left.add_child(this._foot);
  }

  _buildLyrics() {
    this._lyricsPanel = new St.Widget({
      style_class: 'sonora-lyrics-panel',
      layout_manager: new Clutter.FixedLayout(),
      width: 0,
      clip_to_allocation: true,
      reactive: true,
      y_expand: true,
    });

    this._lyricsInner = new St.BoxLayout({
      vertical: true,
      style_class: 'sonora-lyrics-inner',
      width: LYRICS_W,
    });
    this._lyricsPanel.add_child(this._lyricsInner);

    this._lyricsEmpty = new St.Label({
      text: 'No lyrics for this track',
      style_class: 'sonora-lyrics-empty',
    });
    this._lyricsPanel.add_child(this._lyricsEmpty);

    this._cols.add_child(this._lyricsPanel);
  }

  _buildStats() {
    this._statsWrap = new St.Widget({
      style_class: 'sonora-stats-wrap',
      layout_manager: new Clutter.FixedLayout(),
      height: 0,
      clip_to_allocation: true,
      reactive: true,
    });

    const box = new St.BoxLayout({vertical: true, style_class: 'sonora-stats'});
    this._statsBox = box;

    const headRow = new St.BoxLayout({style_class: 'sonora-stats-head'});
    this._statsTitle = new St.Label({text: 'STATISTICS', style_class: 'sonora-stats-title'});
    this._statsPeriod = new St.Label({text: 'THIS WEEK', style_class: 'sonora-stats-period',
      x_expand: true, x_align: Clutter.ActorAlign.END});
    headRow.add_child(this._statsTitle);
    headRow.add_child(this._statsPeriod);

    this._weekTotal = new St.Label({text: '0m', style_class: 'sonora-week-total'});

    const sparkWrap = new St.BoxLayout({vertical: true, style_class: 'sonora-spark-wrap'});
    this._spark = new St.BoxLayout({style_class: 'sonora-spark'});
    this._sparkDays = new St.BoxLayout({style_class: 'sonora-spark-days'});
    sparkWrap.add_child(this._spark);
    sparkWrap.add_child(this._sparkDays);

    const grid = new St.BoxLayout({style_class: 'sonora-stats-grid', x_expand: true});
    this._statsGrid = grid;
    const artistsCol = new St.BoxLayout({
      vertical: true, style_class: 'sonora-stats-col', x_expand: true,
    });
    const tracksCol = new St.BoxLayout({
      vertical: true, style_class: 'sonora-stats-col', x_expand: true,
    });
    this._artistsCol = artistsCol;
    this._tracksCol = tracksCol;
    const artistsTitle = new St.Label({text: 'TOP ARTISTS', style_class: 'sonora-stats-coltitle'});
    const tracksTitle = new St.Label({text: 'TOP TRACKS', style_class: 'sonora-stats-coltitle'});
    this._artistsList = new St.BoxLayout({vertical: true, style_class: 'sonora-stats-list'});
    this._tracksList = new St.BoxLayout({vertical: true, style_class: 'sonora-stats-list'});
    artistsCol.add_child(artistsTitle);
    artistsCol.add_child(this._artistsList);
    tracksCol.add_child(tracksTitle);
    tracksCol.add_child(this._tracksList);
    grid.add_child(artistsCol);
    grid.add_child(tracksCol);

    this._activeLabel = new St.Label({text: '', style_class: 'sonora-stats-active'});

    box.add_child(headRow);
    box.add_child(this._weekTotal);
    box.add_child(sparkWrap);
    box.add_child(grid);
    box.add_child(this._activeLabel);

    this._statsWrap.add_child(box);
    this._actor.add_child(this._statsWrap);
  }

  _buildAffordances() {
    this._tab = new St.Button({
      style_class: 'sonora-tab',
      child: new St.Icon({
        icon_name: 'go-next-symbolic',
        icon_size: 12,
        style_class: 'sonora-tab-icon',
      }),
    });
    this._tabIcon = this._tab.get_child();
    this._tab.set_size(18, 56);
    this._tab.connect('clicked', () => this._toggleLyrics());
    this._tab.connect('enter-event', () => {
      this._cancelPointerExit();
      return Clutter.EVENT_PROPAGATE;
    });
    this._tab.connect('leave-event', () => {
      this._schedulePointerExit();
      return Clutter.EVENT_PROPAGATE;
    });
    this._actor.add_child(this._tab);

    this._stab = new St.Button({
      style_class: 'sonora-stab',
      child: new St.Icon({
        icon_name: 'go-down-symbolic',
        icon_size: 12,
        style_class: 'sonora-stab-icon',
      }),
    });
    this._stabIcon = this._stab.get_child();
    this._stab.set_size(56, 18);
    this._stab.connect('clicked', () => this._toggleStats());
    this._stab.connect('enter-event', () => {
      this._cancelPointerExit();
      return Clutter.EVENT_PROPAGATE;
    });
    this._stab.connect('leave-event', () => {
      this._schedulePointerExit();
      return Clutter.EVENT_PROPAGATE;
    });
    this._actor.add_child(this._stab);
  }

  // ---------- geometry ----------

  _lyricsWidth() {
    return this._lyricsOpen ? LYRICS_W : 0;
  }

  _statsHeight() {
    return this._statsOpen ? STATS_H : 0;
  }

  _measureContent() {
    const inner = CARD_WIDTH - PADDING * 2;
    this._left.set_width(inner);
    const [, natural] = this._left.get_preferred_height(inner);
    return Math.max(1, natural);
  }

  _relayout(animate = true) {
    if (this._destroyed)
      return;

    const contentH = this._measureContent();
    this._contentH = contentH;
    const width = CARD_WIDTH + this._lyricsWidth();
    const height = contentH + PADDING * 2 + this._statsHeight();

    const changed = width !== this._targetW || height !== this._targetH;
    this._targetW = width;
    this._targetH = height;

    if (!animate || !this._open) {
      this._actor.set_size(width, height);
      this._layoutChildren();
      return;
    }

    if (changed) {
      this._actor.ease({
        width,
        height,
        duration: 300,
        mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
      });
    }
    this._layoutChildren();
  }

  _layoutChildren() {
    const width = this._actor.width;
    const height = this._actor.height;
    const contentH = this._contentH;
    const bodyH = contentH + PADDING * 2;
    const lyricsW = Math.max(0, width - CARD_WIDTH);
    const statsH = Math.max(0, height - bodyH);

    this._tint.set_position(0, 0);
    this._tint.set_size(width, height);

    const leftW = CARD_WIDTH - PADDING * 2;

    this._cols.set_position(PADDING, PADDING);
    this._cols.set_size(Math.max(1, leftW + lyricsW), contentH);

    this._left.set_position(0, 0);
    this._left.set_size(leftW, contentH);

    this._lyricsPanel.set_position(leftW, 0);
    this._lyricsPanel.set_size(Math.max(0, lyricsW), contentH);

    const innerW = LYRICS_W;
    this._lyricsInner.set_size(innerW, contentH);
    const [, innerH] = this._lyricsInner.get_preferred_height(innerW);
    this._lyricsInner.set_position(0, Math.max(0, Math.round((contentH - innerH) / 2)));
    this._lyricsEmpty.set_position(0, Math.round(contentH / 2) - 8);
    this._lyricsEmpty.set_width(innerW);

    this._statsWrap.set_position(0, bodyH);
    this._statsWrap.set_size(width, statsH);
    const statsW = Math.max(1, width - PADDING * 2);
    this._statsBox.set_position(PADDING, 0);
    this._statsBox.set_size(statsW, STATS_H);

    // Both list columns stay the same width, as in the mock (flex: 1 1 0).
    const colW = Math.max(1, Math.round((statsW - STATS_GRID_GAP) / 2));
    this._artistsCol?.set_width(colW);
    this._tracksCol?.set_width(colW);

    this._placeAffordances();
    this._renderProgress();

    if (this._open)
      this._place();
  }

  _placeAffordances() {
    const width = this._actor.width;
    const height = this._actor.height;

    this._tab.set_position(width - 9, Math.round((height - this._statsHeight()) / 2) - 28);
    this._stab.set_position(Math.round(width / 2) - 28, height - 9);
  }

  _place() {
    if (!this._anchor)
      return;

    const [ax] = this._anchor.get_transformed_position();
    const [aw] = this._anchor.get_size();
    const monitor = Main.layoutManager.findMonitorForActor(this._anchor) ??
      Main.layoutManager.primaryMonitor;

    const width = this._targetW;

    let x;
    if (this._positionMode === 'left')
      x = ax;
    else if (this._positionMode === 'center')
      x = ax + aw / 2 - width / 2;
    else
      x = ax + aw - width;

    const minX = monitor.x + 12;
    const maxX = monitor.x + monitor.width - width - 12;
    x = Math.round(Math.max(minX, Math.min(x, maxX)));

    const y = Math.round(monitor.y + Main.panel.height + GAP);
    this._actor.set_position(x, y);

    const arrowX = Math.max(20, Math.min(width - 20, ax + aw / 2 - x));
    this._arrow.set_position(Math.round(arrowX - ARROW / 2), -GAP);
  }

  // ---------- open / close ----------

  open(anchor, positionMode) {
    this._anchor = anchor;
    this._positionMode = positionMode ?? 'right';

    this._relayout(false);
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
    this._lyricsOpen = false;
    this._statsOpen = false;
    this._syncAffordances();

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

  // ---------- drawers ----------

  _toggleLyrics() {
    this._lyricsOpen = !this._lyricsOpen;
    this._syncAffordances();
    this._relayout();
    this._updateLyricsVisibility();
  }

  _toggleStats() {
    this._statsOpen = !this._statsOpen;
    this._syncAffordances();
    this._relayout();
  }

  // The affordance moves when a drawer expands, so a stationary pointer would
  // generate leave/enter pairs forever. Only collapse when the pointer has
  // genuinely left the card.
  _pointerOver(actor) {
    if (!actor || !actor.visible)
      return false;

    const [px, py] = global.get_pointer();
    const [ax, ay] = actor.get_transformed_position();
    const [aw, ah] = actor.get_size();
    return px >= ax && px < ax + aw && py >= ay && py < ay + ah;
  }

  // The affordances stick out past the card edge, so "still hovering" has to
  // include them or the drawer closes the moment the pointer reaches the tab.
  _pointerStillOnCard() {
    return this._pointerOver(this._actor) ||
      this._pointerOver(this._tab) ||
      this._pointerOver(this._stab);
  }

  _schedulePointerExit() {
    this._cancelPointerExit();
    this._exitTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 160, () => {
      this._exitTimer = 0;
      if (this._pointerStillOnCard())
        return GLib.SOURCE_REMOVE;
      this._callbacks.onLeave?.();
      return GLib.SOURCE_REMOVE;
    });
  }

  _cancelPointerExit() {
    if (this._exitTimer) {
      GLib.source_remove(this._exitTimer);
      this._exitTimer = 0;
    }
  }

  _syncAffordances() {
    if (!this._tab)
      return;

    const [r, g, b] = this._accent;
    const activeColor = `rgb(${r},${g},${b})`;

    this._tab.remove_style_class_name('active');
    this._stab.remove_style_class_name('active');

    this._tabIcon.icon_name = this._lyricsOpen ? 'go-previous-symbolic' : 'go-next-symbolic';
    this._stabIcon.icon_name = this._statsOpen ? 'go-up-symbolic' : 'go-down-symbolic';

    if (this._lyricsOpen) {
      this._tab.add_style_class_name('active');
    } else {
      this._tabIcon.style = '';
    }

    if (this._statsOpen) {
      this._stab.add_style_class_name('active');
      this._stabIcon.style = `color: ${activeColor};`;
    } else {
      this._stabIcon.style = '';
    }
  }

  // ---------- events ----------

  _grabEvents() {
    this._releaseEvents();
    this._eventId = global.stage.connect('captured-event', (actor, event) => {
      if (event.type() === Clutter.EventType.KEY_PRESS) {
        if (event.get_key_symbol() === Clutter.KEY_Escape) {
          if (this._lyricsOpen || this._statsOpen) {
            this._lyricsOpen = false;
            this._statsOpen = false;
            this._syncAffordances();
            this._relayout();
            this._updateLyricsVisibility();
            return Clutter.EVENT_STOP;
          }
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

  // ---------- drawing ----------

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

  // ---------- data ----------

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

    // Neutral shadow: the accent-tinted one read as a neon glow.
    // St accepts a single box-shadow per node; a second one only warns.
    this._actor.set_style(
      `border: 1px solid ${rgba(0.40)}; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.40);`);
    this._footIcon.set_style(
      `color: rgb(${r},${g},${b}); icon-shadow: 0 0 2px ${rgba(0.75)};`);
    this._flame.set_style('icon-shadow: 0 0 3px rgba(255,120,20,0.85);');

    for (const node of [this._weekTotal, this._spark, this._activeLabel])
      node?.set_style('');

    this._spark?.set_style(`color: rgb(${r},${g},${b});`);
    this._tab?.set_style(
      `background-color: rgba(20,20,26,0.94); border-color: ${rgba(0.42)};`);
    this._stab?.set_style(
      `background-color: rgba(20,20,26,0.94); border-color: ${rgba(0.42)};`);

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
      this._lyrics = [];
      this._lyricIndex = -1;
      this._renderProgress();
      this._renderLyrics();
      return;
    }

    this._popTitle.text = track.title || 'Unknown';
    this._popArtist.text = [track.artist, track.album].filter(Boolean).join(' · ');
    this._position = 0;
    this._duration = track.duration ?? 0;
    this._lyrics = [];
    this._lyricIndex = -1;
    this._renderLyrics();
    this._renderProgress();
  }

  setPlaying(playing) {
    this._playIcon.icon_name = playing
      ? 'media-playback-pause-symbolic'
      : 'media-playback-start-symbolic';
    this._popArt.set_opacity(playing ? 255 : 150);
    if (playing)
      this._left.remove_style_class_name('paused');
    else
      this._left.add_style_class_name('paused');
  }

  setRepeat(mode) {
    if (!REPEAT_ORDER.includes(mode))
      return;

    this._repeatMode = mode;
    this._repeatIcon.icon_name = REPEAT_ICON[mode];
    this._repeat.remove_style_class_name('on');
    if (mode !== 'None')
      this._repeat.add_style_class_name('on');
    if (mode === 'Track')
      this._repeat.add_style_class_name('one');
    else
      this._repeat.remove_style_class_name('one');

    const label = `Repeat: ${REPEAT_LABEL[mode]}`;
    this._repeat.accessible_name = label;
  }

  _cycleRepeat() {
    const next = REPEAT_ORDER[(REPEAT_ORDER.indexOf(this._repeatMode) + 1) % REPEAT_ORDER.length];
    this.setRepeat(next);
    this._callbacks.onRepeat?.(next);
  }

  setPosition(position, duration) {
    this._position = position;
    this._duration = duration;
    if (!this._seeking)
      this._renderProgress();
    this._updateActiveLyric();
  }

  _renderProgress() {
    const width = this._bar.width || CARD_WIDTH - PADDING * 2;
    const pct = this._duration > 0
      ? Math.min(1, Math.max(0, this._position / this._duration))
      : 0;

    this._barTrack.set_width(width);
    this._barFill.set_width(Math.round(width * pct));
    this._barKnob.set_position(Math.round(width * pct) - 4, 2);
    this._cur.text = formatClock(this._position);
    this._dur.text = formatClock(this._duration);
  }

  _seekFromEvent(event) {
    if (!(this._duration > 0))
      return;

    const [x] = event.get_coords();
    const [ax] = this._bar.get_transformed_position();
    const width = this._bar.width || 1;
    const pct = Math.min(1, Math.max(0, (x - ax) / width));
    this._position = pct * this._duration;
    this._renderProgress();
    this._callbacks.onSeek?.(Math.round(pct * this._duration * 1e6));
  }

  setLyrics(lines, index) {
    this._lyrics = Array.isArray(lines) ? lines : [];
    this._lyricIndex = Number.isInteger(index) ? index : -1;
    this._renderLyrics();
  }

  setLyricsVisible(visible) {
    this._lyricsVisible = visible;
    if (!visible && this._lyricsOpen) {
      this._lyricsOpen = false;
      this._syncAffordances();
      this._relayout();
    }
    this._updateLyricsVisibility();
  }

  _updateLyricsVisibility() {
    if (!this._tab)
      return;

    this._tab.visible = this._lyricsVisible;
    if (!this._lyricsVisible)
      this._relayout();
  }

  _updateActiveLyric() {
    if (!this._lyrics.length)
      return;

    const index = this._activeIndexFor(this._position);
    if (index === this._lyricIndex)
      return;

    this._lyricIndex = index;
    this._renderLyrics();
  }

  _activeIndexFor(position) {
    let low = 0;
    let high = this._lyrics.length - 1;
    let found = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this._lyrics[mid].time <= position) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return found;
  }

  _renderLyrics() {
    if (!this._lyricsInner)
      return;

    this._lyricsInner.destroy_all_children();

    if (!this._lyrics.length) {
      this._lyricsEmpty.visible = true;
      this._lyricsInner.visible = false;
      return;
    }

    this._lyricsEmpty.visible = false;
    this._lyricsInner.visible = true;

    const windowSize = 5;
    let start = Math.max(0, this._lyricIndex - 2);
    start = Math.min(start, Math.max(0, this._lyrics.length - windowSize));

    for (let i = start; i < Math.min(start + windowSize, this._lyrics.length); i++) {
      const label = new St.Label({
        text: this._lyrics[i].text,
        style_class: 'sonora-lyric-line',
      });
      ellipsize(label);
      if (i === this._lyricIndex)
        label.add_style_class_name('active');
      else if (i < this._lyricIndex)
        label.add_style_class_name('past');
      else if (Math.abs(i - this._lyricIndex) === 1)
        label.add_style_class_name('near');

      this._lyricsInner.add_child(label);
    }

    if (this._lyricsOpen)
      this._relayout();
  }

  setStats(stats) {
    this._stats = stats;
    this._renderStats();
    this._updateFooter();
  }

  _updateFooter() {
    const seconds = this._stats?.weekSeconds ?? 0;
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

  _renderStats() {
    if (!this._stats || !this._spark)
      return;

    const days = this._stats.days ?? [];
    const max = Math.max(1, ...days.map(day => day.seconds));

    this._weekTotal.text = formatWeek(this._stats.weekSeconds ?? 0);

    this._spark.destroy_all_children();
    this._sparkDays.destroy_all_children();

    for (const [i, day] of days.entries()) {
      const bar = new St.Widget({
        style_class: 'sonora-spark-bar',
        x_expand: true,
        y_align: Clutter.ActorAlign.END,
        height: day.seconds > 0 ? Math.max(3, Math.round(day.seconds / max * 34)) : 2,
      });
      this._spark.add_child(bar);
      if (day.isToday)
        bar.add_style_class_name('today');
      if (!(day.seconds > 0))
        bar.add_style_class_name('empty');
      const label = new St.Label({
        text: WEEKDAYS[i] ?? '',
        style_class: 'sonora-spark-day',
        x_expand: true,
        x_align: Clutter.ActorAlign.CENTER,
      });
      if (day.isToday)
        label.add_style_class_name('today');
      this._sparkDays.add_child(label);
    }

    this._renderStatList(this._artistsList, this._stats.artists ?? [], entry => ({
      name: entry.name,
      value: formatWeek(entry.seconds),
    }));

    this._renderStatList(this._tracksList, this._stats.tracks ?? [], entry => ({
      name: entry.title,
      value: `${entry.plays}\u00d7`,
    }));

    const active = this._stats.activeDays ?? 0;
    this._activeLabel.clutter_text.set_markup(`<b>${active} of 7</b> days active`);

    if (this._statsOpen)
      this._relayout();
  }

  _renderStatList(host, entries, mapper) {
    host.destroy_all_children();

    entries.slice(0, 5).forEach((entry, i) => {
      const {name, value} = mapper(entry);
      const row = new St.BoxLayout({style_class: 'sonora-stat-row', x_expand: true});

      const rank = new St.Label({text: `${i + 1}`, style_class: 'sonora-stat-rank'});
      const label = new St.Label({text: name, style_class: 'sonora-stat-name', x_expand: true});
      const amount = new St.Label({text: value, style_class: 'sonora-stat-value'});
      ellipsize(label);
      rank.set_width(9);
      amount.set_width(38);
      amount.set_x_align(Clutter.ActorAlign.END);

      row.add_child(rank);
      row.add_child(label);
      row.add_child(amount);
      host.add_child(row);
    });
  }

  cancelClose() {
    this._cancelClose();
  }

  destroy() {
    this._cancelClose();
    this._cancelPointerExit();
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
