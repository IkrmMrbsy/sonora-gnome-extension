import Clutter from 'gi://Clutter';
import St from 'gi://St';

import {ellipsize} from '../widgets.js';

const WINDOW_SIZE = 5;

// The lyrics panel that opens to the right of the card. Owns its own render
// state so the card only has to hand it the current line index.
export class LyricsPanel {
  constructor(width) {
    this.width = width;
    this._lines = [];
    this._index = -1;

    this.actor = new St.Widget({
      style_class: 'sonora-lyrics-panel',
      layout_manager: new Clutter.FixedLayout(),
      width: 0,
      clip_to_allocation: true,
      reactive: true,
      y_expand: true,
    });

    this._inner = new St.BoxLayout({
      vertical: true,
      style_class: 'sonora-lyrics-inner',
      width,
    });
    this.actor.add_child(this._inner);

    this._empty = new St.Label({
      text: 'No lyrics for this track',
      style_class: 'sonora-lyrics-empty',
    });
    this.actor.add_child(this._empty);
  }

  setLines(lines, index) {
    this._lines = Array.isArray(lines) ? lines : [];
    this._index = Number.isInteger(index) ? index : -1;
    this._render();
  }

  setIndex(index) {
    if (index === this._index)
      return false;
    this._index = index;
    this._render();
    return true;
  }

  get index() {
    return this._index;
  }

  get lines() {
    return this._lines;
  }

  layout(contentHeight) {
    this._inner.set_size(this.width, contentHeight);
    const [, innerHeight] = this._inner.get_preferred_height(this.width);
    this._inner.set_position(0, Math.max(0, Math.round((contentHeight - innerHeight) / 2)));
    this._empty.set_width(this.width);
    this._empty.set_position(0, Math.round(contentHeight / 2) - 8);
  }

  _render() {
    this._inner.destroy_all_children();

    if (!this._lines.length) {
      this._empty.visible = true;
      this._inner.visible = false;
      return;
    }

    this._empty.visible = false;
    this._inner.visible = true;

    let start = Math.max(0, this._index - 2);
    start = Math.min(start, Math.max(0, this._lines.length - WINDOW_SIZE));

    const end = Math.min(start + WINDOW_SIZE, this._lines.length);
    for (let i = start; i < end; i++) {
      const label = new St.Label({
        text: this._lines[i].text,
        style_class: 'sonora-lyric-line',
      });
      ellipsize(label);

      if (i === this._index)
        label.add_style_class_name('active');
      else if (i < this._index)
        label.add_style_class_name('past');
      else if (Math.abs(i - this._index) === 1)
        label.add_style_class_name('near');

      this._inner.add_child(label);
    }
  }
}
