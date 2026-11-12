import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import {setArtImage} from '../util/art.js';
import {cssRgba, hexToRgb, presetById} from '../util/palette.js';
import {drawRadialTint, roundedClip, surfaceScale} from './paint.js';
import {formatClock} from './widgets.js';
import {NowPlayingCard} from './card/index.js';
import {extensionDir} from '../util/path.js';

const PILL_WIDTH = 240;
const PILL_HEIGHT = 26;
const PILL_TITLE = 116;
const ROLE = 'sonora';
const MOON_ICON = 'icons/sonora-moon-symbolic.svg';

export class SonoraIndicator {
  constructor(config, callbacks = {}) {
    this._config = config;
    this._callbacks = callbacks;

    this._pixbuf = null;
    this._accent = [53, 132, 228];
    this._albumAccent = [53, 132, 228];
    this._sleep = 0;
    this._duck = false;
    this._hasTrack = false;
    this._playing = false;
    this._position = 0;
    this._duration = 0;
    this._slotKind = null;
    this._swapTimer = 0;
    this._pillWidth = 0;
    this._pillHeight = 0;

    this._openTimer = 0;
    this._fitIdleId = 0;
    this._lastPosition = null;
    this._panelWidthId = 0;

    this._card = new NowPlayingCard({
      onTogglePlay: callbacks.onTogglePlay,
      onNext: callbacks.onNext,
      onPrev: callbacks.onPrev,
      onSeek: callbacks.onSeek,
      onRepeat: callbacks.onRepeat,
      onOpenSpotify: callbacks.onOpenSpotify,
      onEnter: () => this._cancelClose(),
      onLeave: () => this._scheduleClose(),
    });

    this._buildPanel();
    this._applyMode();
    this._place();
    this._applyBackground();
    this._updateSlot();
  }

  _buildPanel() {
    this._button = new PanelMenu.Button(0.0, 'Sonora', true);
    this._button.add_style_class_name('sonora-button');
    // Shell teardown destroys actors without calling disable(), so the 1s
    // timer would still poke disposed widgets. Stop as soon as we go away.
    this._button.connect('destroy', () => {
      this._destroyed = true;
    });

    this._panelBox = new St.BoxLayout({
      orientation: Clutter.Orientation.HORIZONTAL,
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._button.add_child(this._panelBox);

    this._iconBox = new St.Widget({
      style_class: 'sonora-icon-box',
      layout_manager: new Clutter.BinLayout(),
      width: 28,
      height: 24,
    });
    this._panelIcon = new St.Icon({
      icon_name: 'audio-x-generic-symbolic',
      icon_size: 14,
      style_class: 'sonora-panel-icon',
      x_align: Clutter.ActorAlign.CENTER,
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._iconBox.add_child(this._panelIcon);

    // FixedLayout, not BinLayout: BinLayout centres children and ignores
    // x_expand, so the row never filled the pill and the pill grew past 240.
    this._pillBox = new St.Widget({
      style_class: 'sonora-pill',
      layout_manager: new Clutter.FixedLayout(),
      width: PILL_WIDTH,
      height: PILL_HEIGHT,
      clip_to_allocation: true,
    });

    this._pillTint = new St.DrawingArea({x_expand: true, y_expand: true});
    this._pillTint.connect('repaint', area => this._drawTint(area));
    this._pillBox.add_child(this._pillTint);

    this._pillRow = new St.BoxLayout({
      style_class: 'sonora-pill-row',
      x_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._pillBox.add_child(this._pillRow);

    this._pillCover = new St.Widget({
      style_class: 'sonora-cover',
      width: 18,
      height: 18,
      y_align: Clutter.ActorAlign.CENTER,
      clip_to_allocation: true,
      accessible_name: _('Album art'),
    });

    this._applyPillHeight();

    this._pillTitle = new St.Label({
      text: _('Nothing playing'),
      style_class: 'sonora-title',
      width: PILL_TITLE,
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._pillTitle.clutter_text.ellipsize = 3;

    this._pillSpacer = new St.Widget({x_expand: true});

    this._pillSlot = new St.BoxLayout({
      style_class: 'sonora-slot is-action',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._pillSlotIcon = new St.Icon({
      gicon: Gio.icon_new_for_string(`${extensionDir()}/${MOON_ICON}`),
      icon_size: 13,
      style_class: 'sonora-slot-icon',
      y_align: Clutter.ActorAlign.CENTER,
      visible: false,
    });
    this._pillSlotText = new St.Label({
      text: '',
      style_class: 'sonora-slot-text',
      y_align: Clutter.ActorAlign.CENTER,
    });
    this._pillSlot.add_child(this._pillSlotIcon);
    this._pillSlot.add_child(this._pillSlotText);

    this._pillRow.add_child(this._pillCover);
    this._pillRow.add_child(this._pillTitle);
    this._pillRow.add_child(this._pillSpacer);
    this._pillRow.add_child(this._pillSlot);

    this._panelBox.add_child(this._iconBox);
    this._panelBox.add_child(this._pillBox);

    this._button.connect('enter-event', () => {
      this._cancelClose();
      if (this._cardOpenMode() !== 'click')
        this._scheduleOpen();
      return Clutter.EVENT_PROPAGATE;
    });
    this._button.connect('leave-event', () => {
      this._cancelOpen();
      this._scheduleClose();
      return Clutter.EVENT_PROPAGATE;
    });
    this._button.connect('button-release-event', (actor, event) => {
      if (event.get_button() !== 1)
        return Clutter.EVENT_PROPAGATE;

      if (this._card?.isOpen())
        this._card.close();
      else
        this._openCard();
      return Clutter.EVENT_PROPAGATE;
    });
  }

  _cardOpenMode() {
    return this._config.cardOpen ?? 'hover';
  }

  _openCard() {
    this._cancelOpen();
    this._card?.open(this._button, this._config.position);
  }

  _pointerOver(actor) {
    if (!actor || !actor.visible)
      return false;

    const [px, py] = global.get_pointer();
    const [ax, ay] = actor.get_transformed_position();
    const [aw, ah] = actor.get_size();
    return px >= ax && px < ax + aw && py >= ay && py < ay + ah;
  }

  _pointerOverButton() {
    return this._pointerOver(this._button?.container);
  }

  _scheduleOpen() {
    if (this._card?.isOpen())
      return;

    this._cancelOpen();
    const delay = Math.max(0, this._config.hoverDelay ?? 400);
    this._openTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
      this._openTimer = 0;
      if (this._pointerOverButton())
        this._card?.open(this._button, this._config.position);
      return GLib.SOURCE_REMOVE;
    });
  }

  _scheduleClose() {
    this._cancelOpen();
    if (this._pointerOverButton() || this._card?.isPointerOver())
      return;
    this._card?.scheduleClose();
  }

  _cancelOpen() {
    if (this._openTimer)
      GLib.source_remove(this._openTimer);
    this._openTimer = 0;
  }

  _cancelClose() {
    this._card?.cancelClose();
  }

  _applyMode() {
    const pill = this._config.mode === 'pill';
    this._iconBox.visible = !pill;
    this._pillBox.visible = pill;
    this._button.remove_style_class_name('sonora-mode-pill');
    this._button.remove_style_class_name('sonora-mode-icon');
    this._button.add_style_class_name(pill ? 'sonora-mode-pill' : 'sonora-mode-icon');
    if (this._fitIdleId) {
      GLib.source_remove(this._fitIdleId);
      this._fitIdleId = 0;
    }
    if (pill) {
      this._fitIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        this._fitIdleId = 0;
        this._fitPill();
        return GLib.SOURCE_REMOVE;
      });
    }
  }

  _panelBoxes() {
    return {
      left: Main.panel._leftBox,
      center: Main.panel._centerBox,
      right: Main.panel._rightBox,
    };
  }

  // Full panel height: the theme leaves 3px of transparent border on the
  // panel button, which is what made the pill look smaller than the bar.
  _applyPillHeight() {
    const height = this._config.mode === 'pill'
      ? Math.max(24, Main.panel.height || PILL_HEIGHT)
      : PILL_HEIGHT;
    if (height === this._pillHeight)
      return;

    this._pillHeight = height;
    this._pillBox.set_height(height);
    this._layoutPill();
    this._pillTint.queue_repaint();
  }

  // ponytail: pill stays at the mock's 240px; it only shrinks when the
  // panel simply has no room (narrow setups, crowded center box).
  _fitPill() {
    this._applyPillHeight();
    if (this._config.mode !== 'pill')
      return;

    const box = this._panelBoxes()[this._config.position];
    if (!box || !box.width)
      return;

    let others = 0;
    let child = box.get_first_child();
    while (child) {
      if (child !== this._button.container)
        others += child.width;
      child = child.get_next_sibling();
    }

    const avail = Math.max(0, box.width - others - 4);
    this._setPillWidth(Math.max(170, Math.min(PILL_WIDTH, avail)));
  }

  _setPillWidth(width) {
    if (width === this._pillWidth)
      return;

    this._pillWidth = width;
    this._pillBox.set_width(width);
    this._pillTitle.set_width(width >= PILL_WIDTH
      ? PILL_TITLE
      : Math.max(46, width - 124));
    this._layoutPill();
  }

  _layoutPill() {
    const width = this._pillWidth || PILL_WIDTH;
    const height = this._pillHeight || PILL_HEIGHT;

    this._pillTint.set_position(0, 0);
    this._pillTint.set_size(width, height);
    this._pillRow.set_position(0, 0);
    this._pillRow.set_size(width, height);
  }

  _place() {
    if (this._lastPosition === this._config.position && this._buttonAdded)
      return;
    this._lastPosition = this._config.position;

    if (!this._buttonAdded) {
      Main.panel.addToStatusArea(ROLE, this._button, -1, this._config.position);
      this._buttonAdded = true;
    } else {
      const container = this._button.container;
      const parent = container.get_parent();
      if (parent)
        parent.remove_child(container);
      this._panelBoxes()[this._config.position]?.insert_child_at_index(container, -1);
    }

    const box = this._panelBoxes()[this._config.position];
    if (box && box !== this._panelWidthBox) {
      if (this._panelWidthBox && this._panelWidthId)
        this._panelWidthBox.disconnect(this._panelWidthId);
      this._panelWidthBox = box;
      this._panelWidthId = box.connect('notify::width', () => this._fitPill());
    }

    this._applyPillHeight();
    this._fitPill();
  }

  applyConfig(config, relayout = true) {
    this._config = config;
    if (relayout)
      this._card?.close(false);
    this._applyMode();
    this._place();
    this._applyBackground();
  }

  _applyBackground() {
    const solid = this._config.cardBg === 'solid';
    const preset = presetById(this._config.cardBgColor);
    this._accent = solid ? hexToRgb(preset.accent) : this._albumAccent;
    this._applyAccent();
    this._card?.setBackground(this._config.cardBg, preset);
    this._card?.setAccent(this._albumAccent);
  }

  _drawTint(area) {
    if (this._config.cardBg === 'solid')
      return;

    const cr = area.get_context();
    const width = area.width;
    const height = area.height;
    if (!width || !height)
      return;

    const scale = surfaceScale(area, width);

    // Origin on the left edge behind the cover, fading out by ~55% so the
    // chip end stays dark.
    //
    // St clips children to the allocation rect, not the border radius, so we
    // clip here or the tint bleeds into the pill's rounded corners.
    roundedClip(cr, width * scale, height * scale, 13 * scale);

    drawRadialTint(cr, width, height, this._accent, {
      scale,
      originX: 0,
      originY: 0.5,
      radiusFactor: 0.55,
    });
  }

  _applyAccent() {
    const [r, g, b] = this._accent;
    const rgba = alpha => `rgba(${r},${g},${b},${alpha})`;
    const solid = this._config.cardBg === 'solid';
    const preset = presetById(this._config.cardBgColor);
    const bgStyle = solid
      ? `background-color: ${cssRgba(preset.bg, 0.94)}; `
      : '';

    this._pillBox.set_style(`${bgStyle}border-color: ${rgba(0.45)};`);
    // Only the sleep/duck state gets a chip surface; the countdown stays plain.
    this._pillSlotStateStyle =
      `background-color: ${rgba(0.18)}; border: 1px solid ${rgba(0.55)};` +
      ' box-shadow: 0 0 0 1px rgba(8,8,12,0.55);';
    this._pillSlotIcon.set_style(
      `color: ${rgba(0.95)}; icon-shadow: 0 0 2px rgba(8,8,12,0.75);`);
    this._syncSlotStyle();

    if (!this._pixbuf)
      this._pillCover.set_style(`background-color: ${rgba(0.35)};`);

    this._pillTint.visible = !solid;
    if (!solid)
      this._pillTint.queue_repaint();
  }

  _renderArt() {
    if (!this._pixbuf) {
      this._pillCover.set_content(null);
      this._applyAccent();
      return;
    }

    this._pillCover.set_style('');
    setArtImage(this._pillCover, this._pixbuf, 18, 5);
  }

  setArt(pixbuf) {
    if (this._destroyed)
      return;

    this._pixbuf = pixbuf;
    this._renderArt();
    this._card?.setArt(pixbuf);
  }

  setAccent(rgb) {
    if (this._destroyed)
      return;

    this._albumAccent = rgb;
    if (this._config.cardBg !== 'solid') {
      this._accent = rgb;
      this._applyAccent();
    }
    this._card?.setAccent(rgb);
  }

  setTrack(track) {
    if (this._destroyed)
      return;

    this._hasTrack = Boolean(track);
    this._pillTitle.text = track ? (track.title || _('Unknown')) : _('Nothing playing');
    this._position = 0;
    this._duration = track?.duration ?? 0;
    this._slotKind = null;
    this._updateSlot();
    this._card?.setTrack(track);
  }

  setPlaying(playing) {
    if (this._destroyed)
      return;

    this._playing = playing;
    if (playing)
      this._pillBox.remove_style_class_name('paused');
    else
      this._pillBox.add_style_class_name('paused');
    this._pillCover.set_opacity(playing ? 255 : 150);
    this._updateSlot();
    this._card?.setPlaying(playing);
  }

  setPosition(position, duration) {
    if (this._destroyed)
      return;

    this._position = position;
    this._duration = duration;
    this._updateSlot();
    this._card?.setPosition(position, duration);
  }

  setLyrics(lines, index) {
    if (this._destroyed)
      return;

    this._card?.setLyrics(lines, index);
  }

  setLyricsVisible(visible) {
    if (this._destroyed)
      return;

    this._card?.setLyricsVisible(visible);
  }

  setStats(stats) {
    if (this._destroyed)
      return;

    this._card?.setStats(stats);
  }

  setRepeat(mode) {
    if (this._destroyed)
      return;

    this._card?.setRepeat(mode);
  }

  setSleep(seconds) {
    if (this._destroyed)
      return;

    this._sleep = seconds;
    this._updateSlot();
  }

  setDuck(active) {
    if (this._destroyed)
      return;

    this._duck = active;
    this._updateSlot();
  }

  _syncSlotStyle() {
    if (!this._pillSlot)
      return;

    const state = this._slotKind === 'sleep' || this._slotKind === 'duck';
    this._pillSlot.remove_style_class_name('is-action');
    this._pillSlot.remove_style_class_name('is-state');
    this._pillSlot.add_style_class_name(state ? 'is-state' : 'is-action');
    this._pillSlot.set_style(state ? (this._pillSlotStateStyle ?? '') : '');
  }

  _slotContent() {
    if (this._sleep > 0)
      return {kind: 'sleep', icon: `${extensionDir()}/${MOON_ICON}`,
        text: formatClock(this._sleep)};

    if (this._duck)
      return {kind: 'duck', icon: 'audio-input-microphone-symbolic', text: _('Duck')};

    const left = Math.max(0, (this._duration || 0) - (this._position || 0));
    return {kind: 'countdown', icon: null, text: `-${formatClock(left)}`};
  }

  _applySlot({icon, text, kind}) {
    this._pillSlotIcon.visible = Boolean(icon);
    if (icon)
      this._pillSlotIcon.set_gicon(Gio.icon_new_for_string(icon));
    this._pillSlotText.text = text;
    this._pillSlot.visible = this._hasTrack;
    this._pillSlot.accessible_name = kind === 'sleep'
      ? _('Sleep timer %s, click to cancel').format(text)
      : kind === 'duck'
        ? _('Music is lowered while the microphone is active')
        : _('%s remaining').format(text);
    this._syncSlotStyle();
  }

  // Cross-fade only when the slot changes meaning, not every tick.
  _updateSlot() {
    if (this._destroyed || !this._pillSlot)
      return;

    const content = this._slotContent();
    this._pillSlot.visible = this._hasTrack;
    if (!this._hasTrack)
      return;

    if (content.kind === this._slotKind) {
      this._applySlot(content);
      return;
    }

    this._slotKind = content.kind;
    if (this._swapTimer) {
      GLib.source_remove(this._swapTimer);
      this._swapTimer = 0;
    }

    this._pillSlotText.ease({
      opacity: 0,
      duration: 120,
      mode: Clutter.AnimationMode.EASE_OUT_QUAD,
    });
    this._swapTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 130, () => {
      this._swapTimer = 0;
      this._applySlot(content);
      this._pillSlotText.ease({
        opacity: 255,
        duration: 120,
        mode: Clutter.AnimationMode.EASE_IN_QUAD,
      });
      return GLib.SOURCE_REMOVE;
    });
  }

  destroy() {
    this._destroyed = true;
    this._cancelOpen();

    if (this._swapTimer) {
      GLib.source_remove(this._swapTimer);
      this._swapTimer = 0;
    }
    if (this._fitIdleId) {
      GLib.source_remove(this._fitIdleId);
      this._fitIdleId = 0;
    }


    if (this._panelWidthBox && this._panelWidthId)
      this._panelWidthBox.disconnect(this._panelWidthId);
    this._panelWidthId = 0;
    this._panelWidthBox = null;

    const card = this._card;
    this._card = null;
    card?.destroy();
    this._button?.destroy();
    this._button = null;
  }
}
