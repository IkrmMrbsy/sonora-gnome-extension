import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {getSettings} from './config.js';

const MODES = [['icon', 'Ikon saja'], ['pill', 'Cover + judul + status']];
const POSITIONS = [['left', 'Kiri'], ['center', 'Tengah'], ['right', 'Kanan']];
const SLEEP = [[0, 'Nonaktif'], [15, '15 menit'], [30, '30 menit'],
  [45, '45 menit'], [60, '60 menit']];

function comboRow(entries) {
  return new Adw.ComboRow({
    title: '',
    model: Gtk.StringList.new(entries.map(([, label]) => label)),
  });
}

function bindString(settings, key, row, entries, window) {
  row.selected = Math.max(0, entries.findIndex(([value]) => value === settings.get_string(key)));
  row.connect('notify::selected', () => settings.set_string(key, entries[row.selected][0]));
  const id = settings.connect(`changed::${key}`, () => {
    row.selected = Math.max(0, entries.findIndex(([value]) => value === settings.get_string(key)));
  });
  window.connect('close-request', () => settings.disconnect(id));
}

function bindInt(settings, key, row, entries, window) {
  row.selected = Math.max(0, entries.findIndex(([value]) => value === settings.get_int(key)));
  row.connect('notify::selected', () => settings.set_int(key, entries[row.selected][0]));
  const id = settings.connect(`changed::${key}`, () => {
    row.selected = Math.max(0, entries.findIndex(([value]) => value === settings.get_int(key)));
  });
  window.connect('close-request', () => settings.disconnect(id));
}

function bindBool(settings, key, row) {
  settings.bind(key, row, 'active', 0);
}

export default class CadencePreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = getSettings();

    const page = new Adw.PreferencesPage();
    window.add(page);

    const look = new Adw.PreferencesGroup({title: 'Tampilan'});
    page.add(look);

    const mode = comboRow(MODES);
    mode.title = 'Indikator panel';
    bindString(settings, 'mode', mode, MODES, window);
    look.add(mode);

    const position = comboRow(POSITIONS);
    position.title = 'Posisi';
    bindString(settings, 'position', position, POSITIONS, window);
    look.add(position);

    const behavior = new Adw.PreferencesGroup({title: 'Perilaku'});
    page.add(behavior);

    const lyrics = new Adw.SwitchRow({
      title: 'Tampilkan lirik',
      subtitle: 'Lirik tersinkron di kartu now playing',
    });
    bindBool(settings, 'lyrics-visible', lyrics);
    behavior.add(lyrics);

    const duck = new Adw.SwitchRow({
      title: 'Kecilkan musik saat mikrofon dipakai',
      subtitle: 'Volume diturunkan sementara ke 30%',
    });
    bindBool(settings, 'duck-enabled', duck);
    behavior.add(duck);

    const sleep = comboRow(SLEEP);
    sleep.title = 'Sleep timer';
    sleep.subtitle = 'Musik di-fade lalu pause setelah durasi ini';
    bindInt(settings, 'sleep-minutes', sleep, SLEEP, window);
    behavior.add(sleep);

    window.set_default_size(520, 460);
  }
}
