import {activeLine, parseLRC} from './lrc.js';

function check(condition, message) {
  if (!condition)
    throw new Error(`FAIL: ${message}`);
}

const lines = parseLRC(`[ar:Foo Fighters]
[00:12.50]Hello there
[00:15.00][01:00.00]Chorus line
[00:20.123]Third`);

check(lines.length === 4, `expected 4 lines, got ${lines.length}`);
check(lines[0].text === 'Hello there', 'first line text');
check(Math.abs(lines[0].time - 12.5) < 1e-6, 'first line time');
check(lines[1].time === 15 && lines[3].time === 60, 'multi-timestamp split');
check(Math.abs(lines[2].time - 20.123) < 1e-6, 'millisecond timestamp');

check(activeLine(lines, 0) === -1, 'before first line');
check(activeLine(lines, 14.9) === 0, 'between lines');
check(activeLine(lines, 15) === 1, 'exact boundary');
check(activeLine(lines, 20.2) === 2, 'third line');
check(activeLine(lines, 999) === 3, 'after last line');
check(activeLine([], 10) === -1, 'empty input');

print('lrc.js OK');
