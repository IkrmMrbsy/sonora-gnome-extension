import Adw from 'gi://Adw';
import Cairo from 'gi://cairo';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Pango from 'gi://Pango';
import PangoCairo from 'gi://PangoCairo';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {getSettings} from './src/core/settings.js';
import {extensionDir} from './src/util/path.js';
import {
  BACKGROUND_PRESETS,
  hexToRgb,
  presetById,
} from './src/util/palette.js';

const getModes = () => [['icon', _('Icon only')], ['pill', _('Cover, title and status')]];
const getPositions = () => [['left', _('Left')], ['center', _('Center')], ['right', _('Right')]];
const getBgModes = () => [['album', _('Follow album color')], ['solid', _('Solid preset')]];
const getCardOpen = () => [
  ['hover', _('On hover')],
  ['click', _('On click only')],
  ['both', _('Hover or click')],
];
const getDuckModes = () => [
  ['off', _('Do not disturb music')],
  ['duck', _('Lower volume')],
  ['pause', _('Pause until microphone is free')],
];
const DUCK_LEVELS = [[10, '10%'], [20, '20%'], [30, '30%'], [40, '40%'],
  [50, '50%'], [60, '60%'], [70, '70%']];
const getSleep = () => [
  [0, _('Disabled')],
  [15, _('15 minutes')],
  [30, _('30 minutes')],
  [45, _('45 minutes')],
  [60, _('60 minutes')],
];

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
    button.set_tooltip_text(`${preset.label}: ${preset.bg}`);

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

  const eyebrow = new Gtk.Label({label: _('SONORA'), xalign: 0});
  eyebrow.add_css_class('sonora-eyebrow');

  const title = new Gtk.Label({
    label: _('The music companion for GNOME.'),
    xalign: 0,
    wrap: true,
  });
  title.add_css_class('sonora-hero-title');

  const subtitle = new Gtk.Label({
    label: _('Now-playing panel, synced lyrics, and listening stats, without login.'),
    xalign: 0,
    wrap: true,
  });
  subtitle.add_css_class('sonora-hero-sub');

  text.append(eyebrow);
  text.append(title);
  text.append(subtitle);

  const previewBox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 4,
    valign: Gtk.Align.CENTER,
  });

  const previewLabel = new Gtk.Label({
    label: _('Preview'),
    xalign: 1,
  });
  previewLabel.add_css_class('sonora-field-hint');

  const preview = new Gtk.DrawingArea();
  preview.set_content_width(300);
  preview.set_content_height(160);
  preview.set_valign(Gtk.Align.CENTER);
  preview.set_draw_func((area, cr, width, height) => {
    drawPreview(area, cr, width, height, settings);
  });

  previewBox.append(previewLabel);
  previewBox.append(preview);

  hero.append(text);
  hero.append(previewBox);

  return {hero, preview};
}

export default class SonoraPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    this.initTranslations();
    loadCss();

    const settings = getSettings();
    const modes = getModes();
    const positions = getPositions();
    const bgModes = getBgModes();
    const cardOpenModes = getCardOpen();
    const duckModes = getDuckModes();
    const sleepModes = getSleep();

    // --- Page 1: Appearance ---
    const lookPage = new Adw.PreferencesPage({
      title: _('Appearance'),
      icon_name: 'preferences-desktop-theme-symbolic',
    });
    window.add(lookPage);

    const heroGroup = new Adw.PreferencesGroup();
    lookPage.add(heroGroup);

    const {hero, preview} = buildHero(settings);
    heroGroup.add(hero);

    const panelGroup = new Adw.PreferencesGroup({
      title: _('Panel Indicator'),
      description: _('Display format and position on the top bar.'),
    });
    lookPage.add(panelGroup);

    const mode = comboRow(modes);
    mode.title = _('Indicator style');
    mode.subtitle = _('Compact icon, or full cover with title and status.');
    addIcon(mode, 'video-display-symbolic');
    bindString(settings, 'mode', mode, modes, window);
    panelGroup.add(mode);

    const position = comboRow(positions);
    position.title = _('Position');
    position.subtitle = _('Where the indicator sits on the top bar.');
    addIcon(position, 'view-grid-symbolic');
    bindString(settings, 'position', position, positions, window);
    panelGroup.add(position);

    const bgGroup = new Adw.PreferencesGroup({
      title: _('Background & Color'),
      description: _('Color styling for the now-playing card and panel pill.'),
    });
    lookPage.add(bgGroup);

    const cardBg = comboRow(bgModes);
    cardBg.title = _('Background style');
    cardBg.subtitle = _('Follow album artwork, or use a solid preset.');
    addIcon(cardBg, 'preferences-desktop-theme-symbolic');
    bindString(settings, 'card-bg', cardBg, bgModes, window);
    bgGroup.add(cardBg);

    const picker = buildPresetPicker(settings);
    const presetSection = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 8,
      margin_top: 6,
      margin_bottom: 6,
    });

    const presetTitle = new Gtk.Label({label: _('Solid preset'), xalign: 0});
    presetTitle.add_css_class('sonora-field-title');
    const presetHint = new Gtk.Label({
      label: _('This preset is active when solid background is selected.'),
      xalign: 0,
      wrap: true,
    });
    presetHint.add_css_class('sonora-field-hint');

    presetSection.append(presetTitle);
    presetSection.append(picker.flow);
    presetSection.append(presetHint);
    bgGroup.add(presetSection);

    // --- Page 2: Behavior ---
    const behaviorPage = new Adw.PreferencesPage({
      title: _('Behavior'),
      icon_name: 'media-playback-start-symbolic',
    });
    window.add(behaviorPage);

    const cardGroup = new Adw.PreferencesGroup({
      title: _('Card Interaction'),
      description: _('How the now-playing popup card is revealed.'),
    });
    behaviorPage.add(cardGroup);

    const cardOpen = comboRow(cardOpenModes);
    cardOpen.title = _('Card activation');
    cardOpen.subtitle = _('When the now-playing card appears.');
    addIcon(cardOpen, 'input-mouse-symbolic');
    bindString(settings, 'card-open', cardOpen, cardOpenModes, window);
    cardGroup.add(cardOpen);

    const hoverDelay = new Adw.SpinRow({
      title: _('Hover delay'),
      subtitle: _('Milliseconds to wait before the card opens on hover'),
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 2000,
        step_increment: 50,
        page_increment: 100,
      }),
    });
    addIcon(hoverDelay, 'preferences-system-time-symbolic');
    settings.bind('hover-delay', hoverDelay, 'value', 0);
    cardGroup.add(hoverDelay);

    const playbackGroup = new Adw.PreferencesGroup({
      title: _('Lyrics & Timing'),
      description: _('Synced lyrics display and playback sleep timer.'),
    });
    behaviorPage.add(playbackGroup);

    const lyrics = new Adw.SwitchRow({
      title: _('Show lyrics'),
      subtitle: _('Synced lyrics drawer on the now-playing card'),
    });
    addIcon(lyrics, 'audio-x-generic-symbolic');
    bindBool(settings, 'lyrics-visible', lyrics);
    playbackGroup.add(lyrics);

    const sleep = comboRow(sleepModes);
    sleep.title = _('Sleep timer');
    sleep.subtitle = _('Fade out and pause music after this duration');
    addIcon(sleep, 'weather-clear-night-symbolic');
    bindInt(settings, 'sleep-minutes', sleep, sleepModes, window);
    playbackGroup.add(sleep);

    const micGroup = new Adw.PreferencesGroup({
      title: _('Microphone'),
      description: _('Automatic behavior when other applications use the microphone.'),
    });
    behaviorPage.add(micGroup);

    const duckMode = comboRow(duckModes);
    duckMode.title = _('When microphone is in use');
    addIcon(duckMode, 'audio-input-microphone-symbolic');
    bindString(settings, 'duck-mode', duckMode, duckModes, window);
    micGroup.add(duckMode);

    const duckLevel = comboRow(DUCK_LEVELS);
    duckLevel.title = _('Ducked volume level');
    duckLevel.subtitle = _('Percentage of original playback volume kept');
    addIcon(duckLevel, 'audio-volume-medium-symbolic');
    bindInt(settings, 'duck-level', duckLevel, DUCK_LEVELS, window);
    micGroup.add(duckLevel);

    // --- Page 3: About ---
    const aboutPage = new Adw.PreferencesPage({
      title: _('About'),
      icon_name: 'help-about-symbolic',
    });
    window.add(aboutPage);

    const appGroup = new Adw.PreferencesGroup();
    const aboutRow = new Adw.ActionRow({
      title: _('Sonora'),
      subtitle: _('Music companion for GNOME Shell'),
    });
    const flame = Gio.icon_new_for_string(
      `${extensionDir()}/icons/sonora-flame-symbolic.svg`);
    aboutRow.add_prefix(new Gtk.Image({gicon: flame, pixel_size: 28}));
    appGroup.add(aboutRow);

    const versionRow = new Adw.ActionRow({
      title: _('Extension Version'),
      subtitle: _('Version 3.0 (GNOME Shell 50)'),
    });
    addIcon(versionRow, 'application-x-executable-symbolic');
    appGroup.add(versionRow);
    aboutPage.add(appGroup);

    const privacyGroup = new Adw.PreferencesGroup({
      title: _('Privacy & Data'),
      description: _('Listening statistics are stored strictly locally at ~/.local/share/spotify-ext/stats.json.'),
    });
    const privacyRow = new Adw.ActionRow({
      title: _('No Account & No Telemetry'),
      subtitle: _('Zero tracking or listening data sent to external servers.'),
    });
    addIcon(privacyRow, 'security-high-symbolic');
    privacyGroup.add(privacyRow);
    aboutPage.add(privacyGroup);

    const linksGroup = new Adw.PreferencesGroup({
      title: _('Project & License'),
    });
    const sourceRow = new Adw.ActionRow({
      title: _('Source Code & Contributions'),
      subtitle: _('Open repository on GitHub'),
      activatable: true,
    });
    addIcon(sourceRow, 'software-update-available-symbolic');
    sourceRow.add_suffix(new Gtk.Image({icon_name: 'go-next-symbolic', pixel_size: 16}));
    sourceRow.connect('activated', () => {
      try {
        Gio.AppInfo.launch_default_for_uri('https://github.com/IkrmMrbsy/sonora-gnome-extension', null);
      } catch {
        // Ignored if no default URI handler
      }
    });
    linksGroup.add(sourceRow);

    const licenseRow = new Adw.ActionRow({
      title: _('License'),
      subtitle: _('GNU General Public License v3.0 (GPL-3.0)'),
    });
    addIcon(licenseRow, 'emblem-documents-symbolic');
    linksGroup.add(licenseRow);
    aboutPage.add(linksGroup);

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

    window.set_default_size(680, 620);
  }
}
