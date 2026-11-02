import {configNeedsRelayout} from '../src/core/settings.js';

function check(condition, message) {
  if (!condition)
    throw new Error(`FAIL: ${message}`);
}

check(configNeedsRelayout(null) === true, 'missing key means relayout');
check(configNeedsRelayout('mode') === true, 'mode changes layout');
check(configNeedsRelayout('position') === true, 'position changes layout');
check(configNeedsRelayout('duck-level') === false, 'duck-level keeps the card open');
check(configNeedsRelayout('sleep-minutes') === false, 'sleep keeps the card open');
check(configNeedsRelayout('lyrics-visible') === false, 'lyrics visibility keeps the card open');

print('settings.js OK');
