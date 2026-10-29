'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  DEFAULT_PREFERENCES, loadPreferences, savePreferences, validatePreferences,
} = require('../src/main/preferences');

test('preferences default only when the file does not exist and persist updates', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chico-preferences-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'nested', 'preferences.json');

  assert.deepEqual(loadPreferences(file), DEFAULT_PREFERENCES);
  const updated = { ...DEFAULT_PREFERENCES, autonomousMovement: false, activityMode: 'playful' };
  assert.deepEqual(savePreferences(file, updated), updated);
  assert.deepEqual(loadPreferences(file), updated);
  assert.equal(fs.existsSync(`${file}.tmp`), false);
});

test('invalid or unreadable preferences are reported instead of silently reset', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chico-preferences-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'preferences.json');

  fs.writeFileSync(file, '{invalid');
  assert.throws(() => loadPreferences(file), /JSON inválido/);
  assert.throws(
    () => validatePreferences({ ...DEFAULT_PREFERENCES, activityMode: 'turbo' }),
    /Modo de atividade inválido/,
  );
  assert.throws(
    () => validatePreferences({ ...DEFAULT_PREFERENCES, activityMode: 'toString' }),
    /Modo de atividade inválido/,
  );
  assert.throws(
    () => validatePreferences({ ...DEFAULT_PREFERENCES, startAtLogin: 'yes' }),
    /startAtLogin precisa ser booleano/,
  );
});
