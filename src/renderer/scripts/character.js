// Máquina de estados do Chico: só decide QUAL estado vale agora. Não sabe nada de tela, sprites ou timers.
export const STATES = Object.freeze({
  IDLE: 'IDLE',
  WALKING: 'WALKING',
  RUNNING: 'RUNNING',
  HAPPY: 'HAPPY',
  SLEEPING: 'SLEEPING',
  CURIOUS: 'CURIOUS',
  INTERACTING: 'INTERACTING',
  SITTING: 'SITTING',
  DRAGGING: 'DRAGGING',
  FALLING: 'FALLING',
  LANDING: 'LANDING',
  RECOVERING: 'RECOVERING',
});

// Para cada estado, para quais outros ele pode ir.
const TRANSITIONS = Object.freeze({
  IDLE: ['WALKING', 'RUNNING', 'HAPPY', 'SLEEPING', 'CURIOUS', 'INTERACTING', 'SITTING', 'DRAGGING'],
  WALKING: ['IDLE', 'RUNNING', 'HAPPY', 'CURIOUS', 'INTERACTING', 'DRAGGING'],
  RUNNING: ['IDLE', 'WALKING', 'HAPPY', 'INTERACTING', 'DRAGGING'],
  HAPPY: ['IDLE', 'INTERACTING', 'DRAGGING'],
  SLEEPING: ['IDLE', 'HAPPY', 'INTERACTING', 'DRAGGING'],
  CURIOUS: ['IDLE', 'WALKING', 'INTERACTING', 'DRAGGING'],
  INTERACTING: ['IDLE', 'HAPPY', 'DRAGGING'],
  SITTING: ['IDLE', 'WALKING', 'DRAGGING'],
  DRAGGING: ['IDLE', 'FALLING'],
  FALLING: ['LANDING', 'DRAGGING'],
  LANDING: ['RECOVERING', 'DRAGGING'],
  RECOVERING: ['IDLE', 'DRAGGING'],
});

export const STATE_SPRITE = Object.freeze({
  IDLE: 'idle',
  WALKING: 'idle',
  RUNNING: 'idle',
  HAPPY: 'happy',
  SLEEPING: 'sleeping',
  CURIOUS: 'curious',
  INTERACTING: 'happy',
  SITTING: 'sitting',
  DRAGGING: 'dragging',
  FALLING: 'idle',
  LANDING: 'idle',
  RECOVERING: 'idle',
});

export class Character {
  #state = STATES.IDLE;
  #onChange;

  constructor({ onChange = () => {} } = {}) {
    this.#onChange = onChange;
  }

  get state() {
    return this.#state;
  }

  /** Muda de estado se a transição for permitida. Devolve true se mudou. */
  transitionTo(next) {
    if (next === this.#state) return false;
    if (!TRANSITIONS[this.#state]?.includes(next)) return false;
    this.#state = next;
    this.#onChange(next);
    return true;
  }

  /** Ignora as regras (só para o menu de testes de poses). */
  forceState(next) {
    if (!(next in STATES) || next === this.#state) return;
    this.#state = next;
    this.#onChange(next);
  }
}
