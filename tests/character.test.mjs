import test from 'node:test';
import assert from 'node:assert/strict';
import { Character, STATES } from '../src/renderer/scripts/character.js';

test('começa em IDLE', () => {
  assert.equal(new Character().state, STATES.IDLE);
});

test('IDLE pode ir para HAPPY e HAPPY volta para IDLE', () => {
  const chico = new Character();
  assert.equal(chico.transitionTo(STATES.HAPPY), true);
  assert.equal(chico.transitionTo(STATES.IDLE), true);
});

test('dormindo não pula direto para HAPPY', () => {
  const chico = new Character();
  chico.transitionTo(STATES.SLEEPING);
  assert.equal(chico.transitionTo(STATES.HAPPY), false);
  assert.equal(chico.state, STATES.SLEEPING);
});

test('onChange só dispara quando o estado muda de verdade', () => {
  const calls = [];
  const chico = new Character({ onChange: (s) => calls.push(s) });
  chico.transitionTo(STATES.IDLE); // já está em IDLE
  chico.transitionTo(STATES.HAPPY);
  assert.deepEqual(calls, [STATES.HAPPY]);
});
