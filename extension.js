import GdkPixbuf from 'gi://GdkPixbuf?version=2.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {ArtTracker} from './src/core/art.js';
import {averageColor} from './src/util/color.js';
import {SonoraIndicator} from './src/ui/indicator.js';
import {pixbufToRGBA} from './src/util/art.js';
import {configNeedsRelayout, getSettings, loadConfig, watchConfig} from './src/core/settings.js';
import {activeLine} from './src/core/lrc.js';
import {LyricsClient} from './src/core/lyrics.js';
import {PlaybackTracker} from './src/core/playback.js';
import {RequestToken} from './src/core/token.js';
import {MicMonitor} from './src/core/mic.js';
import {Spotify} from './src/core/player.js';
import {
  addListen, addPlay, bestStreak, currentStreak, currentWeek, dayKey, emptyStats,
  normalizeStats, pruneStats, weekArtists, weekTracks,
} from './src/core/stats.js';
import {VolumeController} from './src/core/volume.js';

function statsFile() {
  return Gio.File.new_for_path(
    GLib.build_filenamev([GLib.get_user_data_dir(), 'spotify-ext', 'stats.json']));
}

function loadStats() {
  try {
    const [ok, bytes] = statsFile().load_contents(null);
    if (ok) {
      const raw = JSON.parse(new TextDecoder().decode(bytes));
      const stats = normalizeStats(raw);
      const dirty = pruneStats(stats) || raw?.version !== stats.version ||
        raw?.tracks !== undefined || raw?.artists !== undefined;
      return {stats, dirty};
    }
  } catch {
    // Missing or corrupt file: start fresh.
  }
  return {stats: emptyStats(), dirty: false};
}

function saveStats(stats) {
  try {
    const file = statsFile();
    const dir = file.get_parent();
    if (!dir.query_exists(null))
      dir.make_directory_with_parents(null);
    const [ok] = file.replace_contents(
      new TextEncoder().encode(JSON.stringify(stats)),
      null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
    return ok;
  } catch (error) {
    console.error(`spotify-ext: failed to save stats: ${error}`);
    return false;
  }
}

export default class SpotifyLyricsExtension extends Extension {
  enable() {
    this._config = loadConfig();
    this._settings = getSettings();
    this._spotify = new Spotify();
    this._volume = new VolumeController(this._spotify);
    const loaded = loadStats();
    this._stats = loaded.stats;
    this._statsDirty = loaded.dirty;
    this._pruneDay = dayKey(new Date());
    this._destroyed = false;

    this._art = new ArtTracker();
    this._pixbufs = new Map();

    this._playback = new PlaybackTracker();
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
    this._cancellable = new Gio.Cancellable();
    this._http = new Soup.Session({timeout: 10});
    this._lyricsClient = new LyricsClient(this._cancellable);
    this._lyricsToken = new RequestToken();

    this._indicator = new SonoraIndicator(this._config, {
      onTogglePlay: () => this._togglePlay(),
      onNext: () => this._spotify.next(),
      onPrev: () => this._spotify.previous(),
      onSeek: usec => this._seek(usec),
      onRepeat: mode => this._setRepeat(mode),
      onOpenSpotify: () => this._openSpotify(),
    });

    this._configWatch = watchConfig((config, key) => {
      this._config = config;
      this._indicator?.applyConfig(config, configNeedsRelayout(key));
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
    this._saveTimer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 300, () => {
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
    this._destroyed = true;

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
    this._lyricsToken?.invalidate();
    this._art?.clear();

    // Null the reference before destroying so a queued timer callback that
    // still fires cannot touch disposed actors.
    const indicator = this._indicator;
    this._indicator = null;
    indicator?.destroy();

    this._pixbufs?.clear();
    this._pixbufs = null;
    this._lyricsClient?.destroy();
    this._lyricsClient = null;
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

    if (this._duckMode === previous) {
      if (this._micActive && this._duckMode === 'duck')
        this._volume.duck(this._duckLevel);
      return;
    }

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
      this._playback.reset();
      this._track = null;
      this._lyricsToken.invalidate();
      // Reset the key so the same track republishes after Spotify reopens.
      this._trackKey = null;
      this._lines = [];
      this._lineIndex = -1;
      if (this._art.hasState())
        this._clearArt();
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
      this._lyricsToken.invalidate();
      this._lines = [];
      this._lineIndex = -1;
      this._indicator?.setTrack(track);
      this._indicator?.setLyrics([], -1);
      this._indicator?.setPosition(0, track.duration);

      if (track.artist && track.duration >= 30)
        this._load(track);

      this._updateCardStats();
    }

    if (track.artUrl) {
      this._loadArt(track);
    } else if (this._art.hasState()) {
      this._clearArt();
    }

    const position = this._spotify.position();
    const hasPosition = position !== null;
    if (hasPosition) {
      this._position = position;
      this._positionAt = GLib.get_monotonic_time() / 1e6;
    }

    if (playing) {
      this._accumulate(track, hasPosition ? this._position : null);
    } else {
      this._playback.pause(hasPosition ? this._position : null,
        GLib.get_monotonic_time() / 1e6);
    }

    this._indicator?.setPosition(this._position, track.duration);
    this._updateSleep();
    this._checkSleep();
  }

  _accumulate(track, position) {
    const now = GLib.get_monotonic_time() / 1e6;
    const {seconds, counted} = this._playback.update(track, position, now, true);
    const date = new Date();

    if (seconds > 0) {
      addListen(this._stats, {
        artist: track.artist,
        title: track.title,
        seconds,
        day: dayKey(date),
      });
      this._statsDirty = true;
    }

    if (counted) {
      addPlay(this._stats, {artist: track.artist, title: track.title, day: dayKey(date)});
      this._statsDirty = true;
      this._updateCardStats();
    }
  }

  _saveStats() {
    if (!this._stats)
      return;

    const today = dayKey(new Date());
    if (today !== this._pruneDay) {
      this._pruneDay = today;
      if (pruneStats(this._stats))
        this._statsDirty = true;
    }

    if (!this._statsDirty)
      return;

    if (saveStats(this._stats))
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

  _clearArt() {
    this._art.clear();
    this._indicator?.setArt(null);
  }

  async _loadArt(track) {
    const url = track.artUrl;
    if (!url) {
      if (this._art.hasState())
        this._clearArt();
      return;
    }

    const now = GLib.get_monotonic_time() / 1e6;
    const started = this._art.begin(url, now);
    if (!started)
      return;

    if (started.previous)
      this._indicator?.setArt(null);

    const pixbuf = await this._fetchPixbuf(url);
    const result = this._art.finish(started.token, url, Boolean(pixbuf),
      GLib.get_monotonic_time() / 1e6);
    if (result === null)
      return;
    if (!result) {
      this._indicator?.setArt(null);
      return;
    }

    this._indicator?.setArt(pixbuf);

    const small = pixbuf.scale_simple(16, 16, GdkPixbuf.InterpType.BILINEAR);
    if (!small)
      return;
    const rgba = pixbufToRGBA(small);
    const rgb = averageColor(rgba.data, rgba.rowstride, rgba.width, rgba.height);
    this._indicator?.setAccent(rgb);
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
    const token = this._lyricsToken.next();
    const lines = await this._lyricsClient.fetchFor(track);
    if (!this._lyricsToken.isCurrent(token))
      return;

    this._lines = lines;
    // -2 forces the first tick to publish the "next line" before the song starts.
    this._lineIndex = -2;
    this._tick();
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
