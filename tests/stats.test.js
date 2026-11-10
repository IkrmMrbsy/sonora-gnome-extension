import {
  addListen, addPlay, currentStreak, dayKey, emptyStats, lastNDays,
  normalizeStats, pruneStats, todayPlays, todaySeconds, trackKey,
  weekTopArtist, weekTracks,
} from '../src/core/stats.js';

function check(condition, message) {
  if (!condition)
    throw new Error(`FAIL: ${message}`);
}

const stats = emptyStats();
addListen(stats, {artist: 'A', title: 'T1', seconds: 60, day: '2026-10-28'});
addListen(stats, {artist: 'A', title: 'T1', seconds: 30, day: '2026-10-28'});
addListen(stats, {artist: 'B', title: 'T2', seconds: 120, day: '2026-10-27'});

check(stats.total === 210, 'total seconds');
check(stats.days['2026-10-28'].seconds === 90, 'day bucket');
check(stats.days['2026-10-28'].artists.A === 90, 'day artist bucket');
check(stats.days['2026-10-28'].tracks[trackKey('A', 'T1')].seconds === 90, 'day track seconds');
check(stats.tracks === undefined && stats.artists === undefined,
  'top-level track and artist maps are not stored');

addListen(stats, {artist: '', title: 'Ad', seconds: 15, day: '2026-10-28'});
check(stats.total === 225, 'ads still count toward total time');
check(stats.days['2026-10-28'].seconds === 105, 'ads count toward the day');

addPlay(stats, {artist: 'A', title: 'T1', day: '2026-10-28'});
check(stats.days['2026-10-28'].tracks[trackKey('A', 'T1')].plays === 1,
  'day track plays');
check(stats.days['2026-10-28'].plays === 1, 'day play count');

check(currentStreak({'2026-10-28': 10, '2026-10-27': 5, '2026-10-25': 5},
  new Date(2026, 9, 28)) === 2, 'streak accepts legacy numbers');
check(currentStreak({'2026-10-28': {seconds: 10}, '2026-10-27': {seconds: 5}},
  new Date(2026, 9, 28)) === 2, 'streak with day objects');
check(currentStreak({'2026-10-27': 10, '2026-10-26': 5},
  new Date(2026, 9, 28)) === 2, 'streak retains yesterday when today is unplayed');
check(currentStreak({'2026-10-26': 10},
  new Date(2026, 9, 28)) === 0, 'streak breaks when yesterday had no listening');
check(currentStreak({'2026-10-28': 15, '2026-10-27': 10, '2026-10-26': 5},
  new Date(2026, 9, 28)) === 3, 'streak increments when today has activity');
check(currentStreak({}, new Date(2026, 9, 28)) === 0, 'empty streak');

check(dayKey(new Date(2026, 0, 5)) === '2026-01-05', 'day key padding');

const days = lastNDays(stats, 7, new Date(2026, 9, 28));
check(days.length === 7 && days[6].key === '2026-10-28', 'last 7 days ends today');
check(days[6].seconds === 105, 'last day seconds');

const now = new Date(2026, 9, 28);
check(todaySeconds(stats, now) === 105, 'today seconds');
check(todayPlays(stats, now) === 1, 'today plays');
check(weekTopArtist(stats, now)[0] === 'B', 'week top artist');

const top = weekTracks(stats, now);
check(top[0].title === 'T1' && top[0].plays === 1,
  'week tracks rank by plays, not seconds');
check(top.every(entry => entry.artist), 'week tracks filter advertisements');

const normalized = normalizeStats({total: 'x', tracks: null,
  days: {'2026-10-28': 90, '2026-10-27': {seconds: 5, plays: 2, artists: {A: 5}}}});
check(normalized.total === 0, 'bad total is coerced');
check(normalized.days['2026-10-28'].seconds === 90, 'legacy number day migrates');
check(normalized.days['2026-10-27'].plays === 2, 'day plays survive');
check(normalized.days['2026-10-27'].artists.A === 5, 'day artists survive');
check(normalized.tracks === undefined && normalized.artists === undefined,
  'normalize drops unused top-level maps');
check(normalizeStats(null).total === 0, 'null normalizes');

const old = emptyStats();
addListen(old, {artist: 'A', title: 'Old', seconds: 60, day: '2026-10-10'});
addPlay(old, {artist: 'A', title: 'Old', day: '2026-10-10'});
addListen(old, {artist: 'B', title: 'Fresh', seconds: 30, day: '2026-10-28'});
addListen(old, {artist: 'C', title: 'Edge', seconds: 30, day: '2026-10-19'});
addListen(old, {artist: 'D', title: 'Older', seconds: 30, day: '2026-10-18'});
check(pruneStats(old, new Date(2026, 9, 28)) === true, 'prune reports changes');
check(old.days['2026-10-10'].seconds === 60 && old.days['2026-10-10'].plays === 1,
  'prune keeps aggregate seconds and plays');
check(old.days['2026-10-10'].artists === undefined &&
  old.days['2026-10-10'].tracks === undefined, 'prune removes old detail');
check(old.days['2026-10-28'].artists.B === 30 &&
  old.days['2026-10-28'].tracks[trackKey('B', 'Fresh')].seconds === 30,
  'prune keeps recent detail');
check(old.days['2026-10-19'].artists.C === 30,
  'prune keeps the tenth day');
check(old.days['2026-10-18'].artists === undefined,
  'prune removes detail older than ten days');
check(pruneStats(old, new Date(2026, 9, 28)) === false, 'second prune is a no-op');

print('stats.js OK');
