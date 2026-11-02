import {PlaybackTracker, playThreshold} from '../src/core/playback.js';

function check(condition, message) {
  if (!condition)
    throw new Error(`FAIL: ${message}`);
}

function feed(tracker, track, samples) {
  let counts = 0;
  let seconds = 0;
  for (const [now, position] of samples) {
    const result = tracker.update(track, position, now, true);
    counts += result.counted ? 1 : 0;
    seconds += result.seconds;
  }
  return {counts, seconds};
}

const long = {id: 'long', duration: 60};
const short = {id: 'short', duration: 20};
const other = {id: 'other', duration: 100};

check(playThreshold(60) === 30, '60s threshold is 30s');
check(playThreshold(20) === 10, '20s threshold is half the duration');
check(playThreshold(0) === 30, 'unknown duration uses 30s');

{
  const tracker = new PlaybackTracker();
  const result = feed(tracker, long, [[0, 0], [10, 10], [20, 20], [30, 30], [40, 40]]);
  check(result.counts === 1, 'one pass counts one play');
  check(result.seconds === 40, `one pass counts 40s, got ${result.seconds}`);
}

{
  const tracker = new PlaybackTracker();
  const result = feed(tracker, long, [
    [0, 0], [30, 30], [60, 60],
    [61, 0], [71, 10], [81, 20], [91, 30],
  ]);
  check(result.counts === 2, 'replay counts a second play');
}

{
  const tracker = new PlaybackTracker();
  const first = feed(tracker, long, [[0, 0], [10, 10], [20, 20]]);
  tracker.pause(20, 20);
  const second = feed(tracker, long, [[30, 20], [40, 25], [50, 30]]);
  check(first.counts + second.counts === 1, 'pause and resume must not double count');
  check(first.seconds + second.seconds === 30,
    `pause should not add listening seconds, got ${first.seconds + second.seconds}`);
}

{
  const tracker = new PlaybackTracker();
  let counts = 0;
  let time = 0;
  for (let i = 0; i < 10; i++) {
    const result = feed(tracker, short, [[time++, 0], [time + 9, 10]]);
    time += 10;
    counts += result.counts;
  }
  check(counts === 10, `short track repeats should count 10 plays, got ${counts}`);
}

{
  const tracker = new PlaybackTracker();
  const result = feed(tracker, other, [
    [0, 0], [30, 30], [40, 40], [41, 5], [71, 35],
  ]);
  check(result.counts === 2, 'seek back below threshold re-arms the play');
}

{
  const tracker = new PlaybackTracker();
  const result = feed(tracker, other, [
    [0, 0], [30, 30], [40, 40], [41, 35], [42, 36],
  ]);
  check(result.counts === 1, 'seek back above threshold must not count immediately');
}

{
  const tracker = new PlaybackTracker();
  const a = feed(tracker, long, [[0, 0], [30, 30]]);
  const b = feed(tracker, other, [[31, 0], [61, 30]]);
  check(a.counts === 1 && b.counts === 1, 'track change resets the play marker');
}

{
  const tracker = new PlaybackTracker();
  const result = feed(tracker, {id: 'gap', duration: 120}, [[0, 10], [5, 15], [10, 20]]);
  check(result.seconds === 10, `timer gap must use position delta, got ${result.seconds}`);
}

{
  const tracker = new PlaybackTracker();
  const result = feed(tracker, {id: 'missing-pos', duration: 120},
    [[0, null], [4, null], [5, 20]]);
  check(result.seconds === 5, `missing position should fall back to wall time, got ${result.seconds}`);
}

{
  const tracker = new PlaybackTracker();
  const result = feed(tracker, other, [[0, 0], [10, 60]]);
  check(result.counts === 0, 'forward seek past the threshold must not count a play');
  check(result.seconds === 10, `forward seek should count wall time, got ${result.seconds}`);
}

print('playback.js OK');
