import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationPlayer } from '../src/renderer/scripts/animationPlayer.js';

function fakeTimers() {
  let id = 0;
  const tasks = new Map();
  const delays = new Map();
  return {
    tasks,
    delays,
    setTimeoutFn: (fn, delay) => { const key = ++id; tasks.set(key, fn); delays.set(key, delay); return key; },
    clearTimeoutFn: (key) => { delays.delete(key); return tasks.delete(key); },
    advance: () => {
      const [key, fn] = tasks.entries().next().value || [];
      if (key) { tasks.delete(key); delays.delete(key); fn(); }
    },
  };
}

test('plays frames in order and loops only when configured', () => {
  const timers = fakeTimers();
  const frames = [];
  const player = new AnimationPlayer({ onFrame: (frame) => frames.push(frame), ...timers });
  player.play({ id: 'test-loop', frames: ['a', 'b'], fps: 10, loop: true });
  timers.advance();
  timers.advance();
  assert.deepEqual(frames, ['a', 'b', 'a']);
});

test('passes spritesheet frame descriptors through unchanged', () => {
  const timers = fakeTimers();
  const frames = [];
  const firstFrame = { column: 0, row: 2 };
  const secondFrame = { column: 1, row: 2 };
  const player = new AnimationPlayer({ onFrame: (frame) => frames.push(frame), ...timers });
  player.play({ id: 'walk', frames: [firstFrame, secondFrame], fps: 8, loop: true });
  timers.advance();
  assert.deepEqual(frames, [firstFrame, secondFrame]);
});

test('playback rate changes reschedule the active frame without restarting it', () => {
  const timers = fakeTimers();
  const frames = [];
  const player = new AnimationPlayer({ onFrame: (frame) => frames.push(frame), ...timers });
  player.play({ id: 'walk', frames: ['walk-1', 'walk-2'], fps: 8, loop: true });
  const firstTimer = [...timers.tasks.keys()][0];
  assert.equal(timers.delays.get(firstTimer), 125);
  assert.equal(player.setFps(4), true);
  assert.equal(player.frameIndex, 0);
  assert.equal(timers.tasks.size, 1);
  assert.equal(timers.delays.values().next().value, 250);
  timers.advance();
  assert.deepEqual(frames, ['walk-1', 'walk-2']);
});

test('paused playback can advance one frame at a time without scheduling timers', () => {
  const timers = fakeTimers();
  const frames = [];
  const player = new AnimationPlayer({ onFrame: (frame) => frames.push(frame), ...timers });
  player.play({ id: 'walk', frames: ['walk-1', 'walk-2', 'walk-3'], fps: 8, loop: true });
  player.setPaused(true);
  assert.equal(player.step(), true);
  assert.equal(player.step(), true);
  assert.deepEqual(frames, ['walk-1', 'walk-2', 'walk-3']);
  assert.equal(timers.tasks.size, 0);
  assert.equal(player.step(), true);
  assert.equal(frames.at(-1), 'walk-1');
});

test('one-shot stops at the last frame and replacement cancels prior playback', () => {
  const timers = fakeTimers();
  const frames = [];
  const player = new AnimationPlayer({ onFrame: (frame) => frames.push(frame), ...timers });
  player.play({ id: 'one-shot', frames: ['fall-1', 'fall-2'], fps: 12, loop: false });
  timers.advance();
  timers.advance();
  assert.deepEqual(frames, ['fall-1', 'fall-2']);
  assert.equal(player.animation, null);
  player.play({ id: 'replace-me', frames: ['old-1', 'old-2'], fps: 12, loop: true });
  player.play({ id: 'new', frames: ['new-1'], fps: 1, loop: true });
  assert.equal(timers.tasks.size, 0);
  assert.equal(frames.at(-1), 'new-1');
});
