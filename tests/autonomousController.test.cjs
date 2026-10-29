'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { AutonomousController, STATES } = require('../src/main/autonomousController');

function rig({ x = -40, y, area = { x: -100, y: 0, width: 500, height: 400 }, displayArea = area, random = () => 0.99, groundMargin = 0 } = {}) {
  let now = 1000;
  let intervalCallback;
  const timeouts = new Map();
  let nextId = 1;
  const bounds = { x, y: y ?? area.y + area.height - 100 - groundMargin, width: 100, height: 100 };
  const win = {
    isDestroyed: () => false,
    isVisible: () => true,
    getBounds: () => ({ ...bounds }),
    setBounds: (next) => Object.assign(bounds, next),
  };
  const controller = new AutonomousController({
    getWindow: () => win,
    getWorkArea: () => area,
    getGroundArea: () => displayArea,
    groundMargin,
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

test('ground position uses the physical display edge below the Dock work area', () => {
  const r = rig({
    area: { x: 0, y: 24, width: 1000, height: 700 },
    displayArea: { x: 0, y: 0, width: 1000, height: 800 },
  });
  assert.equal(r.controller.floorY(r.bounds), 700);
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

test('horizontal drag updates the retained facing direction for the fall', () => {
  const r = rig();
  const states = [];
  r.controller.onState = ({ direction }) => states.push(direction);
  r.controller.start();
  r.controller.startDrag();
  r.controller.setDirection(-1);
  r.controller.endDrag();
  assert.equal(r.controller.direction, -1);
  assert.ok(states.includes(-1));
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

test('release above ground falls with time-based gravity, lands and recovers', () => {
  const r = rig({ x: -40, y: 30 });
  r.controller.start();
  r.controller.startDrag();
  r.controller.endDrag();
  assert.equal(r.controller.state, STATES.FALLING);
  const floor = 400 - 100;
  for (let i = 0; i < 20 && r.controller.state === STATES.FALLING; i++) r.tick(40);
  assert.equal(r.controller.state, STATES.LANDING);
  assert.equal(r.bounds.y, floor);
  const landing = r.controller.stateTimer;
  r.fireTimeout(landing);
  assert.equal(r.controller.state, STATES.RECOVERING);
  const recovery = r.controller.stateTimer;
  r.fireTimeout(recovery);
  assert.equal(r.controller.state, STATES.IDLE);
  assert.equal(r.bounds.y, floor);
});

test('dragging during a fall cancels vertical movement and a new release restarts it', () => {
  const r = rig({ y: 0 });
  r.controller.start();
  r.controller.startDrag();
  r.controller.endDrag();
  assert.equal(r.controller.state, STATES.FALLING);
  r.tick(40);
  const yDuringFall = r.bounds.y;
  r.controller.startDrag();
  r.tick(400);
  assert.equal(r.controller.state, STATES.DRAGGING);
  assert.equal(r.bounds.y, yDuringFall);
  r.bounds.y = 100;
  r.controller.endDrag();
  assert.equal(r.controller.state, STATES.FALLING);
});

test('a release at the ground snaps to the configured floor without a fall', () => {
  const r = rig({ y: 288, groundMargin: 8 });
  r.controller.start();
  r.controller.startDrag();
  r.controller.endDrag();
  assert.equal(r.controller.state, STATES.IDLE);
  assert.equal(r.bounds.y, 292);
});

test('autonomous walking cannot start while the window is airborne', () => {
  const r = rig({ y: 40 });
  r.controller.start();
  r.controller.chooseDestination();
  assert.equal(r.controller.state, STATES.IDLE);
  assert.equal(r.controller.targetX, null);
});

test('disabling autonomous movement stops walking without disabling manual play', () => {
  const r = rig();
  r.controller.start();
  r.controller.state = STATES.WALKING;
  r.controller.targetX = 250;
  r.controller.setActivityEnabled(false);
  assert.equal(r.controller.state, STATES.IDLE);
  assert.equal(r.controller.targetX, null);
  r.controller.chooseDestination();
  assert.equal(r.controller.targetX, null);
  r.controller.play();
  assert.equal(r.controller.state, STATES.RUNNING);
  assert.notEqual(r.controller.targetX, null);
});

test('activity modes change the movement speed', () => {
  const calm = rig({ x: 0 });
  calm.controller.start();
  calm.controller.setActivityMode('calm');
  calm.controller.targetX = 250;
  calm.controller.state = STATES.WALKING;
  calm.tick(40);

  const playful = rig({ x: 0 });
  playful.controller.start();
  playful.controller.setActivityMode('playful');
  playful.controller.targetX = 250;
  playful.controller.state = STATES.WALKING;
  playful.tick(40);
  assert.ok(playful.bounds.x - 0 > calm.bounds.x - 0);
});

test('disabling movement cancels a pending drag resume timer', () => {
  const r = rig();
  r.controller.start();
  r.controller.endDrag();
  const resumeTimer = r.controller.resumeTimer;
  assert.ok(r.timeouts.has(resumeTimer));
  r.controller.setActivityEnabled(false);
  assert.equal(r.timeouts.has(resumeTimer), false);
  assert.equal(r.controller.resumeTimer, null);
});

test('manual play cancels a pending drag resume and cannot interrupt recovery', () => {
  const grounded = rig();
  grounded.controller.start();
  grounded.controller.endDrag();
  const resumeTimer = grounded.controller.resumeTimer;
  grounded.controller.play();
  assert.equal(grounded.timeouts.has(resumeTimer), false);
  assert.equal(grounded.controller.state, STATES.RUNNING);

  const airborne = rig({ y: 30 });
  airborne.controller.start();
  airborne.controller.startDrag();
  airborne.controller.endDrag();
  airborne.controller.play();
  assert.equal(airborne.controller.state, STATES.FALLING);
});
