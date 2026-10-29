export const VERSION = 2;

function emptyDay() {
  return {seconds: 0, plays: 0, artists: {}, tracks: {}};
}

function normalizeDay(raw) {
  if (typeof raw === 'number')
    return {...emptyDay(), seconds: Number(raw) || 0};

  const day = emptyDay();
  if (raw && typeof raw === 'object') {
    day.seconds = Number(raw.seconds) || 0;
    day.plays = Number(raw.plays) || 0;
    day.artists = {...(raw.artists ?? {})};
    day.tracks = {...(raw.tracks ?? {})};
  }
  return day;
}

export function emptyStats() {
  return {
    version: VERSION,
    total: 0,
    days: {},
    tracks: {},
    artists: {},
  };
}

export function normalizeStats(raw) {
  const stats = emptyStats();
  if (!raw || typeof raw !== 'object')
    return stats;

  stats.total = Number(raw.total) || 0;
  for (const [key, value] of Object.entries(raw.days ?? {}))
    stats.days[key] = normalizeDay(value);
  stats.tracks = {...(raw.tracks ?? {})};
  stats.artists = {...(raw.artists ?? {})};

  return stats;
}

export function trackKey(artist, title) {
  return artist ? `${artist} – ${title}` : title;
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
  if (artist)
    bucket.artists[artist] = (bucket.artists[artist] ?? 0) + seconds;
  bucket.tracks[key] = (bucket.tracks[key] ?? 0) + seconds;
  stats.days[day] = bucket;

  const track = stats.tracks[key] ?? {seconds: 0, plays: 0};
  track.seconds += seconds;
  stats.tracks[key] = track;

  if (artist)
    stats.artists[artist] = (stats.artists[artist] ?? 0) + seconds;
}

export function addPlay(stats, {artist, title, day}) {
  const key = trackKey(artist, title);
  const track = stats.tracks[key] ?? {seconds: 0, plays: 0};
  track.plays += 1;
  stats.tracks[key] = track;

  if (day) {
    const bucket = stats.days[day] ?? emptyDay();
    bucket.plays += 1;
    stats.days[day] = bucket;
  }
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
  const out = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const key = dayKey(date);
    out.push({key, seconds: daySeconds(stats.days, key), plays: stats.days[key]?.plays ?? 0,
      artists: stats.days[key]?.artists ?? {}});
  }
  return out;
}

export function weekTopArtist(stats, now = new Date()) {
  const artists = {};
  for (const day of weekBuckets(stats, now)) {
    for (const [name, seconds] of Object.entries(day.artists))
      artists[name] = (artists[name] ?? 0) + seconds;
  }
  const top = Object.entries(artists).sort((a, b) => b[1] - a[1])[0];
  return top ? [top[0], top[1]] : null;
}

export function todaySeconds(stats, now = new Date()) {
  return daySeconds(stats.days, dayKey(now));
}

export function todayPlays(stats, now = new Date()) {
  return stats.days[dayKey(now)]?.plays ?? 0;
}
