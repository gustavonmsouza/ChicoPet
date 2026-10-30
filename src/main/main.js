'use strict';

const path = require('node:path');
const { app, dialog, Menu, Tray, nativeImage, screen } = require('electron');
const { assetPath } = require('./appPaths');
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
  ['Andando: próximo quadro', 'walk-step'],
  ['Sentado', 'sit'],
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
  const icon = nativeImage.createFromPath(assetPath('icons', 'tray.png'));
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
        const mascot = document.getElementById('chico');
        const background = getComputedStyle(mascot).backgroundImage;
        if (!background || background === 'none') return reject(new Error('Mascot atlas was not configured'));
        const image = new Image();
        const timeout = setTimeout(() => reject(new Error('Mascot atlas did not load')), 5000);
        const check = () => {
          clearTimeout(timeout);
          if (!image.naturalWidth || !image.naturalHeight) return reject(new Error('Mascot atlas is empty'));
          resolve({
            atlasWidth: image.naturalWidth,
            atlasHeight: image.naturalHeight,
            width: mascot.getBoundingClientRect().width,
            height: mascot.getBoundingClientRect().height,
            bridge: typeof window.chicoApi?.interact === 'function',
          });
        };
        image.addEventListener('load', check, { once: true });
        image.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Mascot atlas failed to decode'));
        }, { once: true });
        image.src = background.slice(5, -2);
        if (image.complete) check();
      })`);
      if (!initialState.bridge) throw new Error('Preload API is unavailable');

      win.webContents.send(channels.SET_POSE, 'walk');
      const walkingFrames = await win.webContents.executeJavaScript(`new Promise((resolve) => {
        const mascot = document.getElementById('chico');
        const position = () => {
          const style = getComputedStyle(mascot);
          return \`\${style.backgroundPositionX}|\${style.backgroundPositionY}\`;
        };
        const frames = new Set([position()]);
        const interval = setInterval(() => frames.add(position()), 35);
        setTimeout(() => {
          clearInterval(interval);
          resolve([...frames]);
        }, 1200);
      })`);
      if (walkingFrames.length < 8) {
        throw new Error(`Walking animation displayed ${walkingFrames.length} distinct poses`);
      }

      const measureFrameChanges = (duration) => win.webContents.executeJavaScript(`new Promise((resolve) => {
        const mascot = document.getElementById('chico');
        const position = () => {
          const style = getComputedStyle(mascot);
          return \`\${style.backgroundPositionX}|\${style.backgroundPositionY}\`;
        };
        let previous = position();
        let changes = 0;
        const interval = setInterval(() => {
          const next = position();
          if (next !== previous) {
            previous = next;
            changes += 1;
          }
        }, 10);
        setTimeout(() => {
          clearInterval(interval);
          resolve(changes);
        }, ${duration});
      })`);
      win.webContents.send(channels.AUTONOMOUS_STATE, { state: 'WALKING', direction: 1, movementSpeed: 75 });
      const slowWalkChanges = await measureFrameChanges(1000);
      win.webContents.send(channels.AUTONOMOUS_STATE, { state: 'WALKING', direction: 1, movementSpeed: 145 });
      const fastWalkChanges = await measureFrameChanges(1000);
      if (fastWalkChanges <= slowWalkChanges) {
        throw new Error(`Walking animation did not speed up with movement (${slowWalkChanges} -> ${fastWalkChanges})`);
      }

      win.webContents.send(channels.AUTONOMOUS_STATE, { state: 'WALKING', direction: -1, movementSpeed: 105 });
      const leftWalkingFrames = await win.webContents.executeJavaScript(`new Promise((resolve) => {
        const mascot = document.getElementById('chico');
        const position = () => {
          const style = getComputedStyle(mascot);
          return \`\${style.backgroundPositionX}|\${style.backgroundPositionY}\`;
        };
        const frames = new Set();
        const timeout = setTimeout(() => {
          clearInterval(interval);
          resolve([...frames]);
        }, 3000);
        const interval = setInterval(() => {
          const frame = position();
          if (frame.endsWith('|-307.2px')) frames.add(frame);
          if (frames.size === 8) {
            clearTimeout(timeout);
            clearInterval(interval);
            resolve([...frames]);
          }
        }, 25);
      })`);
      if (leftWalkingFrames.length < 8) {
        throw new Error(`Left walking animation displayed ${leftWalkingFrames.length} poses: ${leftWalkingFrames.join(', ')}`);
      }

      const readPosition = `(() => {
        const style = getComputedStyle(document.getElementById('chico'));
        return \`\${style.backgroundPositionX}|\${style.backgroundPositionY}\`;
      })()`;
      const beforeStep = await win.webContents.executeJavaScript(readPosition);
      win.webContents.send(channels.SET_POSE, 'walk-step');
      await new Promise((resolve) => setTimeout(resolve, 25));
      const afterStep = await win.webContents.executeJavaScript(readPosition);
      if (beforeStep === afterStep || !afterStep.endsWith('|-307.2px')) {
        throw new Error('Manual walking frame step did not advance the sprite');
      }
      win.webContents.send(channels.SET_POSE, 'walk');
      await new Promise((resolve) => setTimeout(resolve, 180));
      const afterResume = await win.webContents.executeJavaScript(readPosition);
      if (afterResume === afterStep) throw new Error('Automatic walking did not resume after frame stepping');

      await win.webContents.executeJavaScript('window.chicoApi.interact()');
      await new Promise((resolve) => setTimeout(resolve, 500));
      const currentPosition = await win.webContents.executeJavaScript(readPosition);
      if (currentPosition !== '0px|-153.6px') {
        throw new Error(`Interaction did not select the happy frame: ${currentPosition}`);
      }

      console.log(`Electron smoke test passed (${initialState.width}x${initialState.height} sprite, `
        + `${initialState.atlasWidth}x${initialState.atlasHeight} atlas, ${walkingFrames.length} right and `
        + `${leftWalkingFrames.length} left walking poses, IPC interaction).`);
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
