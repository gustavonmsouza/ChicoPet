import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
import { ANIMATIONS, selectAnimation } from '../src/renderer/scripts/animations.js';
import { SPRITE_SHEET_COLUMNS, SPRITE_SHEET_ROWS } from '../src/renderer/scripts/sprites.js';

const SPRITE_FRAME_WIDTH = 640;
const SPRITE_FRAME_HEIGHT = 512;
const SPRITE_SHEET_PATH = join(process.cwd(), 'assets', 'sprites', 'chico-spritesheet.png');
const spriteSheet = readPng(SPRITE_SHEET_PATH);

function allAnimations() {
  return Object.values(ANIMATIONS).flatMap((entry) => {
    if (entry.byDirection) return Object.values(entry.byDirection).flat();
    return entry.variants || [entry];
  });
}

test('every animation frame maps inside the generated sprite atlas', () => {
  assert.equal(existsSync(SPRITE_SHEET_PATH), true);
  assert.equal(spriteSheet.width, SPRITE_FRAME_WIDTH * SPRITE_SHEET_COLUMNS);
  assert.equal(spriteSheet.height, SPRITE_FRAME_HEIGHT * SPRITE_SHEET_ROWS);
  for (const animation of allAnimations()) {
    for (const frame of animation.frames) {
      assert.ok(Number.isInteger(frame.column) && frame.column >= 0 && frame.column < SPRITE_SHEET_COLUMNS);
      assert.ok(Number.isInteger(frame.row) && frame.row >= 0 && frame.row < SPRITE_SHEET_ROWS);
    }
  }
});

test('movement and fall animations select distinct left/right atlas rows', () => {
  for (const state of ['WALKING', 'RUNNING', 'FALLING', 'LANDING', 'RECOVERING']) {
    const right = selectAnimation(state, 1);
    const left = selectAnimation(state, -1);
    assert.match(right.id, /-right$/);
    assert.match(left.id, /-left$/);
    assert.notEqual(right.frames[0].row, left.frames[0].row, `${state} must use distinct direction rows`);
  }
});

test('walking and running use several aligned poses', () => {
  assert.equal(selectAnimation('WALKING', 1).frames.length, 8);
  assert.equal(selectAnimation('RUNNING', 1).frames.length, 8);
  assert.equal(selectAnimation('IDLE').frames.length, 6);
  assert.equal(selectAnimation('SITTING').frames.length, 4);
  assert.equal(selectAnimation('SLEEPING').frames.length, 3);
});

test('walking and running use all eight poses from the new reference sheet', () => {
  const manifestPath = join(process.cwd(), 'assets', 'sprites', 'normalized', 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  for (const [name, firstPose] of [['caminhada', 1], ['corrida', 9]]) {
    for (const direction of ['esquerda', 'direita']) {
      const frames = manifest.frames.filter(({ name: frameName }) => frameName.startsWith(`${name}-${direction}-`));
      assert.equal(frames.length, 8);
      assert.deepEqual(frames.map(({ pose }) => pose), Array.from({ length: 8 }, (_, index) => firstPose + index));
      assert.ok(frames.every(({ source }) => source === 'reference'));
    }
  }
});

test('new walking and running sprites contain no opaque green spill', () => {
  for (const state of ['WALKING', 'RUNNING']) {
    for (const direction of [-1, 1]) {
      for (const frame of selectAnimation(state, direction).frames) {
        const { scanlines } = pngInfo(frame);
        const stride = SPRITE_FRAME_WIDTH * 4;
        for (let y = 0; y < SPRITE_FRAME_HEIGHT; y += 1) {
          const row = y * (stride + 1) + 1;
          for (let x = 0; x < SPRITE_FRAME_WIDTH; x += 1) {
            const [r, g, b, alpha] = scanlines.subarray(row + x * 4, row + x * 4 + 4);
            if (!alpha) continue;
            assert.ok(g <= Math.max(r, b) + 8,
              `${state} ${JSON.stringify(frame)} has green spill at (${x}, ${y})`);
            if (r < 190 && b < r * 0.45) {
              assert.ok(g <= r * 0.65 + 8,
                `${state} ${JSON.stringify(frame)} has an olive tint at (${x}, ${y})`);
            }
          }
        }
      }
    }
  }
});

test('walking frames visibly alternate front and hind paws', () => {
  const frames = selectAnimation('WALKING', 1).frames;
  const changedPawPixels = (firstFrame, secondFrame, left, right) => {
    const first = pngInfo(firstFrame);
    const second = pngInfo(secondFrame);
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
      `${JSON.stringify(frames[index])} -> ${JSON.stringify(frames[next])} should move the hind paws`);
    assert.ok(changedPawPixels(frames[index], frames[next], 295, 590) > 100,
      `${JSON.stringify(frames[index])} -> ${JSON.stringify(frames[next])} should move the front paws`);
  }
});

function readPng(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  assert.equal(bytes[25], 6, `${path} must be RGBA`);
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

function pngInfo({ column, row }) {
  const stride = SPRITE_FRAME_WIDTH * 4 + 1;
  const scanlines = Buffer.alloc(stride * SPRITE_FRAME_HEIGHT);
  for (let y = 0; y < SPRITE_FRAME_HEIGHT; y += 1) {
    const sourceStart = (row * SPRITE_FRAME_HEIGHT + y) * (spriteSheet.width * 4 + 1)
      + 1 + column * SPRITE_FRAME_WIDTH * 4;
    const targetStart = y * stride;
    spriteSheet.scanlines.copy(scanlines, targetStart + 1, sourceStart, sourceStart + SPRITE_FRAME_WIDTH * 4);
  }
  return { width: SPRITE_FRAME_WIDTH, height: SPRITE_FRAME_HEIGHT, scanlines };
}

test('runtime frames have the common canvas and a transparent edge', () => {
  for (const animation of allAnimations().filter((entry) => /falling|landing|recovering/.test(entry.id))) {
    for (const frame of animation.frames) {
      const { width, height, scanlines } = pngInfo(frame);
      assert.equal(width, SPRITE_FRAME_WIDTH, `${animation.id} width`);
      assert.equal(height, SPRITE_FRAME_HEIGHT, `${animation.id} height`);
      assert.equal(scanlines[4], 0, `${animation.id} top-left pixel should be transparent`);
    }
  }
});

test('runtime frames use the shared palette and contain no pale background matte', () => {
  const manifestPath = join(process.cwd(), 'assets', 'sprites', 'normalized', 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const palette = new Set(manifest.palette.map((color) => color.join(',')));
  const frames = new Set(allAnimations().flatMap((animation) => animation.frames));
  for (const frame of frames) {
    const { width, height, scanlines } = pngInfo(frame);
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
