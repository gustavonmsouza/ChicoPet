// Single timer owner for sprite sequences. A one-frame pose is displayed statically.
export class AnimationPlayer {
  constructor({ onFrame = () => {}, setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout } = {}) {
    this.onFrame = onFrame;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.animation = null;
    this.frameIndex = 0;
    this.timer = null;
    this.paused = false;
  }

  play(animation) {
    if (!animation || !Array.isArray(animation.frames) || animation.frames.length === 0) return false;
    if (this.animation?.id === animation.id) return false;
    this.stop();
    this.animation = animation;
    this.frameIndex = 0;
    this.onFrame(animation.frames[0]);
    if (!this.paused && animation.frames.length > 1) this.schedule();
    return true;
  }

  schedule() {
    if (!this.animation || this.animation.frames.length < 2 || this.paused || this.timer !== null) return;
    const delay = 1000 / Math.max(1, this.animation.fps || 1);
    this.timer = this.setTimeoutFn.call(globalThis, () => {
      this.timer = null;
      this.advance();
    }, delay);
  }

  advance() {
    const animation = this.animation;
    if (!animation || this.paused) return;
    const next = this.frameIndex + 1;
    if (next >= animation.frames.length) {
      if (!animation.loop) {
        this.animation = null;
        return;
      }
      this.frameIndex = 0;
    } else {
      this.frameIndex = next;
    }
    this.onFrame(animation.frames[this.frameIndex]);
    this.schedule();
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
    if (this.paused) {
      if (this.timer !== null) this.clearTimeoutFn.call(globalThis, this.timer);
      this.timer = null;
    } else {
      this.schedule();
    }
  }

  stop() {
    if (this.timer !== null) this.clearTimeoutFn.call(globalThis, this.timer);
    this.timer = null;
    this.animation = null;
    this.frameIndex = 0;
  }
}
