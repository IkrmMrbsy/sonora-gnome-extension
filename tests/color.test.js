import {averageColor} from '../src/util/color.js';

function check(condition, message) {
  if (!condition)
    throw new Error(`FAIL: ${message}`);
}

const red = new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255]);
check(JSON.stringify(averageColor(red, 8, 2, 1)) === '[255,0,0]', 'average of red pixels');

const grey = new Uint8Array([128, 128, 128, 255, 128, 128, 128, 255]);
check(JSON.stringify(averageColor(grey, 8, 2, 1)) === '[128,128,128]', 'fallback to all pixels when unsaturated');

print('color.js OK');
