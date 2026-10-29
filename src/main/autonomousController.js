'use strict';

// One owner for autonomous behavior and window movement. Dependencies are injected for tests.
const STATES = Object.freeze({
  IDLE: 'IDLE', WALKING: 'WALKING', RUNNING: 'RUNNING', SLEEPING: 'SLEEPING',
  HAPPY: 'HAPPY', CURIOUS: 'CURIOUS', INTERACTING: 'INTERACTING',
});

class AutonomousController {
  constructor({ getWindow, getWorkArea, onState = () => {}, random = Math.random,
    setIntervalFn = setInterval, clearIntervalFn = clearInterval, setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout, now = Date.now, tickMs = 40 } = {}) {
    this.getWindow = getWindow;
    this.getWorkArea = getWorkArea;
    this.onState = onState;
    this.random = random;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.now = now;
    this.tickMs = tickMs;
    this.state = STATES.IDLE;
    this.direction = 1;
    this.running = false;
    this.dragging = false;
    this.targetX = null;
    this.lastTick = 0;
    this.nextActivityAt = 0;
    this.timer = null;
    this.resumeTimer = null;
    this.stateTimer = null;
    this.interactionTimer = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTick = this.now();
    this.scheduleActivity(2500 + this.random() * 3500);
    this.timer = this.setIntervalFn(() => this.tick(), this.tickMs);
    this.publish();
  }

  stop() {
    this.running = false;
    if (this.timer) this.clearIntervalFn(this.timer);
    if (this.resumeTimer) this.clearTimeoutFn(this.resumeTimer);
    if (this.stateTimer) this.clearTimeoutFn(this.stateTimer);
    if (this.interactionTimer) this.clearTimeoutFn(this.interactionTimer);
    this.timer = this.resumeTimer = this.stateTimer = this.interactionTimer = null;
    this.targetX = null;
  }

  setState(state) {
    if (!Object.values(STATES).includes(state)) return false;
    this.state = state;
    this.publish();
    return true;
  }

  publish() { this.onState({ state: this.state, direction: this.direction }); }

  scheduleActivity(delay) { this.nextActivityAt = this.now() + delay; }

  activityDelay(min, max) { return min + this.random() * (max - min); }

  beginActivity() {
    const roll = this.random();
    if (roll < 0.16) {
      this.targetX = null;
      this.setState(STATES.SLEEPING);
      this.scheduleTimedState(STATES.IDLE, this.activityDelay(18000, 36000), 5000, 11000);
    } else if (roll < 0.31) {
      this.targetX = null;
      this.setState(STATES.CURIOUS);
      this.scheduleTimedState(STATES.IDLE, this.activityDelay(1800, 4200), 1800, 5000);
    } else {
      this.chooseDestination(roll > 0.94);
    }
  }

  scheduleTimedState(next, duration, nextMin, nextMax) {
    if (this.stateTimer) this.clearTimeoutFn(this.stateTimer);
    this.scheduleActivity(duration);
    this.stateTimer = this.setTimeoutFn(() => {
      this.stateTimer = null;
      if (!this.running || this.dragging) return;
      this.setState(next);
      this.scheduleActivity(this.activityDelay(nextMin, nextMax));
    }, duration);
  }

  chooseDestination(run = false) {
    const win = this.getWindow();
    if (!win || win.isDestroyed()) return;
    const bounds = win.getBounds();
    const area = this.getWorkArea(bounds);
    const minX = area.x;
    const maxX = Math.max(minX, area.x + area.width - bounds.width);
    const currentX = Math.max(minX, Math.min(maxX, bounds.x));
    const span = Math.max(1, maxX - minX);
    const minDistance = Math.min(100, span);
    const maxDistance = Math.min(span, 460);
    let destination = currentX;
    if (maxDistance > 0) {
      const distance = minDistance + this.random() * Math.max(0, maxDistance - minDistance);
      const direction = this.random() < 0.5 ? -1 : 1;
      destination = Math.max(minX, Math.min(maxX, currentX + direction * distance));
      if (Math.abs(destination - currentX) < 2 && span > 2) {
        destination = currentX < (minX + maxX) / 2 ? maxX : minX;
      }
    }
    this.direction = destination < currentX ? -1 : 1;
    this.targetX = destination;
    this.setState(run ? STATES.RUNNING : STATES.WALKING);
  }

  tick() {
    if (!this.running || this.dragging) return;
    const win = this.getWindow();
    if (!win || win.isDestroyed() || !win.isVisible()) return;
    const now = this.now();
    const elapsed = Math.min(100, Math.max(0, now - this.lastTick));
    this.lastTick = now;
    if (this.state === STATES.WALKING || this.state === STATES.RUNNING) {
      this.move(win, elapsed);
      return;
    }
    if (now >= this.nextActivityAt && ![STATES.HAPPY, STATES.INTERACTING].includes(this.state)) {
      this.beginActivity();
    }
  }

  move(win, elapsed) {
    if (this.targetX === null) return;
    const bounds = win.getBounds();
    const area = this.getWorkArea(bounds);
    const maxX = Math.max(area.x, area.x + area.width - bounds.width);
    const target = Math.max(area.x, Math.min(maxX, this.targetX));
    const remaining = target - bounds.x;
    const speed = this.state === STATES.RUNNING ? 230 : 105;
    const step = Math.max(1, speed * elapsed / 1000);
    if (Math.abs(remaining) <= step) {
      win.setBounds({ ...bounds, x: target });
      this.targetX = null;
      this.setState(STATES.IDLE);
      this.scheduleActivity(this.activityDelay(3500, 10000));
    } else {
      this.direction = Math.sign(remaining);
      win.setBounds({ ...bounds, x: Math.round(bounds.x + this.direction * step) });
    }
  }

  interact() {
    if (!this.running || this.dragging) return;
    this.targetX = null;
    if (this.resumeTimer) this.clearTimeoutFn(this.resumeTimer);
    this.resumeTimer = null;
    if (this.stateTimer) this.clearTimeoutFn(this.stateTimer);
    if (this.interactionTimer) this.clearTimeoutFn(this.interactionTimer);
    this.setState(STATES.INTERACTING);
    this.interactionTimer = this.setTimeoutFn(() => {
      this.interactionTimer = null;
      if (!this.running || this.dragging) return;
      this.setState(STATES.HAPPY);
      this.scheduleTimedState(STATES.IDLE, 2400, 5000, 10000);
    }, 140);
  }

  startDrag() {
    this.dragging = true;
    this.targetX = null;
    if (this.resumeTimer) this.clearTimeoutFn(this.resumeTimer);
    this.resumeTimer = null;
    if (this.stateTimer) this.clearTimeoutFn(this.stateTimer);
    this.stateTimer = null;
    if (this.interactionTimer) this.clearTimeoutFn(this.interactionTimer);
    this.interactionTimer = null;
  }

  endDrag() {
    this.dragging = false;
    this.targetX = null;
    if (this.resumeTimer) this.clearTimeoutFn(this.resumeTimer);
    this.resumeTimer = this.setTimeoutFn(() => {
      this.resumeTimer = null;
      if (!this.running) return;
      this.setState(STATES.IDLE);
      this.scheduleActivity(this.activityDelay(5000, 11000));
    }, 2200);
  }
}

module.exports = { AutonomousController, STATES };
