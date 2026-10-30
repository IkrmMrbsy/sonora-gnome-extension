import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';

import {parseLRC} from './lrc.js';

const API = 'https://lrclib.net/api';
const CACHE_LIMIT = 40;
const USER_AGENT = 'sonora/1.0 (GNOME Shell)';

function sleep(ms) {
  return new Promise(resolve => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

// Fetches synced lyrics from lrclib.net and keeps a small in-memory cache.
// Lives in core/ so it can be exercised without a shell.
export class LyricsClient {
  constructor(cancellable = null) {
    this._cancellable = cancellable;
    this._http = new Soup.Session({timeout: 10});
    this._cache = new Map();
  }

  async fetchFor(track) {
    const key = `${track.title}|${track.artist}|${track.album}|${track.duration}`;

    const cached = this._cache.get(key);
    if (cached)
      return cached;

    const lines = await this._fetch(track);
    this._cache.set(key, lines);
    if (this._cache.size > CACHE_LIMIT)
      this._cache.delete(this._cache.keys().next().value);

    return lines;
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

      const candidates = (Array.isArray(results) ? results : [])
        .filter(result => result.syncedLyrics)
        .sort((a, b) =>
          Math.abs(a.duration - track.duration) - Math.abs(b.duration - track.duration));

      return candidates.length ? parseLRC(candidates[0].syncedLyrics) : [];
    } catch {
      return [];
    }
  }

  async _getJSON(url, attempt = 0) {
    const message = Soup.Message.new('GET', url);
    message.request_headers.append('User-Agent', USER_AGENT);

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

  _url(path, params) {
    const query = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    return `${API}${path}?${query}`;
  }

  destroy() {
    this._cache.clear();
    this._http.abort();
  }
}
