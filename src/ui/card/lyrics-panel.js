import Clutter from 'gi://Clutter';
import Pango from 'gi://Pango';
import St from 'gi://St';

const WINDOW_SIZE = 5;
const SIDE_PADDING = 16;

// The lyrics panel that opens to the right of the card. Owns its own render
// state so the card only has to hand it the current line index.
export class LyricsPanel {
  constructor(width) {
    this.width = width;
    this._lines = [];
    this._index = -1;
    this._contentHeight = 0;
    this._layoutHeight = -1;

    this.actor = new St.Widget({
      style_class: 'sonora-lyrics-panel',
      layout_manager: new Clutter.FixedLayout(),
      width: 0,
      clip_to_allocation: true,
      reactive: true,
      y_expand: true,
    });

    this._divider = new St.Widget({
      style_class: 'sonora-lyrics-divider',
      width: 1,
      height: 0,
    });
    this.actor.add_child(this._divider);

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
    this._contentHeight = contentHeight;
    if (contentHeight !== this._layoutHeight) {
      this._layoutHeight = contentHeight;
      this._render();
    }

    const dividerHeight = Math.max(0, Math.round(contentHeight / 2));
    this._divider.set_size(1, dividerHeight);
    this._divider.set_position(0, Math.max(0, Math.round((contentHeight - dividerHeight) / 2)));

    const innerWidth = Math.max(1, this.width - SIDE_PADDING * 2);
    this._inner.set_size(innerWidth, contentHeight);
    const [, innerHeight] = this._inner.get_preferred_height(innerWidth);
    this._inner.set_position(SIDE_PADDING,
      Math.max(0, Math.round((contentHeight - innerHeight) / 2)));
    this._empty.set_width(innerWidth);
    this._empty.set_position(SIDE_PADDING, Math.round(contentHeight / 2) - 8);
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

    const count = this._lines.length;
    const innerWidth = Math.max(1, this.width - SIDE_PADDING * 2);

    let start = this._index < 0
      ? 0
      : Math.max(0, Math.min(this._index - 2, count - WINDOW_SIZE));
    const end = Math.min(start + WINDOW_SIZE, count);

    const rows = [];
    for (let i = start; i < end; i++) {
      const label = new St.Label({
        text: this._lines[i].text,
        style_class: 'sonora-lyric-line',
      });
      label.clutter_text.line_wrap = true;
      label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
      label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
      label.set_width(innerWidth);

      this._styleLine(label, i);
      this._inner.add_child(label);
      rows.push({index: i, actor: label});
    }

    this._fitRows(rows, innerWidth);
  }

  _styleLine(label, index) {
    if (index === this._index)
      label.add_style_class_name('active');
    else if (index < this._index)
      label.add_style_class_name('past');
    else if (Math.abs(index - this._index) === 1)
      label.add_style_class_name('near');
  }

  // Long lyrics wrap instead of being ellipsized. When the wrapped block is
  // taller than the panel, drop the lines farthest from the active one until
  // the rest fit without clipping.
  _fitRows(rows, innerWidth) {
    if (!(this._contentHeight > 0))
      return;

    const reference = this._index < 0 ? 0 : this._index;
    const tooTall = () =>
      this._inner.get_preferred_height(innerWidth)[1] > this._contentHeight;

    while (rows.length > 1 && tooTall()) {
      const first = rows[0];
      const last = rows[rows.length - 1];
      const dropLast = Math.abs(last.index - reference) >=
        Math.abs(first.index - reference);
      const row = dropLast ? rows.pop() : rows.shift();
      this._inner.remove_child(row.actor);
      row.actor.destroy();
    }
  }
}
