'use strict';

const path = require('node:path');

const APP_ROOT = path.resolve(__dirname, '..', '..');

function assetPath(...segments) {
  return path.join(APP_ROOT, 'assets', ...segments);
}

function sourcePath(...segments) {
  return path.join(APP_ROOT, 'src', ...segments);
}

module.exports = { APP_ROOT, assetPath, sourcePath };
