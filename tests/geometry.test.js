import {clampStatsHeight, progressGeometry} from '../src/ui/geometry.js';

function check(condition, message) {
  if (!condition)
    throw new Error(`FAIL: ${message}`);
}

const mid = progressGeometry(300, 40, 40, 30, 60, 9);
check(mid.width === 204, `bar width, got ${mid.width}`);
check(mid.fillWidth === 102, `fill width, got ${mid.fillWidth}`);
check(mid.knobX === 98, `knob position, got ${mid.knobX}`);

const start = progressGeometry(300, 40, 40, 0, 60, 9);
check(start.fillWidth === 0 && start.knobX === 0, 'zero progress clamps the knob');

const end = progressGeometry(300, 40, 40, 60, 60, 9);
check(end.fillWidth === 204 && end.knobX === 195, 'full progress clamps the knob');

const narrow = progressGeometry(10, 20, 20, 10, 60, 9);
check(narrow.width === 0 && narrow.fillWidth === 0 && narrow.knobX === 0,
  'narrow row does not produce negative geometry');

check(clampStatsHeight(120) === 160, 'stats height has a minimum');
check(clampStatsHeight(260) === 260, 'stats height keeps natural size');
check(clampStatsHeight(500) === 360, 'stats height has a maximum');

print('geometry.js OK');
