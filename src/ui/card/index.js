import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {
  DEFAULT_PRESET_ID,
  cssRgba,
  hexToRgb,
  presetById,
} from '../../util/palette.js';
import {clampStatsHeight} from '../geometry.js';
import {drawArrow, drawRadialTint, surfaceScale} from '../paint.js';
import {CardHead} from './head.js';
import {CardTimer} from './timer.js';
import {CardFooter} from './footer.js';
import {LyricsPanel} from './lyrics-panel.js';
import {StatsPanel} from './stats-panel.js';

export const CARD_WIDTH = 360;

const PADDING = 16;
const GAP = 6;
const ARROW = 12;
const HOVER_CLOSE_MS = 320;

const LYRICS_W = 300;
// Space between the left column's content and the divider, so right-aligned
// labels (duration, "best Nd") stop touching the lyrics seam.
const LYRICS_GAP = PADDING;
const STATS_MIN_H = 160;
const STATS_MAX_H = 360;
const STATS_GRID_GAP = 14;
const SCREEN_MARGIN = 12;

const LEFT_W = CARD_WIDTH - PADDING * 2;

// Orchestrates the card: builds the panels, owns geometry and animation, and
// routes input. The panels themselves never talk to each other.
export class NowPlayingCard {
  constructor(callbacks = {}) {
    this._callbacks = callbacks;
    this._accent = [53, 132, 228];
    this._albumAccent = [53, 132, 228];
    this._bgMode = 'album';
    this._bgPreset = presetById(DEFAULT_PRESET_ID);
    this._pixbuf = null;
    this._lyricsVisible = true;
    this._open = false;
    this._anchor = null;
    this._positionMode = 'right';
    this._eventId = 0;
    this._modal = null;

    this._lyricsOpen = false;
    this._statsOpen = false;
    this._exitTimer = 0;
    this._closeTimer = 0;

    this._contentH = 0;
    this._targetW = CARD_WIDTH;
    this._targetH = 0;

    this._build();

    this._actor.connect('destroy', () => {
      this._destroyed = true;
    });

    Main.layoutManager.addChrome(this._actor);
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
      visible: false,
      clip_to_allocation: false,
      accessible_name: _('Now playing'),
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

    this._left = new St.BoxLayout({
      orientation: Clutter.Orientation.VERTICAL,
      style_class: 'sonora-card-box',
    });
    this._left.set_width(LEFT_W);
    this._cols.add_child(this._left);

    this._head = new CardHead({
      onTogglePlay: this._callbacks.onTogglePlay,
      onNext: this._callbacks.onNext,
      onPrev: this._callbacks.onPrev,
      onOpenSpotify: this._callbacks.onOpenSpotify,
      onRepeat: this._callbacks.onRepeat,
    });
    this._left.add_child(this._head.actor);

    this._timer = new CardTimer({onSeek: this._callbacks.onSeek});
    this._left.add_child(this._timer.actor);

    this._footer = new CardFooter();
    this._left.add_child(this._footer.actor);

    this._lyrics = new LyricsPanel(LYRICS_W);
    this._cols.add_child(this._lyrics.actor);

    this._stats = new StatsPanel();
    this._actor.add_child(this._stats.actor);

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

  _buildAffordances() {
    this._tab = new St.Button({
      style_class: 'sonora-tab',
      child: new St.Icon({
        icon_name: 'go-next-symbolic',
        icon_size: 12,
        style_class: 'sonora-tab-icon',
      }),
      accessible_name: _('Show lyrics'),
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
      accessible_name: _('Show listening stats'),
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

  _statsHeight(width = this._targetW) {
    if (!this._statsOpen)
      return 0;

    const natural = this._stats.measure(PADDING, width, STATS_GRID_GAP);
    const max = this._statsMaxHeight();
    this._stats.setScrollable(natural > max);
    return clampStatsHeight(natural, STATS_MIN_H, max);
  }

  // Let the drawer use every pixel available between the panel and the bottom
  // of the monitor, so the stats are fully visible without scrolling.
  _statsMaxHeight() {
    const monitor = this._anchor
      ? Main.layoutManager.findMonitorForActor(this._anchor)
      : null;
    const usable = monitor ?? Main.layoutManager.primaryMonitor;
    if (!usable)
      return STATS_MAX_H;

    const top = usable.y + Main.panel.height + GAP;
    const bottom = usable.y + usable.height - SCREEN_MARGIN;
    const bodyH = this._contentH + PADDING * 2;
    return Math.max(STATS_MIN_H, bottom - top - bodyH);
  }

  _measureContent() {
    this._left.set_width(LEFT_W);
    const [, natural] = this._left.get_preferred_height(LEFT_W);
    return Math.max(1, natural);
  }

  _relayout(animate = true) {
    if (this._destroyed)
      return;

    const contentH = this._measureContent();
    this._contentH = contentH;

    const width = CARD_WIDTH + this._lyricsWidth();
    const height = contentH + PADDING * 2 + this._statsHeight(width);
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
    const gutter = lyricsW > 0 ? LYRICS_GAP : 0;

    this._tint.set_position(0, 0);
    this._tint.set_size(width, height);

    this._cols.set_position(PADDING, PADDING);
    this._cols.set_size(Math.max(1, LEFT_W + gutter + lyricsW), contentH);

    this._left.set_position(0, 0);
    this._left.set_size(LEFT_W, contentH);

    this._lyrics.actor.set_position(LEFT_W + gutter, 0);
    this._lyrics.actor.set_size(Math.max(0, lyricsW), contentH);
    this._lyrics.layout(contentH);

    this._stats.layout(PADDING, bodyH, width, Math.max(0, height - bodyH), STATS_GRID_GAP);

    this._placeAffordances();
    this._timer.render();

    if (this._open)
      this._place();
  }

  _placeAffordances() {
    const width = this._actor.width;
    const height = this._actor.height;

    this._tab.set_position(width - 9, Math.round((height - this._statsHeight(width)) / 2) - 28);
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

  open(anchor, positionMode, modal = false) {
    this._cancelClose();
    this._cancelPointerExit();
    this._anchor = anchor;
    this._positionMode = positionMode ?? 'right';

    this._relayout(false);
    this._place();

    if (this._open && this._actor.visible)
      return;

    this._actor.remove_all_transitions();
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

    this._grabEvents(modal);
  }

  close(animate = true) {
    this._cancelClose();
    this._cancelPointerExit();
    if (!this._open && !this._actor.visible)
      return;

    this._open = false;
    this._releaseEvents();
    this._lyricsOpen = false;
    this._statsOpen = false;
    this._syncAffordances();
    this._actor.remove_all_transitions();

    const hide = () => {
      if (this._destroyed || this._open)
        return;
      this._actor.visible = false;
      this._actor.set_opacity(255);
      this._actor.set_scale(1, 1);
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

  isPointerOver() {
    return this._open && this._pointerStillOnCard();
  }

  scheduleClose() {
    this._cancelClose();
    this._closeTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, HOVER_CLOSE_MS, () => {
      this._closeTimer = 0;
      this.close();
      return GLib.SOURCE_REMOVE;
    });
  }

  cancelClose() {
    this._cancelClose();
  }

  _cancelClose() {
    if (this._closeTimer) {
      GLib.source_remove(this._closeTimer);
      this._closeTimer = 0;
    }
  }

  // ---------- drawers ----------

  _toggleLyrics() {
    this._lyricsOpen = !this._lyricsOpen;
    this._syncAffordances();
    this._relayout();
  }

  _toggleStats() {
    this._statsOpen = !this._statsOpen;
    this._syncAffordances();
    this._relayout();
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
    this._tab.accessible_name = this._lyricsOpen ? _('Hide lyrics') : _('Show lyrics');
    this._stab.accessible_name = this._statsOpen
      ? _('Hide listening stats')
      : _('Show listening stats');

    if (this._lyricsOpen)
      this._tab.add_style_class_name('active');

    if (this._statsOpen) {
      this._stab.add_style_class_name('active');
      this._stabIcon.style = `color: ${activeColor};`;
    } else {
      this._stabIcon.style = '';
    }
  }

  // ---------- pointer ----------

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

  // ---------- events ----------

  _grabEvents(modal = false) {
    this._releaseEvents();
    if (modal) {
      try {
        this._modal = Main.pushModal(this._actor, {
          actionMode: Shell.ActionMode.POPUP,
        });
      } catch {
        this._modal = null;
      }
    }

    this._eventId = global.stage.connect('captured-event', (actor, event) => {
      if (event.type() === Clutter.EventType.KEY_PRESS) {
        if (event.get_key_symbol() === Clutter.KEY_Escape) {
          if (this._lyricsOpen || this._statsOpen) {
            this._lyricsOpen = false;
            this._statsOpen = false;
            this._syncAffordances();
            this._relayout();
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
      const insideCard = this._inside(x, y, this._actor, -GAP) ||
        (this._tab?.visible && this._inside(x, y, this._tab, 0)) ||
        (this._stab?.visible && this._inside(x, y, this._stab, 0)) ||
        this._inside(x, y, this._anchor, 0);
      if (insideCard)
        return Clutter.EVENT_PROPAGATE;

      const wasModal = Boolean(this._modal);
      this.close();
      return wasModal ? Clutter.EVENT_STOP : Clutter.EVENT_PROPAGATE;
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
    if (this._modal) {
      Main.popModal(this._modal);
      this._modal = null;
    }
  }

  // ---------- drawing ----------

  _drawTint(area) {
    if (this._bgMode === 'solid')
      return;

    const cr = area.get_context();
    const {width, height} = area;
    if (!width || !height)
      return;

    drawRadialTint(cr, width, height, this._accent, {
      scale: surfaceScale(area, width),
    });
  }

  _drawArrow(area) {
    const cr = area.get_context();
    const background = this._bgMode === 'solid'
      ? hexToRgb(this._bgPreset.bg)
      : [13, 13, 18];
    drawArrow(cr, {
      width: ARROW,
      height: GAP,
      rgb: this._accent,
      scale: surfaceScale(area, ARROW),
      background,
    });
  }

  // ---------- data ----------

  setArt(pixbuf) {
    this._pixbuf = pixbuf;
    this._head.setArt(pixbuf);
    this._applyAccent();
  }

  setAccent(rgb) {
    this._albumAccent = rgb;
    if (this._bgMode === 'solid')
      return;

    this._accent = rgb;
    this._applyAccent();
  }

  setBackground(mode, preset) {
    this._bgMode = mode === 'solid' ? 'solid' : 'album';
    this._bgPreset = preset ?? presetById(DEFAULT_PRESET_ID);
    this._accent = this._bgMode === 'solid'
      ? hexToRgb(this._bgPreset.accent)
      : this._albumAccent;
    this._applyAccent();
  }

  _applyAccent() {
    const [r, g, b] = this._accent;
    const rgba = alpha => `rgba(${r},${g},${b},${alpha})`;
    const solid = this._bgMode === 'solid';
    const bgStyle = solid
      ? `background-color: ${cssRgba(this._bgPreset.bg, 0.94)}; `
      : '';
    const tabBg = solid ? cssRgba(this._bgPreset.bg, 0.94) : 'rgba(20,20,26,0.94)';

    // Neutral shadow: an accent-tinted one read as a neon glow. St accepts a
    // single box-shadow per node, so it stays one declaration.
    this._actor.set_style(
      `${bgStyle}border: 1px solid ${rgba(0.40)}; ` +
      'box-shadow: 0 6px 16px rgba(0, 0, 0, 0.40);');

    this._footer.applyAccent(this._accent, rgba);
    this._stats.applyAccent(this._accent);
    this._tab?.set_style(
      `background-color: ${tabBg}; border-color: ${rgba(0.42)};`);
    this._stab?.set_style(
      `background-color: ${tabBg}; border-color: ${rgba(0.42)};`);

    if (!this._pixbuf)
      this._head.setPlaceholder(`background-color: ${rgba(0.28)};`);

    this._tint.visible = !solid;
    if (!solid)
      this._tint.queue_repaint();
    this._arrow.queue_repaint();
  }

  setTrack(track) {
    this._head.setTrack(track);
    this._timer.reset();
    this._lyrics.setLines([], -1);
    if (this._open)
      this._relayout();
  }

  setPlaying(playing) {
    this._head.setPlaying(playing);
    if (playing)
      this._left.remove_style_class_name('paused');
    else
      this._left.add_style_class_name('paused');
  }

  setRepeat(mode) {
    this._head.setRepeat(mode);
  }

  setPosition(position, duration) {
    this._timer.setPosition(position, duration);
    this._updateActiveLyric(position);
  }

  setLyrics(lines, index) {
    this._lyrics.setLines(lines, index);
    if (this._lyricsOpen)
      this._relayout();
  }

  setLyricsVisible(visible) {
    this._lyricsVisible = visible;
    this._tab.visible = visible;
    if (!visible && this._lyricsOpen) {
      this._lyricsOpen = false;
      this._syncAffordances();
      this._relayout();
    }
  }

  _updateActiveLyric(position) {
    const lines = this._lyrics.lines;
    if (!lines.length)
      return;

    let low = 0;
    let high = lines.length - 1;
    let found = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (lines[mid].time <= position) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (this._lyrics.setIndex(found) && this._lyricsOpen)
      this._relayout();
  }

  setStats(stats) {
    this._stats.setStats(stats);
    this._footer.setStats(stats);
    if (this._statsOpen)
      this._relayout();
  }

  destroy() {
    this._cancelClose();
    this._cancelPointerExit();
    this._releaseEvents();
    this._timer.destroy();

    if (this._overviewId) {
      Main.overview.disconnect(this._overviewId);
      this._overviewId = 0;
    }

    Main.layoutManager.removeChrome(this._actor);
    this._actor.destroy();
    this._actor = null;
  }
}
