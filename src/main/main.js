'use strict';

const path = require('node:path');
const { app, Menu, Tray, nativeImage, screen } = require('electron');
const channels = require('./ipc/channels');
const { registerIpc } = require('./ipc/registerIpc');
const { createMascotWindow, clampToDisplay } = require('./windows/mascotWindow');

let mascotWindow = null;
let tray = null;
let ipc = null;

const POSES = [
  ['Em pé', 'idle'],
  ['Andando', 'walk'],
  ['Sentado', 'happy'],
  ['Dormindo', 'sleep'],
];

function toggleMascot() {
  if (!mascotWindow || mascotWindow.isDestroyed()) return;
  if (mascotWindow.isVisible()) mascotWindow.hide();
  else mascotWindow.show();
}

function buildContextMenu() {
  const visible = Boolean(mascotWindow) && mascotWindow.isVisible();
  return Menu.buildFromTemplate([
    { label: visible ? 'Esconder o Chico' : 'Mostrar o Chico', click: toggleMascot },
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

// Só uma instância do app por vez (senão você teria dois Chicos brigando pela tela).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => mascotWindow && mascotWindow.show());

  app.whenReady().then(() => {
    mascotWindow = createMascotWindow();
    ipc = registerIpc({ getWindow: () => mascotWindow, buildContextMenu });
    createTray();

    // Se um monitor for removido ou a resolução mudar, traz o Chico de volta para a tela.
    const reclamp = () => clampToDisplay(mascotWindow);
    screen.on('display-removed', reclamp);
    screen.on('display-metrics-changed', reclamp);
  });

  // Fechar a janela do Chico não encerra o app: ele continua na barra de menus.
  app.on('window-all-closed', () => {});
  app.on('before-quit', () => ipc && ipc.dispose());
}
