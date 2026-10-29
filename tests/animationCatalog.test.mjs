import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { ANIMATIONS, selectAnimation } from '../src/renderer/scripts/animations.js';

function allAnimations() {
  return Object.values(ANIMATIONS).flatMap((entry) => {
    if (entry.byDirection) return Object.values(entry.byDirection).flat();
    return entry.variants || [entry];
  });
}

test('every registered animation frame resolves to an existing image', () => {
  for (const animation of allAnimations()) {
    for (const frame of animation.frames) {
      assert.equal(existsSync(fileURLToPath(frame)), true, `${animation.id}: ${frame}`);
    }
  }
});

test('fall animation selects a directional sequence', () => {
  assert.equal(selectAnimation('FALLING', 1, () => 0).id, 'falling-right-roll');
  assert.equal(selectAnimation('FALLING', 1, () => 0.99).id, 'falling-right-brace');
  assert.equal(selectAnimation('FALLING', -1, () => 0).id, 'falling-left-roll');
  assert.equal(selectAnimation('FALLING', -1, () => 0.99).id, 'falling-left-brace');
});

test('walking and running use multiple extracted poses', () => {
  assert.ok(ANIMATIONS.WALKING.frames.length >= 4);
  assert.ok(ANIMATIONS.RUNNING.frames.length >= 4);
});

test('new pose PNGs have transparent RGBA corners', () => {
  for (const animation of allAnimations().filter((entry) => /falling|landing|recovering/.test(entry.id))) {
    for (const frameUrl of animation.frames) {
      const bytes = readFileSync(fileURLToPath(frameUrl));
      assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
      assert.equal(bytes[25], 6, `${animation.id} must be RGBA`);
      let offset = 8;
      const compressed = [];
      while (offset < bytes.length) {
        const size = bytes.readUInt32BE(offset);
        const type = bytes.toString('ascii', offset + 4, offset + 8);
        if (type === 'IDAT') compressed.push(bytes.subarray(offset + 8, offset + 8 + size));
        offset += size + 12;
        if (type === 'IEND') break;
      }
      const firstRow = inflateSync(Buffer.concat(compressed));
      assert.equal(firstRow[4], 0, `${animation.id} top-left pixel should be transparent`);
    }
  }
});
