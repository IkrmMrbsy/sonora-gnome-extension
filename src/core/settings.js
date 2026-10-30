import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {extensionDir} from '../util/path.js';

const SCHEMA = 'org.gnome.shell.extensions.spotify-ext';
const MODES = ['icon', 'pill'];
const POSITIONS = ['left', 'center', 'right'];
const CARD_OPEN = ['hover', 'click', 'both'];
const DUCK_MODES = ['off', 'duck', 'pause'];

let _settings = null;

export function getSettings() {
  if (_settings)
    return _settings;

  const source = Gio.SettingsSchemaSource.new_from_directory(
    GLib.build_filenamev([extensionDir(), 'schemas']),
    Gio.SettingsSchemaSource.get_default(), false);
  const schema = source.lookup(SCHEMA, false);
  if (!schema)
    throw new Error(`spotify-ext: schema ${SCHEMA} not found`);

  _settings = new Gio.Settings({settings_schema: schema});
  migrateLegacyConfig(_settings);
  return _settings;
}

function migrateLegacyConfig(settings) {
  const path = GLib.build_filenamev([GLib.get_user_data_dir(), 'spotify-ext', 'config.json']);
  const file = Gio.File.new_for_path(path);
  if (!file.query_exists(null))
    return;

  try {
    const [ok, bytes] = file.load_contents(null);
    if (ok) {
      const raw = JSON.parse(new TextDecoder().decode(bytes));
      if (MODES.includes(raw.mode))
        settings.set_string('mode', raw.mode);
      if (POSITIONS.includes(raw.position))
        settings.set_string('position', raw.position);
    }
  } catch {
    // Corrupt legacy file: keep schema defaults.
  }

  try {
    file.move(Gio.File.new_for_path(`${path}.migrated`), Gio.FileCopyFlags.OVERWRITE, null, null);
  } catch {
    // Best effort; the schema now holds the source of truth.
  }
}

export function loadConfig() {
  const settings = getSettings();
  return {
    mode: settings.get_string('mode'),
    position: settings.get_string('position'),
    cardOpen: settings.get_string('card-open'),
    hoverDelay: settings.get_int('hover-delay'),
    duckMode: settings.get_string('duck-mode'),
    duckLevel: settings.get_int('duck-level'),
  };
}

export function saveConfig(config) {
  const settings = getSettings();
  if (MODES.includes(config.mode))
    settings.set_string('mode', config.mode);
  if (POSITIONS.includes(config.position))
    settings.set_string('position', config.position);
  if (CARD_OPEN.includes(config.cardOpen))
    settings.set_string('card-open', config.cardOpen);
  if (Number.isInteger(config.hoverDelay))
    settings.set_int('hover-delay', Math.max(0, Math.min(2000, config.hoverDelay)));
  if (DUCK_MODES.includes(config.duckMode))
    settings.set_string('duck-mode', config.duckMode);
  if (Number.isInteger(config.duckLevel))
    settings.set_int('duck-level', Math.max(5, Math.min(95, config.duckLevel)));
  return loadConfig();
}

export function watchConfig(callback) {
  const settings = getSettings();
  const id = settings.connect('changed', () => callback(loadConfig()));
  return {
    destroy() {
      settings.disconnect(id);
    },
  };
}
