import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Pango from 'gi://Pango';
import St from 'gi://St';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {ellipsize, formatWeek} from '../widgets.js';

function weekdayLabels() {
  const formatter = new Intl.DateTimeFormat(undefined, {weekday: 'short'});
  const monday = new Date(2024, 0, 1);
  return Array.from({length: 7}, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return formatter.format(date);
  });
}

const WEEKDAYS = weekdayLabels();

// The statistics drawer that opens below the card: week total, seven weekday
// bars, and two ranked lists.
export class StatsPanel {
  constructor() {
    this.actor = new St.Widget({
      style_class: 'sonora-stats-wrap',
      layout_manager: new Clutter.FixedLayout(),
      height: 0,
      clip_to_allocation: true,
      reactive: true,
      accessible_name: _('Listening statistics'),
    });

    this._box = new St.BoxLayout({
      orientation: Clutter.Orientation.VERTICAL,
      style_class: 'sonora-stats',
    });
    this._scroll = new St.ScrollView({
      style_class: 'sonora-stats-scroll',
      hscrollbar_policy: St.PolicyType.NEVER,
      vscrollbar_policy: St.PolicyType.AUTOMATIC,
      overlay_scrollbars: true,
      enable_mouse_scrolling: true,
      child: this._box,
    });

    const head = new St.BoxLayout({style_class: 'sonora-stats-head'});
    this._title = new St.Label({text: _('STATISTICS'), style_class: 'sonora-stats-title'});
    this._period = new St.Label({
      text: _('THIS WEEK'),
      style_class: 'sonora-stats-period',
      x_expand: true,
      x_align: Clutter.ActorAlign.END,
    });
    // These two are short, fixed labels. Leave ellipsizing off so Pango does
    // not trim them when the allocation matches their natural width.
    this._title.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    this._period.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
    head.add_child(this._title);
    head.add_child(this._period);

    this._weekTotal = new St.Label({text: '0m', style_class: 'sonora-week-total'});

    const sparkWrap = new St.BoxLayout({
      orientation: Clutter.Orientation.VERTICAL,
      style_class: 'sonora-spark-wrap',
    });
    this._spark = new St.BoxLayout({
      style_class: 'sonora-spark',
      accessible_name: _('Listening time per day'),
    });
    this._sparkDays = new St.BoxLayout({style_class: 'sonora-spark-days'});
    sparkWrap.add_child(this._spark);
    sparkWrap.add_child(this._sparkDays);

    this._grid = new St.BoxLayout({style_class: 'sonora-stats-grid', x_expand: true});

    this._artistsCol = new St.BoxLayout({
      orientation: Clutter.Orientation.VERTICAL,
      style_class: 'sonora-stats-col',
      x_expand: true,
    });
    this._tracksCol = new St.BoxLayout({
      orientation: Clutter.Orientation.VERTICAL,
      style_class: 'sonora-stats-col',
      x_expand: true,
    });

    this._artistsList = new St.BoxLayout({
      orientation: Clutter.Orientation.VERTICAL,
      style_class: 'sonora-stats-list',
    });
    this._tracksList = new St.BoxLayout({
      orientation: Clutter.Orientation.VERTICAL,
      style_class: 'sonora-stats-list',
    });

    this._artistsCol.add_child(new St.Label({
      text: _('TOP ARTISTS'),
      style_class: 'sonora-stats-coltitle',
    }));
    this._artistsCol.add_child(this._artistsList);

    this._tracksCol.add_child(new St.Label({
      text: _('TOP TRACKS'),
      style_class: 'sonora-stats-coltitle',
    }));
    this._tracksCol.add_child(this._tracksList);

    this._grid.add_child(this._artistsCol);
    this._grid.add_child(this._tracksCol);

    this._activeLabel = new St.Label({text: '', style_class: 'sonora-stats-active'});

    this._box.add_child(head);
    this._box.add_child(this._weekTotal);
    this._box.add_child(sparkWrap);
    this._box.add_child(this._grid);
    this._box.add_child(this._activeLabel);

    this.actor.add_child(this._scroll);
  }

  _setColumnWidths(innerWidth, gap) {
    const colWidth = Math.max(1, Math.round((innerWidth - gap) / 2));
    this._artistsCol.set_width(colWidth);
    this._tracksCol.set_width(colWidth);
  }

  setScrollable(scrollable) {
    this._scroll.vscrollbar_policy = scrollable
      ? St.PolicyType.AUTOMATIC
      : St.PolicyType.NEVER;
  }

  measure(x, width, gap) {
    const innerWidth = Math.max(1, width - x * 2);
    this._setColumnWidths(innerWidth, gap);
    this._box.set_width(innerWidth);
    this._box.set_height(-1);
    const [, natural] = this._box.get_preferred_height(innerWidth);
    return Math.max(1, natural);
  }

  // Position the inner box inside the drawer rectangle.
  layout(x, y, width, height, gap) {
    this.actor.set_position(0, y);
    this.actor.set_size(width, height);

    const innerWidth = Math.max(1, width - x * 2);
    const visibleHeight = height > 0 ? height : 1;

    this._setColumnWidths(innerWidth, gap);
    this._box.set_width(innerWidth);
    this._box.set_height(-1);
    this._scroll.set_position(x, 0);
    this._scroll.set_size(innerWidth, visibleHeight);
  }

  applyAccent([r, g, b]) {
    this._spark.set_style(`color: rgb(${r},${g},${b});`);
  }

  setStats(stats) {
    if (!stats)
      return;

    const days = stats.days ?? [];
    const max = Math.max(1, ...days.map(day => day.seconds));

    this._weekTotal.text = formatWeek(stats.weekSeconds ?? 0);

    this._spark.destroy_all_children();
    this._sparkDays.destroy_all_children();

    for (const [i, day] of days.entries()) {
      const bar = new St.Widget({
        style_class: 'sonora-spark-bar',
        x_expand: true,
        y_align: Clutter.ActorAlign.END,
        height: day.seconds > 0 ? Math.max(3, Math.round(day.seconds / max * 34)) : 2,
      });
      if (day.isToday)
        bar.add_style_class_name('today');
      if (!(day.seconds > 0))
        bar.add_style_class_name('empty');
      this._spark.add_child(bar);

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

    this._renderList(this._artistsList, stats.artists ?? [],
      entry => formatWeek(entry.seconds));
    this._renderList(this._tracksList, stats.tracks ?? [],
      entry => `${entry.plays}\u00d7`);

    const active = stats.activeDays ?? 0;
    this._activeLabel.clutter_text.set_markup(
      _('<b>%s of 7</b> days active').format(active));
  }

  _renderList(host, entries, formatValue) {
    host.destroy_all_children();

    entries.slice(0, 5).forEach((entry, i) => {
      const row = new St.BoxLayout({style_class: 'sonora-stat-row', x_expand: true});

      const rank = new St.Label({text: `${i + 1}`, style_class: 'sonora-stat-rank'});
      rank.set_width(9);

      const name = new St.Label({
        text: entry.name ?? entry.title ?? '',
        style_class: 'sonora-stat-name',
        x_expand: true,
      });
      ellipsize(name);

      const value = new St.Label({
        text: formatValue(entry),
        style_class: 'sonora-stat-value',
      });
      value.set_x_align(Clutter.ActorAlign.END);

      row.add_child(rank);
      row.add_child(name);
      row.add_child(value);
      host.add_child(row);
    });
  }
}
