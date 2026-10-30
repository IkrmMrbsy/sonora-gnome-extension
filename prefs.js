import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {getSettings} from './src/core/settings.js';

const MODES = [['icon', 'Ikon saja'], ['pill', 'Cover + judul + status']];
const POSITIONS = [['left', 'Kiri'], ['center', 'Tengah'], ['right', 'Kanan']];
const CARD_OPEN = [['hover', 'Saat kursor diarahkan'], ['click', 'Hanya saat diklik'],
  ['both', 'Kursor atau klik']];
const DUCK_MODES = [['off', 'Jangan ganggu musik'], ['duck', 'Kecilkan volume'],
  ['pause', 'Jeda sampai mikrofon selesai']];
const DUCK_LEVELS = [[10, '10%'], [20, '20%'], [30, '30%'], [40, '40%'],
  [50, '50%'], [60, '60%'], [70, '70%']];
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


export default class SonoraPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = getSettings();

    const page = new Adw.PreferencesPage();
    window.add(page);

    const about = new Adw.PreferencesGroup({
      title: 'Sonora',
      description: 'The music companion for GNOME.',
    });
    page.add(about);

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

    const card = new Adw.PreferencesGroup({
      title: 'Kartu',
      description: 'Kapan kartu now playing muncul, dan seberapa cepat.',
    });
    page.add(card);

    const cardOpen = comboRow(CARD_OPEN);
    cardOpen.title = 'Kartu terbuka';
    bindString(settings, 'card-open', cardOpen, CARD_OPEN, window);
    card.add(cardOpen);

    const hoverDelay = new Adw.SpinRow({
      title: 'Jeda sebelum terbuka',
      subtitle: 'Mili-detik setelah kursor berhenti di indikator',
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 2000,
        step_increment: 50,
        page_increment: 100,
      }),
    });
    settings.bind('hover-delay', hoverDelay, 'value', 0);
    card.add(hoverDelay);

    const behavior = new Adw.PreferencesGroup({title: 'Perilaku'});
    page.add(behavior);

    const lyrics = new Adw.SwitchRow({
      title: 'Tampilkan lirik',
      subtitle: 'Lirik tersinkron di kartu now playing',
    });
    bindBool(settings, 'lyrics-visible', lyrics);
    behavior.add(lyrics);

    const sleep = comboRow(SLEEP);
    sleep.title = 'Sleep timer';
    sleep.subtitle = 'Musik di-fade lalu pause setelah durasi ini';
    bindInt(settings, 'sleep-minutes', sleep, SLEEP, window);
    behavior.add(sleep);

    const mic = new Adw.PreferencesGroup({
      title: 'Mikrofon',
      description: 'Apa yang terjadi saat aplikasi lain memakai mikrofon.',
    });
    page.add(mic);

    const duckMode = comboRow(DUCK_MODES);
    duckMode.title = 'Saat mikrofon dipakai';
    bindString(settings, 'duck-mode', duckMode, DUCK_MODES, window);
    mic.add(duckMode);

    const duckLevel = comboRow(DUCK_LEVELS);
    duckLevel.title = 'Volume saat dikecilkan';
    duckLevel.subtitle = 'Persentase dari volume semula';
    bindInt(settings, 'duck-level', duckLevel, DUCK_LEVELS, window);
    mic.add(duckLevel);

    const syncDuckLevel = () => {
      duckLevel.sensitive = settings.get_string('duck-mode') === 'duck';
    };
    syncDuckLevel();
    const duckId = settings.connect('changed::duck-mode', syncDuckLevel);
    window.connect('close-request', () => settings.disconnect(duckId));

    window.set_default_size(520, 640);
  }
}
