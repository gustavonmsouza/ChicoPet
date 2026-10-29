import { SPRITES } from './sprites.js';

const animation = (id, frames, fps, loop, priority, interruptible) =>
  Object.freeze({ id, frames, fps, loop, priority, interruptible });

export const ANIMATIONS = Object.freeze({
  IDLE: animation('idle', [SPRITES.idle], 1, true, 1, true),
  WALKING: animation('walking', SPRITES.walkCycle, 5, true, 2, true),
  RUNNING: animation('running', SPRITES.runCycle, 8, true, 2, true),
  HAPPY: animation('happy', [SPRITES.happy], 1, true, 3, true),
  INTERACTING: animation('interacting', [SPRITES.happy], 1, true, 3, true),
  SLEEPING: animation('sleeping', [SPRITES.sleep], 1, true, 1, true),
  CURIOUS: animation('curious', [SPRITES.idle], 1, true, 1, true),
  SITTING: animation('sitting', [SPRITES.idle], 1, true, 1, true),
  DRAGGING: animation('dragging', [SPRITES.idle], 1, true, 5, true),
  FALLING: Object.freeze({
    byDirection: Object.freeze({
      right: Object.freeze([
        Object.freeze({ ...animation('falling-right-roll', [SPRITES.fallPawsUp, SPRITES.fallRolled], 5, false, 6, false), renderScale: 0.37 }),
        Object.freeze({ ...animation('falling-right-brace', [SPRITES.fallRolled, SPRITES.fallCrouched, SPRITES.fallLow], 5, false, 6, false), renderScale: 0.37 }),
      ]),
      left: Object.freeze([
        Object.freeze({ ...animation('falling-left-roll', [SPRITES.fallPawsUp, SPRITES.fallRolled], 5, false, 6, false), renderScale: 0.37 }),
        Object.freeze({ ...animation('falling-left-brace', [SPRITES.fallRolled, SPRITES.fallCrouched, SPRITES.fallLow], 5, false, 6, false), renderScale: 0.37 }),
      ]),
    }),
  }),
  LANDING: Object.freeze({ ...animation('landing', [SPRITES.fallFaceDown, SPRITES.fallProne], 3, false, 5, false), renderScale: 0.37 }),
  RECOVERING: Object.freeze({ ...animation('recovering', [SPRITES.landing, SPRITES.recovery, SPRITES.seated], 3, false, 4, true), renderScale: 0.37 }),
});

export function selectAnimation(state, direction = 1, random = Math.random) {
  const entry = ANIMATIONS[state];
  if (!entry) return null;
  const directional = entry.byDirection?.[direction < 0 ? 'left' : 'right'];
  if (directional) return directional[Math.min(directional.length - 1, Math.floor(random() * directional.length))];
  if (!entry.variants) return entry;
  const index = Math.min(entry.variants.length - 1, Math.floor(random() * entry.variants.length));
  return entry.variants[index];
}
