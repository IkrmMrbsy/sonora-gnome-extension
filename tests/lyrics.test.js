import GLib from 'gi://GLib';

import {LyricsClient} from '../src/core/lyrics.js';

function check(condition, message) {
  if (!condition)
    throw new Error(`FAIL: ${message}`);
}

const track = {
  title: 'Song - Remastered',
  artist: 'Artist',
  album: 'Album',
  duration: 180,
};

const loop = GLib.MainLoop.new(null, false);

(async () => {
  try {
    const fallback = new LyricsClient();
    const fallbackCalls = [];
    fallback._getJSON = async url => {
      fallbackCalls.push(url);
      if (url.includes('/get'))
        return {syncedLyrics: null};
      return [{syncedLyrics: '[00:01.00]Found', duration: track.duration}];
    };

    const found = await fallback.fetchFor(track);
    check(found.length === 1 && found[0].text === 'Found',
      'empty /get result should fall back to /search');
    check(fallbackCalls.some(url => url.includes('/get')), '/get should be tried');
    check(fallbackCalls.some(url => url.includes('/search')), '/search should be tried');

    const transient = new LyricsClient();
    transient._getJSON = async url => {
      if (url.includes('/get'))
        throw Object.assign(new Error('server error'), {status: 500});
      return [{syncedLyrics: '[00:02.00]Fallback', duration: track.duration}];
    };

    const fallbackLines = await transient.fetchFor(track);
    check(fallbackLines[0]?.text === 'Fallback',
      'non-404 /get failure should fall back to /search');

    const empty = new LyricsClient();
    let emptyCalls = 0;
    empty._getJSON = async () => {
      emptyCalls++;
      return {syncedLyrics: null};
    };

    await empty.fetchFor(track);
    await empty.fetchFor(track);
    check(emptyCalls === 4, `empty results must not be cached (calls=${emptyCalls})`);

    print('lyrics.js OK');
  } catch (error) {
    print(`FAIL: ${error.message}`);
    imports.system.exit(1);
  } finally {
    loop.quit();
  }
})();

loop.run();
