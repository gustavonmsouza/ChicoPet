import { SPRITES } from './sprites.js';

const animation = (id, frames, fps, loop, priority, interruptible) =>
  Object.freeze({ id, frames, fps, loop, priority, interruptible });

const directionalAnimation = (id, framesByDirection, fps, loop, priority, interruptible) => Object.freeze({
  byDirection: Object.freeze({
    left: animation(`${id}-left`, framesByDirection.left, fps, loop, priority, interruptible),
    right: animation(`${id}-right`, framesByDirection.right, fps, loop, priority, interruptible),
  }),
});

export const ANIMATIONS = Object.freeze({
  IDLE: animation('idle', [SPRITES.idle], 1, true, 1, true),
  WALKING: directionalAnimation('walking', SPRITES.walking, 6, true, 2, true),
  RUNNING: directionalAnimation('running', SPRITES.running, 9, true, 2, true),
  HAPPY: animation('happy', [SPRITES.happy], 1, true, 3, true),
  INTERACTING: animation('interacting', [SPRITES.happy], 1, true, 3, true),
  SLEEPING: animation('sleeping', [SPRITES.sleeping], 1, true, 1, true),
  CURIOUS: animation('curious', [SPRITES.curious], 1, true, 1, true),
  SITTING: animation('sitting', [SPRITES.sitting], 1, true, 1, true),
  DRAGGING: animation('dragging', [SPRITES.dragging], 1, true, 5, true),
  FALLING: directionalAnimation('falling', SPRITES.falling, 7, true, 6, false),
  LANDING: directionalAnimation('landing', SPRITES.landing, 1, false, 5, false),
  RECOVERING: directionalAnimation('recovering', SPRITES.recovering, 3, false, 4, true),
});

export function selectAnimation(state, direction = 1) {
  const entry = ANIMATIONS[state];
  if (!entry) return null;
  return entry.byDirection?.[direction < 0 ? 'left' : 'right'] || entry;
}
