import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
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

test('movement and fall animations select real left/right frame files', () => {
  for (const state of ['WALKING', 'RUNNING', 'FALLING', 'LANDING', 'RECOVERING']) {
    const right = selectAnimation(state, 1);
    const left = selectAnimation(state, -1);
    assert.match(right.id, /-right$/);
    assert.match(left.id, /-left$/);
    assert.notEqual(right.frames[0], left.frames[0], `${state} must use distinct direction files`);
  }
});

test('walking and running use several aligned poses', () => {
  assert.equal(selectAnimation('WALKING', 1).frames.length, 8);
  assert.equal(selectAnimation('RUNNING', 1).frames.length, 5);
});

test('walking uses all eight original poses for each direction', () => {
  const manifestPath = join(process.cwd(), 'assets', 'sprites', 'normalized', 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const leftFrames = manifest.frames.filter(({ name }) => name.startsWith('caminhada-esquerda-'));
  const rightFrames = manifest.frames.filter(({ name }) => name.startsWith('caminhada-direita-'));
  assert.deepEqual(leftFrames.map(({ pose }) => pose), [9, 10, 11, 12, 13, 14, 15, 16]);
  assert.deepEqual(rightFrames.map(({ pose }) => pose), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok([...leftFrames, ...rightFrames].every(({ source }) => source === 'chico_andando'));
  assert.ok([...leftFrames, ...rightFrames].every(({ source }) => source !== 'chico2'));
});

test('walking frames visibly alternate front and hind paws', () => {
  const frames = selectAnimation('WALKING', 1).frames;
  const changedPawPixels = (firstUrl, secondUrl, left, right) => {
    const first = pngInfo(firstUrl);
    const second = pngInfo(secondUrl);
    let changed = 0;
    for (let y = 385; y < 505; y += 1) {
      const firstRow = y * (first.width * 4 + 1) + 1;
      const secondRow = y * (second.width * 4 + 1) + 1;
      for (let x = left; x < right; x += 1) {
        const firstAlpha = first.scanlines[firstRow + x * 4 + 3];
        const secondAlpha = second.scanlines[secondRow + x * 4 + 3];
        if (firstAlpha !== secondAlpha) changed += 1;
      }
    }
    return changed;
  };

  for (let index = 0; index < frames.length; index += 1) {
    const next = (index + 1) % frames.length;
    assert.ok(changedPawPixels(frames[index], frames[next], 55, 295) > 100,
      `${frames[index]} -> ${frames[next]} should move the hind paws`);
    assert.ok(changedPawPixels(frames[index], frames[next], 295, 590) > 100,
      `${frames[index]} -> ${frames[next]} should move the front paws`);
  }
});

function pngInfo(frameUrl) {
  const bytes = readFileSync(fileURLToPath(frameUrl));
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  assert.equal(bytes[25], 6, `${frameUrl} must be RGBA`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  let offset = 8;
  const compressed = [];
  while (offset < bytes.length) {
    const size = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') compressed.push(bytes.subarray(offset + 8, offset + 8 + size));
    offset += size + 12;
    if (type === 'IEND') break;
  }
  return { width, height, scanlines: inflateSync(Buffer.concat(compressed)) };
}

test('runtime frames have the common canvas and a transparent edge', () => {
  for (const animation of allAnimations().filter((entry) => /falling|landing|recovering/.test(entry.id))) {
    for (const frameUrl of animation.frames) {
      const { width, height, scanlines } = pngInfo(frameUrl);
      assert.equal(width, 640, `${animation.id} width`);
      assert.equal(height, 512, `${animation.id} height`);
      assert.equal(scanlines[4], 0, `${animation.id} top-left pixel should be transparent`);
    }
  }
});

test('runtime frames use the shared palette and contain no pale background matte', () => {
  const manifestPath = join(process.cwd(), 'assets', 'sprites', 'normalized', 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const palette = new Set(manifest.palette.map((color) => color.join(',')));
  const frames = new Set(allAnimations().flatMap((animation) => animation.frames));
  for (const frameUrl of frames) {
    const { width, height, scanlines } = pngInfo(frameUrl);
    const stride = width * 4;
    for (let y = 0; y < height; y += 1) {
      const row = y * (stride + 1);
      assert.equal(scanlines[row], 0, 'normalized frames use predictable unfiltered rows');
      for (let x = 0; x < width; x += 1) {
        const pixel = row + 1 + x * 4;
        const [r, g, b, alpha] = scanlines.subarray(pixel, pixel + 4);
        if (!alpha) continue;
        assert.equal(palette.has(`${r},${g},${b}`), true, 'visible color must come from the shared palette');
        assert.equal(minimum(r, g, b) > 165 && maximum(r, g, b) - minimum(r, g, b) <= 52, false,
          'opaque pale neutral pixels indicate remaining source background');
      }
    }
  }
});

const minimum = (...values) => Math.min(...values);
const maximum = (...values) => Math.max(...values);
