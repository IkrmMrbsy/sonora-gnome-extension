import GLib from 'gi://GLib';

import {VolumeController} from './volume.js';

function check(condition, message) {
  if (!condition)
    throw new Error(message);
}

function wait(ms) {
  return new Promise(resolve => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
      resolve();
      return GLib.SOURCE_REMOVE;
    });
  });
}

let current = 0.8;
let paused = 0;
const spotify = {
  volume: () => current,
  setVolume: value => {
    current = value;
  },
  pause: () => {
    paused++;
  },
};

const controller = new VolumeController(spotify);
const loop = GLib.MainLoop.new(null, false);

(async () => {
  try {
    controller.duck();
    await wait(700);
    check(Math.abs(current - 0.24) < 0.02, `duck should reach ~0.24, got ${current.toFixed(2)}`);

    controller.unduck();
    await wait(900);
    check(Math.abs(current - 0.8) < 0.02, `unduck should restore ~0.80, got ${current.toFixed(2)}`);
    check(paused === 0, 'pause must not be called while ducking');

    await controller.fadeOutAndPause();
    check(paused === 1, `pause should be called once, got ${paused}`);
    check(Math.abs(current - 0.8) < 0.02, `volume should be restored after pause, got ${current.toFixed(2)}`);

    print('volume.js OK');
  } catch (error) {
    print(`FAIL: ${error.message}`);
    imports.system.exit(1);
  } finally {
    loop.quit();
  }
})();

loop.run();
