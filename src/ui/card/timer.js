import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {progressGeometry} from '../geometry.js';
import {formatClock} from '../widgets.js';

const BAR_HEIGHT = 3;
const BAR_Y = 6;

// Elapsed/total labels and the seekable progress bar.
export class CardTimer {
  constructor(callbacks = {}) {
    this._callbacks = callbacks;
    this._position = 0;
    this._duration = 0;
    this._seeking = false;
    this._stageEventId = 0;

    this.actor = new St.BoxLayout({
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

    this._track = new St.Widget({
      style_class: 'sonora-bar-track',
      height: BAR_HEIGHT,
      width: 0,
    });
    this._track.set_position(0, BAR_Y);

    this._fill = new St.Widget({
      style_class: 'sonora-bar-fill',
      height: BAR_HEIGHT,
      width: 0,
    });
    this._fill.set_position(0, BAR_Y);

    this._knob = new St.Widget({style_class: 'sonora-bar-knob', width: 9, height: 9});

    this._bar.add_child(this._track);
    this._bar.add_child(this._fill);
    this._bar.add_child(this._knob);

    this._bar.connect('button-press-event', (actor, event) => {
      if (event.get_button() !== 1)
        return Clutter.EVENT_PROPAGATE;
      this._startSeeking();
      this._seekFromEvent(event);
      return Clutter.EVENT_STOP;
    });

    this._bar.connect('motion-event', (actor, event) => {
      if (!this._seeking)
        return Clutter.EVENT_PROPAGATE;
      if (!(event.get_state() & Clutter.ModifierType.BUTTON1_MASK)) {
        this._finishSeeking();
        return Clutter.EVENT_PROPAGATE;
      }
      this._seekFromEvent(event);
      return Clutter.EVENT_STOP;
    });

    this._bar.connect('button-release-event', () => {
      this._finishSeeking();
      return Clutter.EVENT_STOP;
    });

    this.actor.add_child(this._cur);
    this.actor.add_child(this._bar);
    this.actor.add_child(this._dur);
  }

  get seeking() {
    return this._seeking;
  }

  destroy() {
    this._finishSeeking();
  }

  _startSeeking() {
    if (this._seeking)
      return;

    this._seeking = true;
    this._bar.add_style_class_name('dragging');
    this._stageEventId = global.stage.connect('captured-event', (actor, event) => {
      if (event.type() !== Clutter.EventType.BUTTON_RELEASE ||
          event.get_button() !== 1)
        return Clutter.EVENT_PROPAGATE;

      this._finishSeeking();
      return Clutter.EVENT_PROPAGATE;
    });
  }

  _finishSeeking() {
    this._seeking = false;
    this._bar.remove_style_class_name('dragging');
    if (this._stageEventId) {
      global.stage.disconnect(this._stageEventId);
      this._stageEventId = 0;
    }
  }

  setPosition(position, duration) {
    this._position = position;
    this._duration = duration;
    if (!this._seeking)
      this.render();
  }

  reset() {
    this._position = 0;
    this._duration = 0;
    this.render();
  }

  render() {
    const {width, fillWidth, knobX} = progressGeometry(
      this.actor.width, this._cur.width, this._dur.width,
      this._position, this._duration, this._knob.width || 9);

    this._track.set_width(width);
    this._fill.set_width(fillWidth);
    this._knob.set_position(knobX, 2);
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
    this.render();
    this._callbacks.onSeek?.(Math.round(pct * this._duration * 1e6));
  }
}
