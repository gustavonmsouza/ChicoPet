import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhrasePicker, PHRASES } from '../src/renderer/scripts/personality.js';

test('o sorteio nunca repete a frase anterior', () => {
  const pick = createPhrasePicker(['a', 'b', 'c']);
  let previous = pick();
  for (let i = 0; i < 200; i++) {
    const current = pick();
    assert.notEqual(current, previous);
    previous = current;
  }
});

test('todas as frases sorteadas pertencem à lista', () => {
  const pick = createPhrasePicker(PHRASES.click);
  for (let i = 0; i < 50; i++) assert.ok(PHRASES.click.includes(pick()));
});

test('lista com uma única frase não trava', () => {
  assert.equal(createPhrasePicker(['só uma'])(), 'só uma');
});
