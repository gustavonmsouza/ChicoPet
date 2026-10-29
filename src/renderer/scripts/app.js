import { SPRITE_SCALE, BUBBLE_MS, HAPPY_MS, CLICK_MOVE_THRESHOLD } from './config.js';
import { SPRITES } from './sprites.js';
import { Character, STATES, STATE_SPRITE } from './character.js';
import { PHRASES, createPhrasePicker } from './personality.js';

const chicoEl = document.getElementById('chico');
const bubbleEl = document.getElementById('bubble');

const pickClickPhrase = createPhrasePicker(PHRASES.click);
const pickWakePhrase = createPhrasePicker(PHRASES.wake);

let bubbleTimer = null;
let happyTimer = null;

// ---------- Sprite ----------
function showSprite(name) {
  chicoEl.src = SPRITES[name];
}

// Quando a imagem carrega, ajustamos o tamanho na tela e a altura em que o balão aparece.
chicoEl.addEventListener('load', () => {
  chicoEl.style.width = `${Math.round(chicoEl.naturalWidth * SPRITE_SCALE)}px`;
  chicoEl.style.height = `${Math.round(chicoEl.naturalHeight * SPRITE_SCALE)}px`;
  document.documentElement.style.setProperty('--sprite-h', `${chicoEl.offsetHeight}px`);
});

// Pré-carrega todos os sprites para a troca de pose não piscar.
for (const src of Object.values(SPRITES)) new Image().src = src;

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
  onChange: (state) => showSprite(STATE_SPRITE[state]),
});

function onChicoClick() {
  clearTimeout(happyTimer);
  if (character.state === STATES.SLEEPING) {
    character.transitionTo(STATES.IDLE);
    say(pickWakePhrase());
    return;
  }
  character.forceState(STATES.IDLE); // garante um ponto de partida limpo (ex.: se estava andando)
  character.transitionTo(STATES.HAPPY);
  say(pickClickPhrase());
  happyTimer = setTimeout(() => character.transitionTo(STATES.IDLE), HAPPY_MS);
}

// ---------- Arrastar x clicar ----------
let press = null; // guarda onde o botão foi pressionado

chicoEl.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || event.ctrlKey) return; // só botão esquerdo (ctrl+clique abre o menu)
  chicoEl.setPointerCapture(event.pointerId);      // continuamos recebendo eventos mesmo fora da imagem
  press = { x: event.screenX, y: event.screenY, moved: false };
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
  press = null;
  chicoEl.classList.remove('dragging');
  window.chicoApi.dragEnd();
  if (wasClick) onChicoClick();
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
  clearTimeout(happyTimer);
  if (pose in POSE_TO_STATE) character.forceState(POSE_TO_STATE[pose]);
});

showSprite(STATE_SPRITE[character.state]);
