export const VERSION = 4;

function emptyDay() {
  return {seconds: 0, plays: 0, artists: {}, tracks: {}};
}

// Day-level tracks store {seconds, plays} so a calendar week can report both
// listening time and play counts. Older files stored a bare number.
function normalizeTrackBucket(raw) {
  if (typeof raw === 'number')
    return {seconds: Number(raw) || 0, plays: 0};

  return {
    seconds: Number(raw?.seconds) || 0,
    plays: Number(raw?.plays) || 0,
  };
}

function normalizeDay(raw) {
  if (typeof raw === 'number')
    return {...emptyDay(), seconds: Number(raw) || 0};

  const day = emptyDay();
  if (raw && typeof raw === 'object') {
    day.seconds = Number(raw.seconds) || 0;
    day.plays = Number(raw.plays) || 0;
    day.artists = {...(raw.artists ?? {})};
    for (const [key, value] of Object.entries(raw.tracks ?? {}))
      day.tracks[key] = normalizeTrackBucket(value);
  }
  return day;
}

export function emptyStats() {
  return {
    version: VERSION,
    total: 0,
    days: {},
  };
}

export function normalizeStats(raw) {
  const stats = emptyStats();
  if (!raw || typeof raw !== 'object')
    return stats;

  stats.total = Number(raw.total) || 0;
  for (const [key, value] of Object.entries(raw.days ?? {}))
    stats.days[key] = normalizeDay(value);

  return stats;
}

export const TRACK_SEPARATOR = ' – ';

export function trackKey(artist, title) {
  return artist ? `${artist}${TRACK_SEPARATOR}${title}` : title;
}

export function dayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addListen(stats, {artist, title, seconds, day}) {
  if (!(seconds > 0) || !title)
    return;

  const key = trackKey(artist, title);
  stats.total += seconds;

  const bucket = stats.days[day] ?? emptyDay();
  bucket.seconds += seconds;
  if (artist) {
    bucket.artists[artist] = (bucket.artists[artist] ?? 0) + seconds;
    const dayTrack = bucket.tracks[key] ?? {seconds: 0, plays: 0};
    dayTrack.seconds += seconds;
    bucket.tracks[key] = dayTrack;
  }
  stats.days[day] = bucket;
}

export function addPlay(stats, {artist, title, day}) {
  if (!artist)
    return;

  const key = trackKey(artist, title);

  if (day) {
    const bucket = stats.days[day] ?? emptyDay();
    bucket.plays += 1;
    const dayTrack = bucket.tracks[key] ?? {seconds: 0, plays: 0};
    dayTrack.plays += 1;
    bucket.tracks[key] = dayTrack;
    stats.days[day] = bucket;
  }
}

export const DETAIL_DAYS = 10;

export function pruneStats(stats, now = new Date(), keepDays = DETAIL_DAYS) {
  if (!stats?.days || !(keepDays > 0))
    return false;

  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (keepDays - 1));
  const cutoffKey = dayKey(cutoff);
  let changed = false;

  for (const [key, day] of Object.entries(stats.days)) {
    if (key >= cutoffKey || !day || typeof day !== 'object')
      continue;

    if ('artists' in day) {
      delete day.artists;
      changed = true;
    }
    if ('tracks' in day) {
      delete day.tracks;
      changed = true;
    }
  }

  return changed;
}

function daySeconds(days, key) {
  const value = days[key];
  if (typeof value === 'number')
    return value;
  return value?.seconds ?? 0;
}

export function currentStreak(days, now = new Date()) {
  const date = new Date(now.getTime());
  let streak = 0;

  while (daySeconds(days, dayKey(date)) > 0) {
    streak++;
    date.setDate(date.getDate() - 1);
  }

  return streak;
}

export function bestStreak(days) {
  const keys = Object.keys(days)
    .filter(key => daySeconds(days, key) > 0)
    .sort();
  let best = 0;
  let run = 0;
  let previous = null;

  for (const key of keys) {
    const date = new Date(`${key}T00:00:00`);
    const gap = previous ? Math.round((date - previous) / 86400000) : null;
    run = gap === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }

  return best;
}

export function lastNDays(stats, count, now = new Date()) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dayKey(date);
    out.push({key, seconds: daySeconds(stats.days, key)});
  }
  return out;
}

function weekStart(now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - shift);
  return date;
}

function weekBuckets(stats, now) {
  const start = weekStart(now);
  const todayKey = dayKey(now);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const key = dayKey(date);
    const day = stats.days[key];
    out.push({
      key,
      date,
      seconds: daySeconds(stats.days, key),
      plays: day?.plays ?? 0,
      artists: day?.artists ?? {},
      tracks: day?.tracks ?? {},
      isToday: key === todayKey,
      isFuture: date > now && key !== todayKey,
    });
  }
  return out;
}

// Calendar week (Monday..Sunday) — the only range the UI shows.
export function currentWeek(stats, now = new Date()) {
  const buckets = weekBuckets(stats, now);
  return {
    days: buckets,
    seconds: buckets.reduce((sum, day) => sum + day.seconds, 0),
    plays: buckets.reduce((sum, day) => sum + day.plays, 0),
    activeDays: buckets.filter(day => day.seconds > 0).length,
  };
}

export function weekTopArtist(stats, now = new Date()) {
  const top = weekArtists(stats, now, 1);
  return top.length ? [top[0].name, top[0].seconds] : null;
}

export function weekArtists(stats, now = new Date(), limit = 5) {
  const artists = {};
  for (const day of weekBuckets(stats, now)) {
    for (const [name, seconds] of Object.entries(day.artists))
      artists[name] = (artists[name] ?? 0) + seconds;
  }

  return Object.entries(artists)
    .map(([name, seconds]) => ({name, seconds}))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, limit);
}

export function weekTracks(stats, now = new Date(), limit = 5) {
  const tracks = {};
  for (const day of weekBuckets(stats, now)) {
    for (const [key, bucket] of Object.entries(day.tracks)) {
      const entry = tracks[key] ?? {key, seconds: 0, plays: 0};
      entry.seconds += bucket.seconds ?? 0;
      entry.plays += bucket.plays ?? 0;
      tracks[key] = entry;
    }
  }

  return Object.values(tracks)
    .map(entry => {
      const split = entry.key.indexOf(TRACK_SEPARATOR);
      return {
        ...entry,
        artist: split === -1 ? '' : entry.key.slice(0, split),
        title: split === -1 ? entry.key : entry.key.slice(split + TRACK_SEPARATOR.length),
      };
    })
    .filter(entry => entry.artist)
    .sort((a, b) => (b.plays - a.plays) || (b.seconds - a.seconds))
    .slice(0, limit);
}

export function todaySeconds(stats, now = new Date()) {
  return daySeconds(stats.days, dayKey(now));
}

export function todayPlays(stats, now = new Date()) {
  return stats.days[dayKey(now)]?.plays ?? 0;
}
