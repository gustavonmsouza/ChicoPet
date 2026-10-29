import { SPRITE_SCALE, BUBBLE_MS, CLICK_MOVE_THRESHOLD } from './config.js';
import { SPRITES } from './sprites.js';
import { Character, STATES, STATE_SPRITE } from './character.js';
import { selectAnimation } from './animations.js';
import { AnimationPlayer } from './animationPlayer.js';
import { PHRASES, createPhrasePicker } from './personality.js';

const chicoEl = document.getElementById('chico');
const bubbleEl = document.getElementById('bubble');
let currentRenderScale = SPRITE_SCALE;
let currentDirection = 1;

const pickClickPhrase = createPhrasePicker(PHRASES.click);
const pickWakePhrase = createPhrasePicker(PHRASES.wake);

let bubbleTimer = null;

// ---------- Sprite ----------
const animationPlayer = new AnimationPlayer({ onFrame: (src) => { chicoEl.src = src; } });
function showSprite(name) { if (SPRITES[name]) chicoEl.src = SPRITES[name]; }
function playState(state) {
  const animation = selectAnimation(state, currentDirection);
  if (animation?.frames.length) {
    currentRenderScale = animation.renderScale || SPRITE_SCALE;
    animationPlayer.play(animation);
  }
  else {
    animationPlayer.stop();
    currentRenderScale = SPRITE_SCALE;
    showSprite(STATE_SPRITE[state] || 'idle');
  }
}

// Quando a imagem carrega, ajustamos o tamanho na tela e a altura em que o balão aparece.
chicoEl.addEventListener('load', () => {
  chicoEl.style.width = `${Math.round(chicoEl.naturalWidth * currentRenderScale)}px`;
  chicoEl.style.height = `${Math.round(chicoEl.naturalHeight * currentRenderScale)}px`;
  document.documentElement.style.setProperty('--sprite-h', `${chicoEl.offsetHeight}px`);
});

// Pré-carrega todos os sprites para a troca de pose não piscar.
for (const value of Object.values(SPRITES)) {
  const sources = Array.isArray(value)
    ? value.flat(Infinity)
    : value && typeof value === 'object'
      ? Object.values(value).flat(Infinity)
      : [value];
  for (const src of sources) {
    if (typeof src === 'string') new Image().src = src;
  }
}

// ---------- Balão de fala ----------
function say(text) {
  clearTimeout(bubbleTimer);
  bubbleEl.hidden = true;
  void bubbleEl.offsetWidth; // força o navegador a reiniciar a animação do balão
  bubbleEl.textContent = text;
  bubbleEl.hidden = false;
  bubbleTimer = setTimeout(() => { bubbleEl.hidden = true; }, BUBBLE_MS);
}

// ---------- Estado do personagem ----------
const character = new Character({
  onChange: playState,
});

function onChicoClick(previousState) {
  const wasSleeping = previousState === STATES.SLEEPING;
  window.chicoApi.interact();
  if (wasSleeping) {
    say(pickWakePhrase());
  } else {
    say(pickClickPhrase());
  }
}

// ---------- Arrastar x clicar ----------
let press = null; // guarda onde o botão foi pressionado

chicoEl.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.ctrlKey) return; // só botão esquerdo (ctrl+clique abre o menu)
  chicoEl.setPointerCapture(event.pointerId);      // continuamos recebendo eventos mesmo fora da imagem
  press = { x: event.screenX, y: event.screenY, moved: false, previousState: character.state };
  chicoEl.classList.add('dragging');
  window.chicoApi.dragStart();                        // o processo principal passa a mover a janela
});

chicoEl.addEventListener('pointermove', (event) => {
  if (!press) return;
  const distance = Math.hypot(event.screenX - press.x, event.screenY - press.y);
  if (distance > CLICK_MOVE_THRESHOLD) press.moved = true;
});

function finishPress(isClick) {
  if (!press) return;
  const wasClick = isClick && !press.moved;
  const previousState = press.previousState;
  press = null;
  chicoEl.classList.remove('dragging');
  window.chicoApi.dragEnd();
  if (wasClick) onChicoClick(previousState);
}
chicoEl.addEventListener('pointerup', () => finishPress(true));
chicoEl.addEventListener('pointercancel', () => finishPress(false));
chicoEl.addEventListener('lostpointercapture', () => finishPress(false));

// ---------- Janela "furada": só o Chico recebe cliques ----------
let interactive = false;
function setInteractive(next) {
  if (next === interactive) return;
  interactive = next;
  window.chicoApi.setInteractive(next);
}

document.addEventListener('mousemove', (event) => {
  if (press) return; // durante o arrasto, continua interativo
  const element = document.elementFromPoint(event.clientX, event.clientY);
  setInteractive(Boolean(element && element.closest('[data-hit]')));
});
document.documentElement.addEventListener('mouseleave', () => { if (!press) setInteractive(false); });

// ---------- Menu de contexto (botão direito) ----------
document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (event.target.closest('[data-hit]')) window.chicoApi.showMenu();
});

// ---------- Poses de teste vindas do menu ----------
const POSE_TO_STATE = { idle: STATES.IDLE, walk: STATES.WALKING, happy: STATES.HAPPY, sleep: STATES.SLEEPING };
window.chicoApi.onSetPose((pose) => {
  if (pose in POSE_TO_STATE) character.forceState(POSE_TO_STATE[pose]);
});

window.chicoApi.onAutonomousState(({ state, direction }) => {
  currentDirection = direction;
  chicoEl.classList.toggle('faces-left', currentDirection < 0);
  const next = STATES[state];
  if (next) character.forceState(next);
});

playState(character.state);
document.addEventListener('visibilitychange', () => animationPlayer.setPaused(document.hidden));
window.addEventListener('pagehide', () => {
  animationPlayer.stop();
  clearTimeout(bubbleTimer);
});
