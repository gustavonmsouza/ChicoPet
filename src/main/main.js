'use strict';

const path = require('node:path');
const { app, dialog, Menu, Tray, nativeImage, screen } = require('electron');
const channels = require('./ipc/channels');
const { registerIpc } = require('./ipc/registerIpc');
const { createMascotWindow, clampToDisplay } = require('./windows/mascotWindow');
const {
  ACTIVITY_MODES, DEFAULT_PREFERENCES, loadPreferences, savePreferences,
} = require('./preferences');

if (process.env.CHICO_ELECTRON_SMOKE_USER_DATA) {
  app.setPath('userData', path.resolve(process.env.CHICO_ELECTRON_SMOKE_USER_DATA));
}

let mascotWindow = null;
let tray = null;
let ipc = null;
let preferences = { ...DEFAULT_PREFERENCES };
let preferencesPath = null;

const POSES = [
  ['Em pé', 'idle'],
  ['Andando', 'walk'],
  ['Sentado', 'happy'],
  ['Dormindo', 'sleep'],
];

function changePreferences(patch) {
  try {
    const updated = savePreferences(preferencesPath, { ...preferences, ...patch });
    preferences = updated;
    ipc?.updatePreferences(updated);
    if (patch.startAtLogin !== undefined && process.platform === 'darwin') {
      app.setLoginItemSettings({ openAtLogin: updated.startAtLogin, openAsHidden: false });
    }
  } catch (error) {
    console.error(error);
    dialog.showErrorBox('Não foi possível salvar as preferências', error.message);
  }
}

function toggleMascot() {
  if (!mascotWindow || mascotWindow.isDestroyed()) return;
  if (mascotWindow.isVisible()) mascotWindow.hide();
  else mascotWindow.show();
}

function buildContextMenu() {
  const visible = Boolean(mascotWindow) && mascotWindow.isVisible();
  return Menu.buildFromTemplate([
    { label: visible ? 'Esconder o Chico' : 'Mostrar o Chico', click: toggleMascot },
    { label: 'Fazer carinho', click: () => ipc?.interact() },
    { label: 'Brincar', click: () => ipc?.play() },
    { type: 'separator' },
    {
      label: 'Preferências',
      submenu: [
        {
          label: 'Movimento autônomo',
          type: 'checkbox',
          checked: preferences.autonomousMovement,
          click: (item) => changePreferences({ autonomousMovement: item.checked }),
        },
        {
          label: 'Ritmo',
          submenu: Object.entries(ACTIVITY_MODES).map(([id, mode]) => ({
            label: mode.label,
            type: 'radio',
            checked: preferences.activityMode === id,
            click: () => changePreferences({ activityMode: id }),
          })),
        },
        {
          label: 'Iniciar com o sistema',
          type: 'checkbox',
          checked: preferences.startAtLogin,
          enabled: process.platform === 'darwin',
          click: (item) => changePreferences({ startAtLogin: item.checked }),
        },
      ],
    },
    { type: 'separator' },
    {
      label: 'Poses (teste)',
      submenu: POSES.map(([label, pose]) => ({
        label,
        click: () => mascotWindow.webContents.send(channels.SET_POSE, pose),
      })),
    },
    { type: 'separator' },
    { label: 'Sair', role: 'quit' },
  ]);
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'assets', 'icons', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('Chico Desktop Companion');
  tray.on('click', toggleMascot);                                   // clique: mostra/esconde
  tray.on('right-click', () => tray.popUpContextMenu(buildContextMenu()));
}

function runSmokeTest() {
  const win = mascotWindow;
  const fail = (error) => {
    console.error('Electron smoke test failed:', error);
    app.exit(1);
  };
  win.webContents.once('did-fail-load', (_event, code, description) => {
    fail(new Error(`Renderer failed to load (${code}): ${description}`));
  });
  win.webContents.once('did-finish-load', async () => {
    try {
      await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        const deadline = Date.now() + 5000;
        const check = () => {
          if (document.documentElement.dataset.rendererReady === 'true') return resolve();
          if (Date.now() >= deadline) return reject(new Error('Renderer module did not initialize'));
          setTimeout(check, 20);
        };
        check();
      })`);
      const initialState = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        const image = document.getElementById('chico');
        const timeout = setTimeout(() => reject(new Error('Mascot sprite did not load')), 5000);
        const check = () => {
          clearTimeout(timeout);
          if (!image.naturalWidth || !image.naturalHeight) return reject(new Error('Mascot sprite is empty'));
          resolve({
            width: image.naturalWidth,
            height: image.naturalHeight,
            bridge: typeof window.chicoApi?.interact === 'function',
          });
        };
        if (image.complete) check();
        else image.addEventListener('load', check, { once: true });
        image.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Mascot sprite failed to decode'));
        }, { once: true });
      })`);
      if (!initialState.bridge) throw new Error('Preload API is unavailable');

      win.webContents.send(channels.SET_POSE, 'walk');
      const walkingFrames = await win.webContents.executeJavaScript(`new Promise((resolve) => {
        const image = document.getElementById('chico');
        const frames = new Set([image.src]);
        const interval = setInterval(() => frames.add(image.src), 35);
        setTimeout(() => {
          clearInterval(interval);
          resolve([...frames]);
        }, 1200);
      })`);
      const distinctWalkingFrames = new Set(walkingFrames.filter((src) => src.includes('/caminhada-direita-')));
      if (distinctWalkingFrames.size < 8) {
        throw new Error(`Walking animation displayed ${distinctWalkingFrames.size} distinct poses`);
      }

      win.webContents.send(channels.AUTONOMOUS_STATE, { state: 'WALKING', direction: -1 });
      const leftWalkingFrames = await win.webContents.executeJavaScript(`new Promise((resolve) => {
        const image = document.getElementById('chico');
        const frames = new Set();
        const timeout = setTimeout(() => {
          clearInterval(interval);
          resolve([...frames]);
        }, 3000);
        const interval = setInterval(() => {
          if (image.src.includes('/caminhada-esquerda-')) frames.add(image.src);
          if (frames.size === 8) {
            clearTimeout(timeout);
            clearInterval(interval);
            resolve([...frames]);
          }
        }, 25);
      })`);
      const distinctLeftWalkingFrames = new Set(leftWalkingFrames.filter((src) => src.includes('/caminhada-esquerda-')));
      if (distinctLeftWalkingFrames.size < 8) {
        throw new Error(`Left walking animation displayed ${distinctLeftWalkingFrames.size} poses: ${[...distinctLeftWalkingFrames].join(', ')}`);
      }

      await win.webContents.executeJavaScript('window.chicoApi.interact()');
      await new Promise((resolve) => setTimeout(resolve, 500));
      const currentSprite = await win.webContents.executeJavaScript(
        'document.getElementById("chico").src',
      );
      if (!currentSprite.includes('/feliz.png')) {
        throw new Error(`Interaction did not select the happy sprite: ${currentSprite}`);
      }

      console.log(`Electron smoke test passed (${initialState.width}x${initialState.height} sprite, ${distinctWalkingFrames.size} right and ${distinctLeftWalkingFrames.size} left walking poses, IPC interaction).`);
      app.exit(0);
    } catch (error) {
      fail(error);
    }
  });
}

// Só uma instância do app por vez (senão você teria dois Chicos brigando pela tela).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => mascotWindow && mascotWindow.show());

  app.whenReady().then(() => {
    preferencesPath = path.join(app.getPath('userData'), 'preferences.json');
    preferences = loadPreferences(preferencesPath);
    if (process.env.CHICO_ELECTRON_SMOKE === '1') {
      preferences = { ...preferences, autonomousMovement: false };
    }
    if (process.platform === 'darwin' && process.env.CHICO_ELECTRON_SMOKE !== '1') {
      app.setLoginItemSettings({ openAtLogin: preferences.startAtLogin, openAsHidden: false });
    }
    mascotWindow = createMascotWindow();
    ipc = registerIpc({ getWindow: () => mascotWindow, buildContextMenu, preferences });
    createTray();

    // Se um monitor for removido ou a resolução mudar, traz o Chico de volta para a tela.
    const reclamp = () => clampToDisplay(mascotWindow);
    screen.on('display-removed', reclamp);
    screen.on('display-metrics-changed', reclamp);
    if (process.env.CHICO_ELECTRON_SMOKE === '1') runSmokeTest();
  }).catch((error) => {
    console.error('Falha ao iniciar o Chico:', error);
    dialog.showErrorBox('Falha ao iniciar o Chico', error.message);
    app.exit(1);
  });

  // Fechar a janela do Chico não encerra o app: ele continua na barra de menus.
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => ipc && ipc.dispose());
}
