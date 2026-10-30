import {
  SPRITE_SCALE, SPRITE_FRAME_WIDTH, SPRITE_FRAME_HEIGHT, BUBBLE_MS, CLICK_MOVE_THRESHOLD,
} from './config.js';
import { SPRITE_SHEET, SPRITE_SHEET_COLUMNS, SPRITE_SHEET_ROWS, SPRITES } from './sprites.js';
import { Character, STATES, STATE_SPRITE } from './character.js';
import { selectAnimation } from './animations.js';
import { AnimationPlayer } from './animationPlayer.js';
import { PHRASES, createPhrasePicker } from './personality.js';
import { bindPointerInteractions } from './pointerInteractions.js';
import { createSpeechBubble } from './speechBubble.js';

const chicoEl = document.getElementById('chico');
const bubbleEl = document.getElementById('bubble');
let currentDirection = 1;
let currentMovementSpeed = null;
let manualWalkStep = false;

const BASE_MOVEMENT_SPEED = Object.freeze({ WALKING: 105, RUNNING: 230 });

const pickClickPhrase = createPhrasePicker(PHRASES.click);
const pickWakePhrase = createPhrasePicker(PHRASES.wake);
const speechBubble = createSpeechBubble({ element: bubbleEl, duration: BUBBLE_MS });

// ---------- Sprite ----------
function showFrame({ column, row }) {
  chicoEl.style.backgroundPositionX = `${-column * SPRITE_FRAME_WIDTH * SPRITE_SCALE}px`;
  chicoEl.style.backgroundPositionY = `${-row * SPRITE_FRAME_HEIGHT * SPRITE_SCALE}px`;
}

const animationPlayer = new AnimationPlayer({ onFrame: showFrame });
function showSprite(name) {
  const sprite = SPRITES[name];
  if (Array.isArray(sprite)) showFrame(sprite[0]);
  else if (sprite) showFrame(sprite);
}
function playState(state) {
  manualWalkStep = false;
  const animation = selectAnimation(state, currentDirection);
  if (animation?.frames.length) {
    animationPlayer.setPaused(document.hidden);
    animationPlayer.play({ ...animation, fps: playbackFps(state, animation.fps) });
  }
  else {
    animationPlayer.stop();
    showSprite(STATE_SPRITE[state] || 'idle');
  }
}

function playbackFps(state, baseFps) {
  const baseSpeed = BASE_MOVEMENT_SPEED[state];
  if (!baseSpeed || !currentMovementSpeed) return baseFps;
  return baseFps * currentMovementSpeed / baseSpeed;
}

const spriteWidth = SPRITE_FRAME_WIDTH * SPRITE_SCALE;
const spriteHeight = SPRITE_FRAME_HEIGHT * SPRITE_SCALE;
chicoEl.style.width = `${spriteWidth}px`;
chicoEl.style.height = `${spriteHeight}px`;
chicoEl.style.backgroundImage = `url("${SPRITE_SHEET}")`;
chicoEl.style.backgroundSize = `${SPRITE_SHEET_COLUMNS * SPRITE_FRAME_WIDTH * SPRITE_SCALE}px `
  + `${SPRITE_SHEET_ROWS * SPRITE_FRAME_HEIGHT * SPRITE_SCALE}px`;
document.documentElement.style.setProperty('--sprite-h', `${spriteHeight}px`);

// ---------- Estado do personagem ----------
const character = new Character({
  onChange: playState,
});

function onChicoClick(previousState) {
  const wasSleeping = previousState === STATES.SLEEPING;
  window.chicoApi.interact();
  if (wasSleeping) {
    speechBubble.say(pickWakePhrase());
  } else {
    speechBubble.say(pickClickPhrase());
  }
}

const disposePointerInteractions = bindPointerInteractions({
  element: chicoEl,
  character,
  api: window.chicoApi,
  clickMoveThreshold: CLICK_MOVE_THRESHOLD,
  onClick: onChicoClick,
});

// ---------- Poses de teste vindas do menu ----------
const POSE_TO_STATE = {
  idle: STATES.IDLE, walk: STATES.WALKING, sit: STATES.SITTING, happy: STATES.HAPPY, sleep: STATES.SLEEPING,
};
window.chicoApi.onSetPose((pose) => {
  if (pose === 'walk-step') {
    if (character.state !== STATES.WALKING) character.forceState(STATES.WALKING);
    manualWalkStep = true;
    animationPlayer.setPaused(true);
    animationPlayer.step();
    return;
  }
  if (pose === 'walk') {
    manualWalkStep = false;
    if (character.state === STATES.WALKING) {
      animationPlayer.setPaused(document.hidden);
      return;
    }
  }
  if (pose in POSE_TO_STATE) character.forceState(POSE_TO_STATE[pose]);
});

window.chicoApi.onAutonomousState(({ state, direction, movementSpeed }) => {
  const directionChanged = direction !== currentDirection;
  currentDirection = direction;
  currentMovementSpeed = movementSpeed;
  const next = STATES[state];
  if (!next) return;
  // A direção pode mudar sem transição de estado (por exemplo, ao inverter
  // uma caminhada). Reaplica a sequência correta de arquivos left/right.
  if (next === character.state) {
    if (directionChanged) {
      const stepping = manualWalkStep;
      playState(next);
      if (stepping && next === STATES.WALKING) {
        manualWalkStep = true;
        animationPlayer.setPaused(true);
      }
    } else {
      const animation = selectAnimation(next, currentDirection);
      if (animation?.frames.length) animationPlayer.setFps(playbackFps(next, animation.fps));
    }
    return;
  }
  character.forceState(next);
});

playState(character.state);
document.documentElement.dataset.rendererReady = 'true';
document.addEventListener('visibilitychange', () => {
  animationPlayer.setPaused(document.hidden || manualWalkStep);
});
window.addEventListener('pagehide', () => {
  animationPlayer.stop();
  speechBubble.clear();
  disposePointerInteractions();
});
