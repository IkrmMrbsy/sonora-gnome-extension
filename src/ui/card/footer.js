import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {extensionDir} from '../../util/path.js';
import {ellipsize, formatWeek} from '../widgets.js';

// "This week 3h 12m · top Artist" plus the streak counters.
export class CardFooter {
  constructor() {
    this.actor = new St.BoxLayout({style_class: 'sonora-foot'});

    this._icon = new St.Icon({
      icon_name: 'audio-x-generic-symbolic',
      icon_size: 14,
      style_class: 'sonora-foot-icon',
      y_align: Clutter.ActorAlign.CENTER,
    });

    this._label = new St.Label({
      text: 'This week 0m',
      style_class: 'sonora-foot-label',
      x_expand: true,
      y_align: Clutter.ActorAlign.CENTER,
    });
    ellipsize(this._label);

    const stats = new St.BoxLayout({style_class: 'sonora-foot-stats', y_align: Clutter.ActorAlign.CENTER});

    const streak = new St.BoxLayout({style_class: 'sonora-streak', y_align: Clutter.ActorAlign.CENTER});
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
    streak.add_child(this._flame);
    streak.add_child(this._streakLabel);

    this._bestLabel = new St.Label({
      text: '',
      style_class: 'sonora-best-label',
      y_align: Clutter.ActorAlign.CENTER,
    });

    stats.add_child(streak);
    stats.add_child(this._bestLabel);

    this.actor.add_child(this._icon);
    this.actor.add_child(this._label);
    this.actor.add_child(stats);
  }

  setStats(stats) {
    const seconds = stats?.weekSeconds ?? 0;
    const top = stats?.topArtist ?? '';
    const week = `<b>${GLib.markup_escape_text(formatWeek(seconds), -1)}</b>`;
    const text = top
      ? `This week ${week} · top <b>${GLib.markup_escape_text(top, -1)}</b>`
      : `This week ${week}`;
    this._label.clutter_text.set_markup(text);

    const current = stats?.streak ?? 0;
    const best = stats?.bestStreak ?? 0;

    this._streakLabel.get_parent().visible = current > 0;
    this._streakLabel.text = `${current}d`;
    this._bestLabel.visible = best > 0;
    this._bestLabel.clutter_text.set_markup(
      `best <b>${GLib.markup_escape_text(String(best), -1)}d</b>`);
  }

  applyAccent([r, g, b], rgba) {
    this._icon.set_style(`color: rgb(${r},${g},${b}); icon-shadow: 0 0 2px ${rgba(0.75)};`);
    this._flame.set_style('icon-shadow: 0 0 3px rgba(255,120,20,0.85);');
  }
}
