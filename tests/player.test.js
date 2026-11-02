import GLib from 'gi://GLib';

import {parseTrackMetadata} from '../src/core/player.js';

function check(condition, message) {
  if (!condition)
    throw new Error(`FAIL: ${message}`);
}

const metadata = new GLib.Variant('a{sv}', {
  'mpris:trackid': new GLib.Variant('s', '/org/mpris/MediaPlayer2/Track/1'),
  'xesam:title': new GLib.Variant('s', 'Song'),
  'xesam:artist': new GLib.Variant('as', ['Artist', 'Guest']),
  'xesam:album': new GLib.Variant('s', 'Album'),
  'mpris:length': new GLib.Variant('x', 180500000),
  'mpris:artUrl': new GLib.Variant('s', 'https://example.test/cover.jpg'),
  'xesam:url': new GLib.Variant('s', 'spotify:track:1'),
});

const track = parseTrackMetadata(metadata);
check(track.id === '/org/mpris/MediaPlayer2/Track/1', 'track id');
check(track.title === 'Song', 'title');
check(track.artist === 'Artist, Guest', 'artist array joins');
check(track.album === 'Album', 'album');
check(track.duration === 181, 'duration rounds to seconds');
check(track.artUrl === 'https://example.test/cover.jpg', 'art URL');
check(track.url === 'spotify:track:1', 'track URL');

const stringArtist = parseTrackMetadata(new GLib.Variant('a{sv}', {
  'xesam:title': new GLib.Variant('s', 'Solo'),
  'xesam:artist': new GLib.Variant('s', 'Artist'),
}));
check(stringArtist.artist === 'Artist', 'string artist survives');
check(stringArtist.id === 'Solo', 'missing id falls back to title');
check(stringArtist.album === '' && stringArtist.artUrl === '' &&
  stringArtist.url === '' && stringArtist.duration === 0, 'missing fields use defaults');

check(parseTrackMetadata(new GLib.Variant('a{sv}', {
  'xesam:artist': new GLib.Variant('as', ['Artist']),
})) === null, 'missing title is rejected');

print('player.js OK');
