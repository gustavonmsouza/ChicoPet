'use strict';

const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { APP_ROOT, assetPath, sourcePath } = require('../src/main/appPaths');

test('application paths resolve from the project root', () => {
  assert.equal(APP_ROOT, path.resolve(__dirname, '..'));
  assert.equal(assetPath('icons', 'tray.png'), path.join(APP_ROOT, 'assets', 'icons', 'tray.png'));
  assert.equal(sourcePath('renderer', 'index.html'), path.join(APP_ROOT, 'src', 'renderer', 'index.html'));
  assert.equal(existsSync(assetPath('icons', 'tray.png')), true);
  assert.equal(existsSync(assetPath('sprites', 'source', 'reference.png')), true);
  assert.equal(existsSync(sourcePath('preload', 'preload.js')), true);
});
