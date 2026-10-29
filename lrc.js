const STAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

export function parseLRC(text) {
  const lines = [];
  if (!text)
    return lines;

  for (const raw of text.split('\n')) {
    STAMP.lastIndex = 0;
    const times = [];
    let match;
    while ((match = STAMP.exec(raw))) {
      const frac = match[3] ? parseInt(match[3].padEnd(3, '0')) / 1000 : 0;
      times.push(parseInt(match[1]) * 60 + parseInt(match[2]) + frac);
    }
    if (!times.length)
      continue;

    const lyric = raw.replace(STAMP, '').trim();
    if (!lyric)
      continue;

    for (const time of times)
      lines.push({time, text: lyric});
  }

  lines.sort((a, b) => a.time - b.time);
  return lines;
}

export function activeLine(lines, position) {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].time <= position) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found;
}
