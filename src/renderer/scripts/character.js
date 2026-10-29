// Máquina de estados do Chico: só decide QUAL estado vale agora. Não sabe nada de tela, sprites ou timers.
export const STATES = Object.freeze({
  IDLE: 'IDLE',
  WALKING: 'WALKING',
  RUNNING: 'RUNNING',
  HAPPY: 'HAPPY',
  SLEEPING: 'SLEEPING',
  CURIOUS: 'CURIOUS',
  INTERACTING: 'INTERACTING',
});

// Para cada estado, para quais outros ele pode ir.
const TRANSITIONS = Object.freeze({
  IDLE: ['WALKING', 'RUNNING', 'HAPPY', 'SLEEPING', 'CURIOUS', 'INTERACTING'],
  WALKING: ['IDLE', 'RUNNING', 'HAPPY', 'CURIOUS', 'INTERACTING'],
  RUNNING: ['IDLE', 'WALKING', 'HAPPY', 'INTERACTING'],
  HAPPY: ['IDLE', 'INTERACTING'],
  SLEEPING: ['IDLE', 'HAPPY', 'INTERACTING'],
  CURIOUS: ['IDLE', 'WALKING', 'INTERACTING'],
  INTERACTING: ['IDLE', 'HAPPY'],
});

export const STATE_SPRITE = Object.freeze({
  IDLE: 'idle',
  WALKING: 'walk',
  RUNNING: 'walk',
  HAPPY: 'happy',
  SLEEPING: 'sleep',
  CURIOUS: 'idle',
  INTERACTING: 'happy',
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
