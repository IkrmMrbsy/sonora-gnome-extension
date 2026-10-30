import GdkPixbuf from 'gi://GdkPixbuf?version=2.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {averageColor} from './color.js';
import {SonoraIndicator} from './island.js';
import {pixbufToRGBA} from './art.js';
import {getSettings, loadConfig, watchConfig} from './config.js';
import {activeLine, parseLRC} from './lrc.js';
import {MicMonitor} from './mic.js';
import {Spotify} from './mpris.js';
import {
  addListen, addPlay, bestStreak, currentStreak, currentWeek, dayKey, emptyStats,
  normalizeStats, trackKey, weekArtists, weekTracks,
} from './stats.js';
import {VolumeController} from './volume.js';

const API = 'https://lrclib.net/api';
const CACHE_LIMIT = 40;
const PLAY_THRESHOLD = 30;

function sleep(ms) {
  return new Promise(resolve => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

function statsFile() {
  return Gio.File.new_for_path(
    GLib.build_filenamev([GLib.get_user_data_dir(), 'spotify-ext', 'stats.json']));
}

function loadStats() {
  try {
    const [ok, bytes] = statsFile().load_contents(null);
    if (ok)
      return normalizeStats(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    // Missing or corrupt file: start fresh.
  }
  return emptyStats();
}

function saveStats(stats) {
  try {
    const file = statsFile();
    const dir = file.get_parent();
    if (!dir.query_exists(null))
      dir.make_directory_with_parents(null);
    file.replace_contents(
      new TextEncoder().encode(JSON.stringify(stats)),
      null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
  } catch (error) {
    console.error(`spotify-ext: failed to save stats: ${error}`);
  }
}

export default class SpotifyLyricsExtension extends Extension {
  enable() {
    this._config = loadConfig();
    this._settings = getSettings();
    this._spotify = new Spotify();
    this._volume = new VolumeController(this._spotify);
    this._stats = loadStats();
    this._statsDirty = false;

    this._artFor = null;
    this._artToken = 0;
    this._pixbufs = new Map();

    this._listen = null;
    this._lastSyncAt = 0;
    this._sleepUntil = 0;

    this._lyricsEnabled = this._settings.get_boolean('lyrics-visible');
    this._duckMode = this._settings.get_string('duck-mode');
    this._duckLevel = this._settings.get_int('duck-level');
    this._micActive = false;

    this._lines = [];
    this._lineIndex = -1;
    this._trackKey = null;
    this._track = null;
    this._playing = false;
    this._position = 0;
    this._positionAt = GLib.get_monotonic_time() / 1e6;
    this._cache = new Map();
    this._token = 0;

    this._cancellable = new Gio.Cancellable();
    this._http = new Soup.Session({timeout: 10});

    this._indicator = new SonoraIndicator(this._config, {
      onTogglePlay: () => this._togglePlay(),
      onNext: () => this._spotify.next(),
      onPrev: () => this._spotify.previous(),
      onSeek: usec => this._seek(usec),
      onRepeat: mode => this._setRepeat(mode),
      onOpenSpotify: () => this._openSpotify(),
    });

    this._configWatch = watchConfig(config => {
      this._config = config;
      this._indicator?.applyConfig(config);
    });

    this._settingIds = [
      this._settings.connect('changed::lyrics-visible',
        () => this._setLyricsEnabled(this._settings.get_boolean('lyrics-visible'))),
      this._settings.connect('changed::duck-mode', () => this._applyDuckSettings()),
      this._settings.connect('changed::duck-level', () => this._applyDuckSettings()),
      this._settings.connect('changed::sleep-minutes', () => this._applySleepSetting()),
    ];
    this._applySleepSetting();

    this._mic = new MicMonitor(active => this._onMicChange(active));
    this._mic.start();

    this._syncTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
      this._sync();
      return GLib.SOURCE_CONTINUE;
    });
    this._tickTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
      this._tick();
      return GLib.SOURCE_CONTINUE;
    });
    this._saveTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
      this._saveStats();
      return GLib.SOURCE_CONTINUE;
    });
    this._statsTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
      this._updateCardStats();
      return GLib.SOURCE_CONTINUE;
    });
    this._sync();
    this._updateCardStats();
  }

  disable() {
    for (const timer of [this._syncTimer, this._tickTimer, this._saveTimer,
      this._statsTimer]) {
      if (timer)
        GLib.source_remove(timer);
    }
    this._syncTimer = this._tickTimer = this._saveTimer = 0;
    this._statsTimer = 0;

    this._configWatch?.destroy();
    this._configWatch = null;

    for (const id of this._settingIds ?? [])
      this._settings.disconnect(id);
    this._settingIds = [];

    this._saveStats();
    this._mic?.destroy();
    this._mic = null;

    this._volume.destroy();
    this._cancellable.cancel();
    this._http.abort();

    // Null the reference before destroying so a queued timer callback that
    // still fires cannot touch disposed actors.
    const indicator = this._indicator;
    this._indicator = null;
    indicator?.destroy();

    this._pixbufs?.clear();
    this._pixbufs = null;
    this._cache?.clear();
    this._cache = null;
    this._lines = [];
    this._track = null;
  }

  _openSpotify() {
    const id = String(this._track?.id ?? '');
    const match = id.match(/\/track\/([A-Za-z0-9]+)/);
    const uri = match ? `spotify:track:${match[1]}` : (this._track?.url || 'spotify:');
    try {
      Gio.AppInfo.launch_default_for_uri(uri, null);
    } catch {
      try {
        Gio.AppInfo.launch_default_for_uri('spotify:', null);
      } catch {
        // Spotify is not installed.
      }
    }
  }

  _togglePlay() {
    if (this._spotify.status() === 'Playing')
      this._spotify.pause();
    else
      this._spotify.play();
  }

  _seek(usec) {
    if (!this._track)
      return;
    this._spotify.setPosition(this._track.id, usec);
    this._position = usec / 1e6;
    this._positionAt = GLib.get_monotonic_time() / 1e6;
    this._indicator?.setPosition(this._position, this._track.duration);
  }

  _startSleep(minutes) {
    this._sleepUntil = GLib.get_monotonic_time() / 1e6 + minutes * 60;
    this._updateSleep();
  }

  _applySleepSetting() {
    const minutes = this._settings.get_int('sleep-minutes');
    if (minutes > 0)
      this._startSleep(minutes);
    else
      this._cancelSleep();
  }

  _setLyricsEnabled(state) {
    this._lyricsEnabled = state;
    this._indicator?.setLyricsVisible(state);
  }

  _applyDuckSettings() {
    const previous = this._duckMode;
    this._duckMode = this._settings.get_string('duck-mode');
    this._duckLevel = this._settings.get_int('duck-level');

    if (this._duckMode === previous)
      return;

    // Drop whatever the old mode was doing before applying the new one.
    this._volume.unduck();
    this._volume.resumeFromMic();
    this._indicator?.setDuck(false);

    if (this._micActive)
      this._onMicChange(true);
  }

  _setRepeat(mode) {
    if (!this._spotify.setLoopStatus(mode))
      return;
    this._indicator?.setRepeat(mode);
  }

  _syncRepeat() {
    const mode = this._spotify.loopStatus();
    if (mode)
      this._indicator?.setRepeat(mode);
  }

  _cancelSleep() {
    this._sleepUntil = 0;
    this._updateSleep();
  }

  _updateSleep() {
    const left = this._sleepUntil
      ? Math.max(0, this._sleepUntil - GLib.get_monotonic_time() / 1e6)
      : 0;
    this._indicator?.setSleep(left);
  }

  _checkSleep() {
    if (!this._sleepUntil)
      return;
    if (GLib.get_monotonic_time() / 1e6 < this._sleepUntil)
      return;

    this._sleepUntil = 0;
    this._updateSleep();
    if (this._settings.get_int('sleep-minutes') !== 0)
      this._settings.set_int('sleep-minutes', 0);
    this._volume.fadeOutAndPause();
  }

  _onMicChange(active) {
    this._micActive = active;

    if (this._duckMode === 'off') {
      this._indicator?.setDuck(false);
      return;
    }

    if (this._duckMode === 'pause') {
      if (active) {
        this._volume.pauseForMic();
        this._indicator?.setDuck(true);
      } else {
        this._volume.resumeFromMic();
        this._indicator?.setDuck(false);
      }
      return;
    }

    if (active)
      this._volume.duck(this._duckLevel);
    else
      this._volume.unduck();
    this._indicator?.setDuck(active);
  }

  _sync() {
    if (!this._indicator)
      return;

    const status = this._spotify.status();
    const track = this._spotify.track();
    const playing = status === 'Playing';

    if (!track) {
      this._playing = false;
      this._lastSyncAt = 0;
      this._listen = null;
      this._track = null;
      // Reset the key so the same track republishes after Spotify reopens.
      this._trackKey = null;
      this._lines = [];
      this._lineIndex = -1;
      this._indicator?.setPlaying(false);
      this._indicator?.setTrack(null);
      this._indicator?.setLyrics([], -1);
      this._indicator?.setPosition(0, 0);
      this._updateSleep();
      this._checkSleep();
      return;
    }

    this._playing = playing;
    this._indicator?.setPlaying(playing);
    this._syncRepeat();

    const key = `${track.id}|${track.title}`;
    if (key !== this._trackKey) {
      this._trackKey = key;
      this._track = track;
      this._lines = [];
      this._lineIndex = -1;
      this._indicator?.setTrack(track);
      this._indicator?.setLyrics([], -1);
      this._indicator?.setPosition(0, track.duration);

      if (track.artist && track.duration >= 30)
        this._load(track);

      if (track.artUrl)
        this._loadArt(track);
      else
        this._indicator?.setArt(null);

      this._updateCardStats();
    }

    const position = this._spotify.position();
    if (position !== null) {
      this._position = position;
      this._positionAt = GLib.get_monotonic_time() / 1e6;
    }

    if (playing) {
      this._accumulate(track);
    } else {
      this._listen = null;
      this._lastSyncAt = 0;
    }

    this._indicator?.setPosition(this._position, track.duration);
    this._updateSleep();
    this._checkSleep();
  }

  _accumulate(track) {
    const now = GLib.get_monotonic_time() / 1e6;
    const delta = this._lastSyncAt ? Math.min(2, Math.max(0, now - this._lastSyncAt)) : 0;
    this._lastSyncAt = now;
    if (delta <= 0)
      return;

    const key = trackKey(track.artist, track.title);
    if (!this._listen || this._listen.key !== key) {
      this._listen = {key, seconds: 0, counted: false, artist: track.artist, title: track.title};
    }
    this._listen.seconds += delta;

    const date = new Date();
    addListen(this._stats, {
      artist: track.artist,
      title: track.title,
      seconds: delta,
      day: dayKey(date),
    });
    this._statsDirty = true;

    if (!this._listen.counted && this._listen.seconds >= PLAY_THRESHOLD) {
      this._listen.counted = true;
      addPlay(this._stats, {artist: track.artist, title: track.title, day: dayKey(date)});
      this._updateCardStats();
    }
  }

  _saveStats() {
    if (!this._statsDirty || !this._stats)
      return;

    saveStats(this._stats);
    this._statsDirty = false;
  }

  _updateCardStats() {
    if (!this._indicator || this._destroyed)
      return;

    const now = new Date();
    const week = currentWeek(this._stats, now);
    const artists = weekArtists(this._stats, now, 5);
    const tracks = weekTracks(this._stats, now, 5);

    this._indicator.setStats({
      weekSeconds: week.seconds,
      activeDays: week.activeDays,
      days: week.days.map(day => ({
        key: day.key,
        seconds: day.seconds,
        isToday: day.isToday,
        isFuture: day.isFuture,
      })),
      artists,
      tracks,
      streak: currentStreak(this._stats.days, now),
      bestStreak: bestStreak(this._stats.days),
      topArtist: artists.length ? artists[0].name : '',
    });
  }

  async _loadArt(track) {
    if (!track.artUrl || track.artUrl === this._artFor)
      return;

    this._artFor = track.artUrl;
    const token = ++this._artToken;
    const pixbuf = await this._fetchPixbuf(track.artUrl);
    if (!pixbuf || token !== this._artToken)
      return;

    this._indicator?.setArt(pixbuf);

    const small = pixbuf.scale_simple(16, 16, GdkPixbuf.InterpType.BILINEAR);
    if (!small)
      return;
    const rgba = pixbufToRGBA(small);
    const rgb = averageColor(rgba.data, rgba.rowstride, rgba.width, rgba.height);
    this._indicator?.setAccent(rgb);
  }

  async _fetchPixbuf(url) {
    const cached = this._pixbufs.get(url);
    if (cached)
      return cached;

    try {
      const message = Soup.Message.new('GET', url);
      const bytes = await this._send(message);
      const stream = Gio.MemoryInputStream.new_from_bytes(bytes);
      const pixbuf = GdkPixbuf.Pixbuf.new_from_stream(stream, null);
      this._pixbufs.set(url, pixbuf);
      if (this._pixbufs.size > 8)
        this._pixbufs.delete(this._pixbufs.keys().next().value);
      return pixbuf;
    } catch {
      return null;
    }
  }

  async _load(track) {
    const token = ++this._token;
    const key = `${track.title}|${track.artist}|${track.album}|${track.duration}`;

    let lines = this._cache.get(key);
    if (!lines) {
      lines = await this._fetch(track);
      if (token !== this._token)
        return;

      this._cache.set(key, lines);
      if (this._cache.size > CACHE_LIMIT)
        this._cache.delete(this._cache.keys().next().value);
    }

    if (token !== this._token)
      return;

    this._lines = lines;
    // -2 forces the first tick to publish the "next line" before the song starts.
    this._lineIndex = -2;
    this._tick();
  }

  async _fetch(track) {
    try {
      const data = await this._getJSON(this._url('/get', {
        track_name: track.title,
        artist_name: track.artist,
        album_name: track.album,
        duration: track.duration,
      }));
      return parseLRC(data.syncedLyrics);
    } catch (error) {
      if (error.status !== 404)
        return [];
    }

    try {
      const results = await this._getJSON(this._url('/search', {
        track_name: track.title.split(' - ')[0],
        artist_name: track.artist,
      }));

      const best = (Array.isArray(results) ? results : [])
        .filter(result => result.syncedLyrics)
        .sort((a, b) => Math.abs(a.duration - track.duration) - Math.abs(b.duration - track.duration))[0];

      return best ? parseLRC(best.syncedLyrics) : [];
    } catch {
      return [];
    }
  }

  _send(message) {
    return new Promise((resolve, reject) => {
      this._http.send_and_read_async(
        message, GLib.PRIORITY_DEFAULT, this._cancellable,
        (session, result) => {
          try {
            resolve(session.send_and_read_finish(result));
          } catch (error) {
            reject(error);
          }
        });
    });
  }

  async _getJSON(url, attempt = 0) {
    const message = Soup.Message.new('GET', url);
    message.request_headers.append('User-Agent', 'spotify-lyrics-ext/0.2 (GNOME Shell)');

    const bytes = await this._send(message);
    const status = message.get_status();
    if (status !== Soup.Status.OK) {
      if (status === Soup.Status.SERVICE_UNAVAILABLE && attempt < 2) {
        await sleep(1000 + attempt * 1000);
        return this._getJSON(url, attempt + 1);
      }
      const error = new Error(`LRCLIB HTTP ${status}`);
      error.status = status;
      throw error;
    }

    return JSON.parse(new TextDecoder().decode(bytes.get_data()));
  }

  _url(path, params) {
    const query = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    return `${API}${path}?${query}`;
  }

  _tick() {
    if (!this._indicator)
      return;

    this._updateSleep();
    this._checkSleep();

    const track = this._track;
    if (!track)
      return;

    let position = this._playing
      ? this._position + (GLib.get_monotonic_time() / 1e6 - this._positionAt)
      : this._position;
    if (track.duration > 0)
      position = Math.min(position, track.duration);
    this._indicator?.setPosition(position, track.duration);

    if (!this._lyricsEnabled || !this._lines.length)
      return;

    const index = activeLine(this._lines, position);
    if (index !== this._lineIndex) {
      this._lineIndex = index;
      this._indicator?.setLyrics(this._lines, index);
    }
  }
}
