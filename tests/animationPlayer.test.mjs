import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationPlayer } from '../src/renderer/scripts/animationPlayer.js';

function fakeTimers() {
  let id = 0;
  const tasks = new Map();
  return {
    tasks,
    setTimeoutFn: (fn) => { const key = ++id; tasks.set(key, fn); return key; },
    clearTimeoutFn: (key) => tasks.delete(key),
    advance: () => { const [key, fn] = tasks.entries().next().value || []; if (key) { tasks.delete(key); fn(); } },
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
