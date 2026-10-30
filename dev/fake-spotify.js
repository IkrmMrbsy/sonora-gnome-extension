#!/usr/bin/gjs -m
// Fake Spotify MPRIS player for the nested-shell dev loop.
// Run inside the nested session bus:  dbus-run-session -- bash -c './dev/fake-spotify.js & gnome-shell --nested --wayland'

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const XML = `
<node>
  <interface name="org.mpris.MediaPlayer2.Player">
    <method name="Play"/>
    <method name="Pause"/>
    <method name="PlayPause"/>
    <method name="Next"/>
    <method name="Previous"/>
    <method name="Stop"/>
    <method name="SetPosition">
      <arg type="o" direction="in"/>
      <arg type="x" direction="in"/>
    </method>
    <property name="PlaybackStatus" type="s" access="read"/>
    <property name="Metadata" type="a{sv}" access="read"/>
    <property name="Position" type="x" access="read"/>
    <property name="Volume" type="d" access="readwrite"/>
    <property name="LoopStatus" type="s" access="readwrite"/>
    <property name="Shuffle" type="b" access="readwrite"/>
  </interface>
  <interface name="org.mpris.MediaPlayer2">
    <property name="Identity" type="s" access="read"/>
    <property name="CanQuit" type="b" access="read"/>
  </interface>
</node>`;

const TRACKS = [
  {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    duration: 200,
    artUrl: 'https://i.scdn.co/image/ab67616d0000b27352844939eaf38ec62110fcde',
  },
  {
    title: 'X-Static',
    artist: 'Foo Fighters',
    album: 'Foo Fighters',
    duration: 253,
    artUrl: 'https://i.scdn.co/image/ab67616d0000b27352844939eaf38ec62110fcde',
  },
  {
    title: 'Everlong',
    artist: 'Foo Fighters',
    album: 'The Colour and the Shape',
    duration: 250,
    artUrl: 'https://i.scdn.co/image/ab67616d0000b27352844939eaf38ec62110fcde',
  },
];

let index = 0;
let position = 0;
let playing = true;
let volume = 0.8;
let loopStatus = 'None';
let shuffle = false;
let positionReads = 0;

function metadata() {
  const track = TRACKS[index];
  return new GLib.Variant('a{sv}', {
    'mpris:trackid': new GLib.Variant('o', `/com/spotify/track/${index}`),
    'mpris:length': new GLib.Variant('x', track.duration * 1000000),
    'mpris:artUrl': new GLib.Variant('s', track.artUrl),
    'xesam:title': new GLib.Variant('s', track.title),
    'xesam:artist': new GLib.Variant('as', [track.artist]),
    'xesam:album': new GLib.Variant('s', track.album),
  });
}

function property(name) {
  switch (name) {
  case 'PlaybackStatus':
    return new GLib.Variant('s', playing ? 'Playing' : 'Paused');
  case 'Metadata':
    return metadata();
  case 'Position':
    if (++positionReads % 10 === 0)
      print(`fake-spotify: position read x${positionReads} (${(position / 1e6).toFixed(0)}s)`);
    return new GLib.Variant('x', position);
  case 'Volume':
    return new GLib.Variant('d', volume);
  case 'LoopStatus':
    return new GLib.Variant('s', loopStatus);
  case 'Shuffle':
    return new GLib.Variant('b', shuffle);
  case 'Identity':
    return new GLib.Variant('s', 'Fake Spotify');
  case 'CanQuit':
    return new GLib.Variant('b', false);
  default:
    return null;
  }
}

function onMethodCall(connection, sender, path, iface, method, params, invocation) {
  switch (method) {
  case 'Play':
    playing = true;
    break;
  case 'Pause':
    playing = false;
    break;
  case 'PlayPause':
    playing = !playing;
    break;
  case 'Next':
    index = (index + 1) % TRACKS.length;
    position = 0;
    break;
  case 'Previous':
    index = (index + TRACKS.length - 1) % TRACKS.length;
    position = 0;
    break;
  case 'SetPosition':
    position = params.deepUnpack()[1];
    break;
  case 'Stop':
    playing = false;
    position = 0;
    break;
  default:
    break;
  }
  print(`fake-spotify: ${method} -> playing=${playing} track=${TRACKS[index].title}`);
  invocation.return_value(null);
}

function onGetProperty(connection, sender, path, iface, name) {
  return property(name);
}

function onSetProperty(connection, sender, path, iface, name, value) {
  if (name === 'Volume') {
    volume = value.deepUnpack();
    print(`fake-spotify: volume -> ${volume.toFixed(2)}`);
    return true;
  }

  if (name === 'LoopStatus') {
    loopStatus = value.deepUnpack();
    print(`fake-spotify: loop -> ${loopStatus}`);
    return true;
  }

  if (name === 'Shuffle') {
    shuffle = value.deepUnpack();
    print(`fake-spotify: shuffle -> ${shuffle}`);
    return true;
  }

  return false;
}

function onBusAcquired(connection) {
  const node = Gio.DBusNodeInfo.new_for_xml(XML);
  for (const info of node.interfaces) {
    connection.register_object(
      '/org/mpris/MediaPlayer2', info,
      onMethodCall, onGetProperty, onSetProperty);
  }
  print('fake-spotify: ready on org.mpris.MediaPlayer2.spotify');
}

Gio.bus_own_name(
  Gio.BusType.SESSION,
  'org.mpris.MediaPlayer2.spotify',
  Gio.BusNameOwnerFlags.NONE,
  onBusAcquired, null, null);

GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
  if (playing) {
    position += 1000000;
    if (position >= TRACKS[index].duration * 1000000) {
      if (loopStatus === 'Track') {
        position = 0;
        print(`fake-spotify: loop track ${TRACKS[index].title}`);
      } else {
        index = (index + 1) % TRACKS.length;
        position = 0;
        print(`fake-spotify: next track ${TRACKS[index].title}`);
      }
    }
  }
  return GLib.SOURCE_CONTINUE;
});

GLib.MainLoop.new(null, false).run();
