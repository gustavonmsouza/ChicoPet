'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AutonomousController, STATES } = require('../src/main/autonomousController');

function rig({ x = -40, area = { x: -100, y: 0, width: 500, height: 400 }, random = () => 0.99 } = {}) {
  let now = 1000;
  let intervalCallback;
  const timeouts = new Map();
  let nextId = 1;
  const bounds = { x, y: 20, width: 100, height: 100 };
  const win = {
    isDestroyed: () => false,
    isVisible: () => true,
    getBounds: () => ({ ...bounds }),
    setBounds: (next) => Object.assign(bounds, next),
  };
  const controller = new AutonomousController({
    getWindow: () => win,
    getWorkArea: () => area,
    random,
    now: () => now,
    tickMs: 40,
    setIntervalFn: (fn) => { intervalCallback = fn; return 1; },
    clearIntervalFn: () => { intervalCallback = null; },
    setTimeoutFn: (fn) => { const id = nextId++; timeouts.set(id, fn); return id; },
    clearTimeoutFn: (id) => timeouts.delete(id),
  });
  return {
    controller, win, bounds, timeouts,
    tick: (advance = 40) => { now += advance; intervalCallback?.(); },
    fireTimeout: (id) => { const fn = timeouts.get(id); timeouts.delete(id); fn?.(); },
    now: () => now,
  };
}

test('destination selection respects a work area with negative monitor coordinates', () => {
  const r = rig({ x: 250 });
  r.controller.start();
  r.controller.chooseDestination(true);
  assert.ok(r.controller.targetX >= -100);
  assert.ok(r.controller.targetX <= 300); // area right - window width
  assert.equal(r.controller.state, STATES.RUNNING);
});

test('movement advances gradually, stops at destination and returns to IDLE', () => {
  const r = rig({ x: -50 });
  const changes = [];
  r.controller.onState = ({ state }) => changes.push(state);
  r.controller.start();
  r.controller.targetX = -40;
  r.controller.state = STATES.WALKING;
  r.tick(40);
  assert.equal(r.bounds.x, -46);
  assert.equal(r.controller.state, STATES.WALKING);
  r.tick(1000);
  assert.equal(r.bounds.x, -40);
  assert.equal(r.controller.state, STATES.IDLE);
  assert.ok(changes.includes(STATES.IDLE));
});

test('dragging suspends autonomous movement and schedules a delayed resume', () => {
  const r = rig({ x: 10 });
  r.controller.start();
  r.controller.state = STATES.WALKING;
  r.controller.targetX = 250;
  r.controller.startDrag();
  r.tick(500);
  assert.equal(r.bounds.x, 10);
  assert.equal(r.controller.targetX, null);
  r.controller.endDrag();
  const resumeId = r.controller.resumeTimer;
  r.fireTimeout(resumeId);
  assert.equal(r.controller.state, STATES.IDLE);
  assert.ok(r.controller.nextActivityAt > r.now());
});

test('interaction cancels pending drag resume and returns from HAPPY to IDLE', () => {
  const r = rig();
  r.controller.start();
  r.controller.endDrag();
  const oldResume = r.controller.resumeTimer;
  r.controller.interact();
  assert.equal(r.timeouts.has(oldResume), false);
  assert.equal(r.controller.state, STATES.INTERACTING);
  const interactionTimeout = r.controller.interactionTimer;
  r.fireTimeout(interactionTimeout);
  assert.equal(r.controller.state, STATES.HAPPY);
  const happyTimeout = r.controller.stateTimer;
  r.fireTimeout(happyTimeout);
  assert.equal(r.controller.state, STATES.IDLE);
});

test('long idle can enter SLEEPING, then wake back to IDLE', () => {
  const values = [0, 0, 0, 0];
  const r = rig({ random: () => values.shift() ?? 0 });
  r.controller.start();
  r.tick(7000);
  assert.equal(r.controller.state, STATES.SLEEPING);
  const sleepTimeout = r.controller.stateTimer;
  r.fireTimeout(sleepTimeout);
  assert.equal(r.controller.state, STATES.IDLE);
});

test('stop clears the interval and all pending timeout tasks', () => {
  const r = rig();
  r.controller.start();
  r.controller.endDrag();
  r.controller.interact();
  r.controller.stop();
  assert.equal(r.timeouts.size, 0);
  assert.equal(r.controller.running, false);
  assert.equal(r.controller.timer, null);
});
