'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { build } = require('../package.json');

test('packaged app includes runtime assets without source or generated frames', () => {
  assert.deepEqual(build.files, [
    'src/**/*',
    'assets/icons/chico.icns',
    'assets/icons/tray.png',
    'assets/sprites/chico-spritesheet.png',
    'package.json',
  ]);
});
