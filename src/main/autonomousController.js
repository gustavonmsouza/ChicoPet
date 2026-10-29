'use strict';

const { ACTIVITY_MODES } = require('./preferences');

// One owner for autonomous behavior and window movement. Dependencies are injected for tests.
const STATES = Object.freeze({
  IDLE: 'IDLE', WALKING: 'WALKING', RUNNING: 'RUNNING', SLEEPING: 'SLEEPING',
  HAPPY: 'HAPPY', CURIOUS: 'CURIOUS', INTERACTING: 'INTERACTING', SITTING: 'SITTING',
  DRAGGING: 'DRAGGING', FALLING: 'FALLING', LANDING: 'LANDING', RECOVERING: 'RECOVERING',
});

class AutonomousController {
  constructor({ getWindow, getWorkArea, getGroundArea, onState = () => {}, random = Math.random,
    setIntervalFn = setInterval, clearIntervalFn = clearInterval, setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout, now = Date.now, tickMs = 40,
    groundMargin = 0, gravity = 1650, maxFallSpeed = 1250,
    groundSnapTolerance = 8, landingMs = 420, recoveryMs = 520,
    activityEnabled = true, activityMode = 'balanced' } = {}) {
    this.getWindow = getWindow;
    this.getWorkArea = getWorkArea;
    this.getGroundArea = getGroundArea || getWorkArea;
    this.onState = onState;
    this.random = random;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.now = now;
    this.tickMs = tickMs;
    this.groundMargin = groundMargin;
    this.gravity = gravity;
    this.maxFallSpeed = maxFallSpeed;
    this.groundSnapTolerance = groundSnapTolerance;
    this.landingMs = landingMs;
    this.recoveryMs = recoveryMs;
    if (typeof activityEnabled !== 'boolean') throw new TypeError('activityEnabled precisa ser booleano.');
    if (!Object.hasOwn(ACTIVITY_MODES, activityMode)) {
      throw new RangeError(`Modo de atividade inválido: ${activityMode}`);
    }
    this.activityEnabled = activityEnabled;
    this.activityMode = activityMode;
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
    this.fallVelocity = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTick = this.now();
    if (this.activityEnabled) {
      const mode = ACTIVITY_MODES[this.activityMode];
      this.scheduleActivity(this.activityDelay(mode.initialMin, mode.initialMax));
    } else {
      this.scheduleActivity(Number.POSITIVE_INFINITY);
    }
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

  setDirection(direction) {
    if (![-1, 1].includes(direction) || direction === this.direction) return;
    this.direction = direction;
    this.publish();
  }

  publish() { this.onState({ state: this.state, direction: this.direction }); }

  scheduleActivity(delay) { this.nextActivityAt = this.now() + delay; }

  activityDelay(min, max) { return min + this.random() * (max - min); }

  setActivityEnabled(enabled) {
    if (typeof enabled !== 'boolean') throw new TypeError('activityEnabled precisa ser booleano.');
    if (enabled === this.activityEnabled) return;
    this.activityEnabled = enabled;
    if (!enabled) {
      this.targetX = null;
      if (this.resumeTimer) this.clearTimeoutFn(this.resumeTimer);
      this.resumeTimer = null;
      if (this.stateTimer && [STATES.SLEEPING, STATES.CURIOUS, STATES.SITTING].includes(this.state)) {
        this.clearTimeoutFn(this.stateTimer);
        this.stateTimer = null;
      }
      if ([STATES.WALKING, STATES.RUNNING, STATES.SLEEPING, STATES.CURIOUS, STATES.SITTING].includes(this.state)) {
        this.setState(STATES.IDLE);
      }
      this.scheduleActivity(Number.POSITIVE_INFINITY);
      return;
    }
    const mode = ACTIVITY_MODES[this.activityMode];
    this.scheduleActivity(this.activityDelay(mode.initialMin, mode.initialMax));
  }

  setActivityMode(mode) {
    if (!Object.hasOwn(ACTIVITY_MODES, mode)) throw new RangeError(`Modo de atividade inválido: ${mode}`);
    if (mode === this.activityMode) return;
    this.activityMode = mode;
    if (this.activityEnabled) {
      const current = ACTIVITY_MODES[mode];
      this.scheduleActivity(this.activityDelay(current.initialMin, current.initialMax));
    }
  }

  beginActivity() {
    if (!this.activityEnabled) return;
    const roll = this.random();
    if (!this.isGrounded()) return;
    if (roll < 0.16) {
      this.targetX = null;
      this.setState(STATES.SLEEPING);
      this.scheduleTimedState(STATES.IDLE, this.activityDelay(18000, 36000), 5000, 11000);
    } else if (roll < 0.30) {
      this.targetX = null;
      this.setState(STATES.CURIOUS);
      this.scheduleTimedState(STATES.IDLE, this.activityDelay(1800, 4200), 1800, 5000);
    } else if (roll < 0.45) {
      this.targetX = null;
      this.setState(STATES.SITTING);
      this.scheduleTimedState(STATES.IDLE, this.activityDelay(4500, 10000), 3000, 8000);
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

  chooseDestination(run = false, force = false) {
    const win = this.getWindow();
    if (!win || win.isDestroyed() || (!this.activityEnabled && !force)) return;
    const bounds = win.getBounds();
    const area = this.getWorkArea(bounds);
    const floorY = this.floorY(bounds, this.getGroundArea(bounds));
    if (Math.abs(bounds.y - floorY) > this.groundSnapTolerance) return;
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
    if (this.state === STATES.FALLING) {
      this.advanceFall(win, elapsed);
      return;
    }
    if ([STATES.DRAGGING, STATES.LANDING, STATES.RECOVERING].includes(this.state)) return;
    if (!this.activityEnabled && [STATES.WALKING, STATES.RUNNING, STATES.SLEEPING, STATES.CURIOUS, STATES.SITTING].includes(this.state)) {
      this.targetX = null;
      this.setState(STATES.IDLE);
      return;
    }
    const bounds = win.getBounds();
    const floorY = this.floorY(bounds, this.getGroundArea(bounds));
    if (bounds.y < floorY - this.groundSnapTolerance) {
      this.startFall();
      return;
    }
    if (bounds.y !== floorY) win.setBounds({ ...bounds, y: floorY });
    if (this.state === STATES.WALKING || this.state === STATES.RUNNING) {
      this.move(win, elapsed);
      return;
    }
    if (this.activityEnabled && now >= this.nextActivityAt && ![STATES.HAPPY, STATES.INTERACTING].includes(this.state)) {
      this.beginActivity();
    }
  }

  move(win, elapsed) {
    if (this.targetX === null) return;
    const bounds = win.getBounds();
    const area = this.getWorkArea(bounds);
    const floorY = this.floorY(bounds, this.getGroundArea(bounds));
    const maxX = Math.max(area.x, area.x + area.width - bounds.width);
    const target = Math.max(area.x, Math.min(maxX, this.targetX));
    const remaining = target - bounds.x;
    const mode = ACTIVITY_MODES[this.activityMode];
    const speed = this.state === STATES.RUNNING ? mode.runSpeed : mode.walkSpeed;
    const step = Math.max(1, speed * elapsed / 1000);
    if (Math.abs(remaining) <= step) {
      win.setBounds({ ...bounds, x: target, y: floorY });
      this.targetX = null;
      this.setState(STATES.IDLE);
      const mode = ACTIVITY_MODES[this.activityMode];
      this.scheduleActivity(this.activityDelay(mode.pauseMin, mode.pauseMax));
    } else {
      this.direction = Math.sign(remaining);
      win.setBounds({ ...bounds, x: Math.round(bounds.x + this.direction * step), y: floorY });
    }
  }

  interact() {
    if (!this.running || this.dragging || [STATES.FALLING, STATES.LANDING, STATES.RECOVERING].includes(this.state)) return;
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

  play() {
    if (
      !this.running
      || this.dragging
      || [STATES.FALLING, STATES.LANDING, STATES.RECOVERING].includes(this.state)
      || !this.isGrounded()
    ) return;
    if (this.resumeTimer) this.clearTimeoutFn(this.resumeTimer);
    if (this.stateTimer) this.clearTimeoutFn(this.stateTimer);
    if (this.interactionTimer) this.clearTimeoutFn(this.interactionTimer);
    this.resumeTimer = this.stateTimer = this.interactionTimer = null;
    this.targetX = null;
    this.chooseDestination(true, true);
  }

  startDrag() {
    this.dragging = true;
    this.fallVelocity = 0;
    this.targetX = null;
    if (this.resumeTimer) this.clearTimeoutFn(this.resumeTimer);
    this.resumeTimer = null;
    if (this.stateTimer) this.clearTimeoutFn(this.stateTimer);
    this.stateTimer = null;
    if (this.interactionTimer) this.clearTimeoutFn(this.interactionTimer);
    this.interactionTimer = null;
    this.setState(STATES.DRAGGING);
  }

  endDrag() {
    this.dragging = false;
    this.targetX = null;
    const win = this.getWindow();
    if (!win || win.isDestroyed()) return;
    const bounds = win.getBounds();
    const floorY = this.floorY(bounds, this.getGroundArea(bounds));
    if (floorY - bounds.y > this.groundSnapTolerance) {
      this.startFall();
      return;
    }
    win.setBounds({ ...bounds, y: floorY });
    this.setState(STATES.IDLE);
    if (!this.activityEnabled) return;
    this.scheduleActivity(2200);
    if (this.resumeTimer) this.clearTimeoutFn(this.resumeTimer);
    this.resumeTimer = this.setTimeoutFn(() => {
      this.resumeTimer = null;
      if (!this.running) return;
      this.setState(STATES.IDLE);
      this.scheduleActivity(this.activityDelay(5000, 11000));
    }, 2200);
  }

  floorY(bounds, area = this.getGroundArea(bounds)) {
    return Math.max(area.y, area.y + area.height - bounds.height - this.groundMargin);
  }

  isGrounded() {
    const win = this.getWindow();
    if (!win || win.isDestroyed()) return false;
    const bounds = win.getBounds();
    return Math.abs(bounds.y - this.floorY(bounds)) <= this.groundSnapTolerance;
  }

  startFall() {
    const win = this.getWindow();
    if (!this.running || this.dragging || !win || win.isDestroyed()) return;
    if ([STATES.FALLING, STATES.LANDING, STATES.RECOVERING].includes(this.state)) return;
    if (this.stateTimer) this.clearTimeoutFn(this.stateTimer);
    if (this.interactionTimer) this.clearTimeoutFn(this.interactionTimer);
    this.stateTimer = this.interactionTimer = null;
    this.targetX = null;
    this.fallVelocity = 0;
    this.lastTick = this.now();
    this.setState(STATES.FALLING);
  }

  advanceFall(win, elapsedMs) {
    const bounds = win.getBounds();
    const floorY = this.floorY(bounds, this.getGroundArea(bounds));
    const dt = Math.min(0.1, Math.max(0, elapsedMs / 1000));
    this.fallVelocity = Math.min(this.maxFallSpeed, this.fallVelocity + this.gravity * dt);
    const nextY = bounds.y + this.fallVelocity * dt;
    if (nextY >= floorY) {
      win.setBounds({ ...bounds, y: floorY });
      this.fallVelocity = 0;
      this.setState(STATES.LANDING);
      // Landing and recovery are a single guarded sequence; dragging cancels its timer.
      if (this.stateTimer) this.clearTimeoutFn(this.stateTimer);
      this.scheduleActivity(this.landingMs + this.recoveryMs);
      this.stateTimer = this.setTimeoutFn(() => {
        this.stateTimer = null;
        if (!this.running || this.dragging || this.state !== STATES.LANDING) return;
        this.setState(STATES.RECOVERING);
        this.stateTimer = this.setTimeoutFn(() => {
          this.stateTimer = null;
          if (!this.running || this.dragging || this.state !== STATES.RECOVERING) return;
          this.setState(STATES.IDLE);
          this.scheduleActivity(this.activityDelay(3500, 9000));
        }, this.recoveryMs);
      }, this.landingMs);
    } else {
      win.setBounds({ ...bounds, y: Math.round(nextY) });
    }
  }
}

module.exports = { AutonomousController, STATES };
