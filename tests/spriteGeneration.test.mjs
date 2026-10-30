import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

test('sprite generator reproduces the checked-in assets and manifest', (t) => {
  const root = process.cwd();
  const output = mkdtempSync(join(tmpdir(), 'chico-sprites-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  writeFileSync(join(output, 'obsolete.png'), 'old generated frame');
  writeFileSync(join(output, 'manifest.json'), JSON.stringify({ frames: [{ file: 'obsolete.png' }] }));
  execFileSync('python3', [
    join(root, 'tools', 'build_normalized_sprites.py'),
    '--output', output,
  ], { cwd: output, stdio: 'pipe' });

  const checkedIn = join(root, 'assets', 'sprites', 'normalized');
  const generatedFiles = readdirSync(output).sort();
  const checkedInFiles = readdirSync(checkedIn).sort();
  assert.deepEqual(generatedFiles, checkedInFiles);

  for (const filename of checkedInFiles) {
    const checkedInHash = createHash('sha256').update(readFileSync(join(checkedIn, filename))).digest('hex');
    const generatedHash = createHash('sha256').update(readFileSync(join(output, filename))).digest('hex');
    assert.equal(generatedHash, checkedInHash, `${filename} should be reproducible`);
  }
});

test('sprite atlas generator reproduces the checked-in sheet', (t) => {
  const root = process.cwd();
  const outputDir = mkdtempSync(join(tmpdir(), 'chico-atlas-'));
  const output = join(outputDir, 'chico-spritesheet.png');
  t.after(() => rmSync(outputDir, { recursive: true, force: true }));
  execFileSync('python3', [
    join(root, 'tools', 'build_sprite_atlas.py'),
    '--root', root,
    '--output', output,
  ], { stdio: 'pipe' });

  const generated = readFileSync(output);
  const checkedIn = readFileSync(join(root, 'assets', 'sprites', 'chico-spritesheet.png'));
  assert.equal(createHash('sha256').update(generated).digest('hex'),
    createHash('sha256').update(checkedIn).digest('hex'));
  assert.equal(generated.readUInt32BE(16), 640 * 8);
  assert.equal(generated.readUInt32BE(20), 512 * 12);
});

test('grounded sprite frames share a consistent bottom alignment', () => {
  const root = resolve('assets/sprites/normalized');
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.frames.filter(({ name }) => name.startsWith('caminhada-')).length, 16);
  assert.equal(manifest.frames.filter(({ name }) => name.startsWith('corrida-')).length, 16);
  const grounded = manifest.frames.filter(({ anchor }) => anchor === 'ground');
  const groundRows = grounded.map(({ file }) => {
    const bytes = readFileSync(join(root, file));
    let offset = 8;
    const chunks = [];
    while (offset < bytes.length) {
      const size = bytes.readUInt32BE(offset);
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      if (type === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + size));
      offset += size + 12;
      if (type === 'IEND') break;
    }
    const scanlines = inflateSync(Buffer.concat(chunks));
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    let bottom = -1;
    for (let y = 0; y < height; y += 1) {
      const row = y * (width * 4 + 1);
      for (let x = 0; x < width; x += 1) {
        if (scanlines[row + 1 + x * 4 + 3] !== 0) bottom = y;
      }
    }
    return [file, bottom];
  });
  const expectedGround = manifest.canvas.groundY - 1;
  for (const [file, row] of groundRows) {
    assert.ok(Math.abs(row - expectedGround) <= 1, `${file} ends at row ${row}, expected ${expectedGround}`);
  }
});
