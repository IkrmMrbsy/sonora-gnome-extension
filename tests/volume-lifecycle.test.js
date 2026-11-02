import GLib from 'gi://GLib';

import {VolumeController} from '../src/core/volume.js';

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

function makeSpotify() {
  const state = {
    current: 0.8,
    paused: 0,
    played: 0,
    status: 'Playing',
  };

  return {
    state,
    volume: () => state.current,
    setVolume: value => {
      state.current = value;
    },
    status: () => state.status,
    pause: () => {
      state.paused++;
    },
    play: () => {
      state.played++;
    },
  };
}

const loop = GLib.MainLoop.new(null, false);

(async () => {
  try {
    const ducked = makeSpotify();
    const duckedController = new VolumeController(ducked);
    duckedController.duck();
    await wait(500);
    check(ducked.state.current < 0.3, 'duck should lower volume');
    duckedController.destroy();
    check(Math.abs(ducked.state.current - 0.8) < 0.02, 'destroy should restore ducked volume');
    check(ducked.state.paused === 0, 'destroy must not pause while ducked');

    const paused = makeSpotify();
    const pausedController = new VolumeController(paused);
    pausedController.pauseForMic();
    check(paused.state.paused === 1, 'pauseForMic should pause playback');
    pausedController.destroy();
    check(paused.state.played === 1, 'destroy should resume playback paused for mic');

    const interrupted = makeSpotify();
    const interruptedController = new VolumeController(interrupted);
    let settled = false;
    const sleep = interruptedController.fadeOutAndPause().then(() => {
      settled = true;
    });
    await wait(250);
    interruptedController.duck();
    await sleep;
    check(settled, 'interrupted fadeOutAndPause must settle');
    check(interrupted.state.paused === 0, 'interrupted sleep fade must not pause');
    await wait(500);
    check(interrupted.state.current < 0.3, 'duck should still take effect after interruption');
    interruptedController.destroy();
    check(Math.abs(interrupted.state.current - 0.8) < 0.02, 'destroy should restore volume after interrupted duck');

    const destroyed = makeSpotify();
    const destroyedController = new VolumeController(destroyed);
    const fading = destroyedController.fadeOutAndPause();
    await wait(200);
    destroyedController.destroy();
    await fading;
    check(destroyed.state.paused === 0, 'destroy during sleep fade must not pause');
    check(Math.abs(destroyed.state.current - 0.8) < 0.02, 'destroy during sleep fade should restore volume');

    print('volume lifecycle OK');
  } catch (error) {
    print(`FAIL: ${error.message}`);
    imports.system.exit(1);
  } finally {
    loop.quit();
  }
})();

loop.run();
