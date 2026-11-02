import {ArtTracker} from '../src/core/art.js';

function check(condition, message) {
  if (!condition)
    throw new Error(`FAIL: ${message}`);
}

const tracker = new ArtTracker(1000);
check(!tracker.hasState(), 'new tracker is empty');

const first = tracker.begin('cover-a', 0);
check(first?.token === 1, 'begin returns a token');
check(tracker.loading === 'cover-a' && tracker.for === null, 'begin marks loading');
check(tracker.begin('cover-a', 0) === null, 'same URL is not loaded twice');

check(tracker.finish(first.token, 'cover-a', true, 10) === true, 'success finishes');
check(tracker.for === 'cover-a' && tracker.loading === null, 'success stores loaded URL');
check(tracker.begin('cover-a', 10) === null, 'loaded URL is not reloaded');

const second = tracker.begin('cover-b', 20);
check(second?.previous === 'cover-a', 'new URL reports previous art');
check(tracker.for === null && tracker.loading === 'cover-b', 'new URL clears old art');
check(tracker.finish(first.token, 'cover-a', true, 30) === null,
  'stale success is ignored');

check(tracker.finish(second.token, 'cover-b', false, 30) === false, 'failure finishes');
check(tracker.failedFor === 'cover-b' && tracker.for === null, 'failure is tracked');
check(tracker.begin('cover-b', 1029) === null, 'failure respects retry cooldown');
check(tracker.begin('cover-b', 1031)?.token === 3, 'retry after cooldown');

const third = tracker.begin('cover-c', 2000);
tracker.clear();
check(!tracker.hasState(), 'clear removes state');
check(tracker.finish(third.token, 'cover-c', true, 2001) === null,
  'clear invalidates pending work');

tracker.finish(tracker.begin('cover-d', 3000).token, 'cover-d', true, 3001);
tracker.begin(null, 3002);
check(!tracker.hasState(), 'empty URL clears art state');

print('art.js OK');
