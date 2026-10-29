'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

if (process.platform !== 'darwin') {
  throw new Error('O teste smoke do Electron precisa ser executado no macOS.');
}

const projectRoot = path.resolve(__dirname, '..');
const packagedExecutable = process.argv[2] ? path.resolve(process.argv[2]) : null;
const executable = packagedExecutable || require('electron');
if (!fs.existsSync(executable)) throw new Error(`Electron executable not found: ${executable}`);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'chico-electron-smoke-'));
const child = spawn(executable, packagedExecutable ? [] : ['.'], {
  cwd: projectRoot,
  env: {
    ...process.env,
    CHICO_ELECTRON_SMOKE: '1',
    CHICO_ELECTRON_SMOKE_USER_DATA: userData,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
const timeout = setTimeout(() => child.kill('SIGTERM'), 30000);
child.stdout.setEncoding('utf8').on('data', (data) => { output += data; });
child.stderr.setEncoding('utf8').on('data', (data) => { output += data; });

child.on('error', (error) => {
  clearTimeout(timeout);
  fs.rmSync(userData, { recursive: true, force: true });
  console.error(error);
  process.exitCode = 1;
});

child.on('close', (code, signal) => {
  clearTimeout(timeout);
  fs.rmSync(userData, { recursive: true, force: true });
  if (code === 0) {
    process.stdout.write(output);
    return;
  }
  console.error(output);
  console.error(`Electron smoke test failed (code ${code ?? 'none'}, signal ${signal ?? 'none'}).`);
  process.exitCode = 1;
});
