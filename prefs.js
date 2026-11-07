import Adw from 'gi://Adw';
import Cairo from 'gi://cairo';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {getSettings} from './src/core/settings.js';
import {extensionDir} from './src/util/path.js';
import {
  BACKGROUND_PRESETS,
  hexToRgb,
  presetById,
} from './src/util/palette.js';

const MODES = [['icon', 'Ikon saja'], ['pill', 'Cover + judul + status']];
const POSITIONS = [['left', 'Kiri'], ['center', 'Tengah'], ['right', 'Kanan']];
const BG_MODES = [['album', 'Ikuti warna album'], ['solid', 'Warna solid']];
const CARD_OPEN = [['hover', 'Saat kursor diarahkan'], ['click', 'Hanya saat diklik'],
  ['both', 'Kursor atau klik']];
const DUCK_MODES = [['off', 'Jangan ganggu musik'], ['duck', 'Kecilkan volume'],
  ['pause', 'Jeda sampai mikrofon selesai']];
const DUCK_LEVELS = [[10, '10%'], [20, '20%'], [30, '30%'], [40, '40%'],
  [50, '50%'], [60, '60%'], [70, '70%']];
const SLEEP = [[0, 'Nonaktif'], [15, '15 menit'], [30, '30 menit'],
  [45, '45 menit'], [60, '60 menit']];

const PREVIEW_ACCENT = [255, 77, 109];
const PRESET_DOT_CSS = BACKGROUND_PRESETS.map(preset => `
.sonora-dot-${preset.id} {
  background-color: ${preset.bg};
  border: 1px solid ${preset.accent};
}`).join('');

const CSS = `
.sonora-hero {
  background-image: linear-gradient(135deg, alpha(@accent_bg_color, 0.22),
    alpha(@window_bg_color, 0.88));
  border: 1px solid alpha(@accent_bg_color, 0.28);
  border-radius: 18px;
  padding: 20px;
}
.sonora-eyebrow {
  font-size: 9px;
  font-weight: 800;
  opacity: 0.55;
}
.sonora-hero-title {
  font-size: 20px;
  font-weight: 800;
}
.sonora-hero-sub {
  font-size: 11px;
  opacity: 0.72;
}
.sonora-field-title {
  font-size: 12px;
  font-weight: 700;
}
.sonora-field-hint {
  font-size: 10px;
  opacity: 0.65;
}
.sonora-swatch {
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid alpha(@window_fg_color, 0.12);
  background-color: alpha(@window_fg_color, 0.06);
}
.sonora-swatch:hover {
  background-color: alpha(@window_fg_color, 0.12);
}
.sonora-swatch:checked {
  border-color: @accent_bg_color;
  background-color: alpha(@accent_bg_color, 0.22);
}
.sonora-swatch-dot {
  border-radius: 999px;
}
${PRESET_DOT_CSS}
`;

let cssLoaded = false;

function loadCss() {
  if (cssLoaded)
    return;

  const provider = new Gtk.CssProvider();
  provider.load_from_string(CSS);
  Gtk.StyleContext.add_provider_for_display(
    Gdk.Display.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
  cssLoaded = true;
}

function icon(name) {
  return new Gtk.Image({icon_name: name, pixel_size: 16});
}

function addIcon(row, name) {
  row.add_prefix(icon(name));
  return row;
}

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

function roundedPath(cr, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  cr.newPath();
  cr.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
  cr.arc(x + width - r, y + r, r, 1.5 * Math.PI, 2 * Math.PI);
  cr.arc(x + width - r, y + height - r, r, 0, 0.5 * Math.PI);
  cr.arc(x + r, y + height - r, r, 0.5 * Math.PI, Math.PI);
  cr.closePath();
}

function fillRounded(cr, x, y, width, height, radius, rgb, alpha = 1) {
  roundedPath(cr, x, y, width, height, radius);
  cr.setSourceRGBA(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, alpha);
  cr.fill();
}

function strokeRounded(cr, x, y, width, height, radius, rgb, alpha = 1) {
  roundedPath(cr, x, y, width, height, radius);
  cr.setSourceRGBA(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, alpha);
  cr.setLineWidth(1);
  cr.stroke();
}

function drawGlow(cr, x, y, width, height, radius, rgb, alpha = 0.42) {
  fillRounded(cr, x, y, width, height, radius, [13, 13, 18], 0.96);

  cr.save();
  roundedPath(cr, x, y, width, height, radius);
  cr.clip();

  const cx = x + width * 0.12;
  const cy = y + height * 0.5;
  const gradient = new Cairo.RadialGradient(
    cx, cy, 0, cx, cy, Math.max(width, height) * 0.85);
  gradient.addColorStopRGBA(0, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, alpha);
  gradient.addColorStopRGBA(0.55, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, alpha * 0.35);
  gradient.addColorStopRGBA(1, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 0);
  cr.setSource(gradient);
  cr.paint();
  cr.restore();
}

function drawText(cr, text, x, y, size, bold, rgb, alpha = 1, maxWidth = 0) {
  const layout = PangoCairo.create_layout(cr);
  const desc = new Pango.FontDescription();
  desc.set_family('Sans');
  desc.set_absolute_size(size * Pango.SCALE);
  if (bold)
    desc.set_weight(Pango.Weight.BOLD);
  layout.set_font_description(desc);
  layout.set_text(text, -1);
  if (maxWidth > 0) {
    layout.set_width(Math.round(maxWidth * Pango.SCALE));
    layout.set_ellipsize(Pango.EllipsizeMode.END);
  }

  cr.save();
  cr.setSourceRGBA(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, alpha);
  cr.moveTo(x, y);
  PangoCairo.show_layout(cr, layout);
  cr.restore();
}

function drawPreview(area, cr, width, height, settings) {
  const solid = settings.get_string('card-bg') === 'solid';
  const preset = presetById(settings.get_string('card-bg-color'));
  const accent = solid ? hexToRgb(preset.accent) : PREVIEW_ACCENT;
  const bg = solid ? hexToRgb(preset.bg) : [13, 13, 18];

  const pillWidth = Math.min(224, width - 32);
  const pillHeight = 26;
  const pillX = (width - pillWidth) / 2;
  const pillY = 6;

  if (solid)
    fillRounded(cr, pillX, pillY, pillWidth, pillHeight, 13, bg, 0.96);
  else
    drawGlow(cr, pillX, pillY, pillWidth, pillHeight, 13, accent, 0.48);
  strokeRounded(cr, pillX, pillY, pillWidth, pillHeight, 13, accent, 0.45);
  fillRounded(cr, pillX + 8, pillY + 4, 18, 18, 5, accent, 0.92);
  drawText(cr, 'Blinding Lights', pillX + 34, pillY + 6, 11, true,
    [246, 245, 244], 0.96, pillWidth - 90);
  drawText(cr, '-3:10', pillX + pillWidth - 46, pillY + 7, 10, false,
    [246, 245, 244], 0.62);

  const cardWidth = Math.min(268, width - 32);
  const cardX = (width - cardWidth) / 2;
  const cardY = pillY + pillHeight + 14;
  const cardHeight = Math.max(0, height - cardY - 8);

  if (solid)
    fillRounded(cr, cardX, cardY, cardWidth, cardHeight, 18, bg, 0.96);
  else
    drawGlow(cr, cardX, cardY, cardWidth, cardHeight, 18, accent, 0.40);
  strokeRounded(cr, cardX, cardY, cardWidth, cardHeight, 18, accent, 0.38);

  fillRounded(cr, cardX + 12, cardY + 12, 40, 40, 10, accent, 0.90);
  drawText(cr, 'Blinding Lights', cardX + 60, cardY + 16, 13, true,
    [246, 245, 244], 0.98, cardWidth - 76);
  drawText(cr, 'The Weeknd · After Hours', cardX + 60, cardY + 35, 10, false,
    [246, 245, 244], 0.55, cardWidth - 76);

  const barX = cardX + 12;
  const barY = cardY + cardHeight - 18;
  const barWidth = cardWidth - 24;
  fillRounded(cr, barX, barY, barWidth, 3, 2, [246, 245, 244], 0.14);
  fillRounded(cr, barX, barY, barWidth * 0.42, 3, 2, [246, 245, 244], 0.82);
}

function buildPresetPicker(settings) {
  const flow = new Gtk.FlowBox({
    selection_mode: Gtk.SelectionMode.NONE,
    column_spacing: 8,
    row_spacing: 8,
    max_children_per_line: 4,
  });

  const buttons = new Map();
  let syncing = false;

  for (const preset of BACKGROUND_PRESETS) {
    const content = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 8,
      valign: Gtk.Align.CENTER,
    });

    const dot = new Gtk.Box({halign: Gtk.Align.CENTER, valign: Gtk.Align.CENTER});
    dot.set_size_request(16, 16);
    dot.add_css_class('sonora-swatch-dot');
    dot.add_css_class(`sonora-dot-${preset.id}`);

    const label = new Gtk.Label({label: preset.label, xalign: 0});
    content.append(dot);
    content.append(label);

    const button = new Gtk.ToggleButton({child: content});
    button.add_css_class('sonora-swatch');
    button.set_tooltip_text(`${preset.label} — ${preset.bg}`);

    button.connect('toggled', () => {
      if (syncing)
        return;

      if (!button.active) {
        syncing = true;
        button.active = true;
        syncing = false;
        return;
      }

      syncing = true;
      for (const [id, other] of buttons) {
        if (id !== preset.id)
          other.active = false;
      }
      syncing = false;
      settings.set_string('card-bg-color', preset.id);
    });

    buttons.set(preset.id, button);
    flow.append(button);
  }

  const sync = () => {
    syncing = true;
    const activeId = presetById(settings.get_string('card-bg-color')).id;
    for (const [id, button] of buttons)
      button.active = id === activeId;
    syncing = false;
  };

  return {flow, sync};
}

function buildHero(settings) {
  const hero = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 20,
    hexpand: true,
  });
  hero.add_css_class('sonora-hero');

  const text = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
    hexpand: true,
    valign: Gtk.Align.CENTER,
  });

  const eyebrow = new Gtk.Label({label: 'SONORA', xalign: 0});
  eyebrow.add_css_class('sonora-eyebrow');

  const title = new Gtk.Label({
    label: 'The music companion for GNOME.',
    xalign: 0,
    wrap: true,
  });
  title.add_css_class('sonora-hero-title');

  const subtitle = new Gtk.Label({
    label: 'Panel now playing, lirik tersinkron, dan statistik mendengarkan — tanpa login.',
    xalign: 0,
    wrap: true,
  });
  subtitle.add_css_class('sonora-hero-sub');

  text.append(eyebrow);
  text.append(title);
  text.append(subtitle);

  const preview = new Gtk.DrawingArea();
  preview.set_content_width(300);
  preview.set_content_height(160);
  preview.set_valign(Gtk.Align.CENTER);
  preview.set_draw_func((area, cr, width, height) => {
    drawPreview(area, cr, width, height, settings);
  });

  hero.append(text);
  hero.append(preview);

  return {hero, preview};
}

export default class SonoraPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    loadCss();

    const settings = getSettings();

    const page = new Adw.PreferencesPage();
    window.add(page);

    const heroGroup = new Adw.PreferencesGroup();
    page.add(heroGroup);

    const {hero, preview} = buildHero(settings);
    heroGroup.add(hero);

    const look = new Adw.PreferencesGroup({
      title: 'Tampilan',
      description: 'Atur indikator panel dan latar kartu now playing.',
    });
    page.add(look);

    const mode = comboRow(MODES);
    mode.title = 'Indikator panel';
    mode.subtitle = 'Ikon ringkas atau cover lengkap dengan judul.';
    addIcon(mode, 'video-display-symbolic');
    bindString(settings, 'mode', mode, MODES, window);
    look.add(mode);

    const position = comboRow(POSITIONS);
    position.title = 'Posisi';
    position.subtitle = 'Tempat indikator bersandar di panel atas.';
    addIcon(position, 'view-grid-symbolic');
    bindString(settings, 'position', position, POSITIONS, window);
    look.add(position);

    const cardBg = comboRow(BG_MODES);
    cardBg.title = 'Latar kartu & pill';
    cardBg.subtitle = 'Ikuti warna album, atau pakai warna solid.';
    addIcon(cardBg, 'preferences-desktop-theme-symbolic');
    bindString(settings, 'card-bg', cardBg, BG_MODES, window);
    look.add(cardBg);

    const picker = buildPresetPicker(settings);
    const presetSection = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 8,
      margin_top: 6,
      margin_bottom: 6,
    });

    const presetTitle = new Gtk.Label({label: 'Warna latar', xalign: 0});
    presetTitle.add_css_class('sonora-field-title');
    const presetHint = new Gtk.Label({
      label: 'Preset ini aktif saat latar memakai warna solid.',
      xalign: 0,
      wrap: true,
    });
    presetHint.add_css_class('sonora-field-hint');

    presetSection.append(presetTitle);
    presetSection.append(picker.flow);
    presetSection.append(presetHint);
    look.add(presetSection);

    const cardOpen = comboRow(CARD_OPEN);
    cardOpen.title = 'Kartu terbuka';
    cardOpen.subtitle = 'Kapan kartu now playing muncul.';
    addIcon(cardOpen, 'input-mouse-symbolic');
    bindString(settings, 'card-open', cardOpen, CARD_OPEN, window);
    look.add(cardOpen);

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
    addIcon(hoverDelay, 'preferences-system-time-symbolic');
    settings.bind('hover-delay', hoverDelay, 'value', 0);
    look.add(hoverDelay);

    const behavior = new Adw.PreferencesGroup({
      title: 'Perilaku',
      description: 'Lirik dan pengatur waktu pemutaran.',
    });
    page.add(behavior);

    const lyrics = new Adw.SwitchRow({
      title: 'Tampilkan lirik',
      subtitle: 'Lirik tersinkron di kartu now playing',
    });
    addIcon(lyrics, 'audio-x-generic-symbolic');
    bindBool(settings, 'lyrics-visible', lyrics);
    behavior.add(lyrics);

    const sleep = comboRow(SLEEP);
    sleep.title = 'Sleep timer';
    sleep.subtitle = 'Musik di-fade lalu pause setelah durasi ini';
    addIcon(sleep, 'weather-clear-night-symbolic');
    bindInt(settings, 'sleep-minutes', sleep, SLEEP, window);
    behavior.add(sleep);

    const mic = new Adw.PreferencesGroup({
      title: 'Mikrofon',
      description: 'Apa yang terjadi saat aplikasi lain memakai mikrofon.',
    });
    page.add(mic);

    const duckMode = comboRow(DUCK_MODES);
    duckMode.title = 'Saat mikrofon dipakai';
    addIcon(duckMode, 'audio-input-microphone-symbolic');
    bindString(settings, 'duck-mode', duckMode, DUCK_MODES, window);
    mic.add(duckMode);

    const duckLevel = comboRow(DUCK_LEVELS);
    duckLevel.title = 'Volume saat dikecilkan';
    duckLevel.subtitle = 'Persentase dari volume semula';
    addIcon(duckLevel, 'audio-volume-medium-symbolic');
    bindInt(settings, 'duck-level', duckLevel, DUCK_LEVELS, window);
    mic.add(duckLevel);

    const about = new Adw.PreferencesGroup({title: 'Tentang'});
    page.add(about);

    const aboutRow = new Adw.ActionRow({
      title: 'Sonora',
      subtitle: 'The music companion for GNOME. Data tetap lokal, tanpa login.',
    });
    const flame = Gio.icon_new_for_string(
      `${extensionDir()}/icons/sonora-flame-symbolic.svg`);
    aboutRow.add_prefix(new Gtk.Image({gicon: flame, pixel_size: 28}));
    about.add(aboutRow);

    const syncDuckLevel = () => {
      duckLevel.sensitive = settings.get_string('duck-mode') === 'duck';
    };
    syncDuckLevel();

    const refresh = () => {
      const solid = settings.get_string('card-bg') === 'solid';
      presetSection.sensitive = solid;
      picker.sync();
      preview.queue_draw();
    };
    refresh();

    const ids = [
      settings.connect('changed::card-bg', refresh),
      settings.connect('changed::card-bg-color', refresh),
      settings.connect('changed::duck-mode', syncDuckLevel),
    ];
    window.connect('close-request', () => {
      for (const id of ids)
        settings.disconnect(id);
    });

    window.set_default_size(720, 820);
  }
}
