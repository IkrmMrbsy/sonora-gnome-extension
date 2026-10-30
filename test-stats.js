import {
  addListen, addPlay, currentStreak, dayKey, emptyStats, lastNDays,
  normalizeStats, todayPlays, todaySeconds, trackKey, weekTopArtist,
} from './stats.js';

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
check(stats.tracks[trackKey('A', 'T1')].seconds === 90, 'track seconds');
check(stats.artists.A === 90 && stats.artists.B === 120, 'artist seconds');

addListen(stats, {artist: '', title: 'Ad', seconds: 15, day: '2026-10-28'});
check(stats.artists[''] === undefined, 'ads are not attributed to an artist');
check(stats.total === 225, 'ads still count toward total time');
check(stats.days['2026-10-28'].seconds === 105, 'ads count toward the day');

addPlay(stats, {artist: 'A', title: 'T1', day: '2026-10-28'});
check(stats.tracks[trackKey('A', 'T1')].plays === 1, 'play count');
check(stats.days['2026-10-28'].tracks[trackKey('A', 'T1')].plays === 1,
  'day track plays');
check(stats.days['2026-10-28'].plays === 1, 'day play count');

check(currentStreak({'2026-10-28': 10, '2026-10-27': 5, '2026-10-25': 5},
  new Date(2026, 9, 28)) === 2, 'streak accepts legacy numbers');
check(currentStreak({'2026-10-28': {seconds: 10}, '2026-10-27': {seconds: 5}},
  new Date(2026, 9, 28)) === 2, 'streak with day objects');
check(currentStreak({}, new Date(2026, 9, 28)) === 0, 'empty streak');

check(dayKey(new Date(2026, 0, 5)) === '2026-01-05', 'day key padding');

const days = lastNDays(stats, 7, new Date(2026, 9, 28));
check(days.length === 7 && days[6].key === '2026-10-28', 'last 7 days ends today');
check(days[6].seconds === 105, 'last day seconds');

const now = new Date(2026, 9, 28);
check(todaySeconds(stats, now) === 105, 'today seconds');
check(todayPlays(stats, now) === 1, 'today plays');
check(weekTopArtist(stats, now)[0] === 'B', 'week top artist');

const normalized = normalizeStats({total: 'x', tracks: null,
  days: {'2026-10-28': 90, '2026-10-27': {seconds: 5, plays: 2, artists: {A: 5}}}});
check(normalized.total === 0, 'bad total is coerced');
check(normalized.days['2026-10-28'].seconds === 90, 'legacy number day migrates');
check(normalized.days['2026-10-27'].plays === 2, 'day plays survive');
check(normalized.days['2026-10-27'].artists.A === 5, 'day artists survive');
check(normalizeStats(null).total === 0, 'null normalizes');

print('stats.js OK');
