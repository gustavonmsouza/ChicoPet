'use strict';

const { ipcMain, screen } = require('electron');
const channels = require('./channels');
const config = require('../config');
const { clampToDisplay } = require('../windows/mascotWindow');
const { AutonomousController } = require('../autonomousController');

/**
 * Registra os "ouvintes" IPC. Regra de segurança: só aceitamos mensagens vindas da NOSSA janela
 * e nenhuma mensagem carrega coordenadas ou comandos arbitrários.
 */
function registerIpc({ getWindow, buildContextMenu }) {
  let dragTimer = null;
  const behavior = new AutonomousController({
    getWindow,
    getWorkArea: (bounds) => screen.getDisplayMatching(bounds).workArea,
    groundMargin: config.window.groundMargin,
    ...config.physics,
    onState: (value) => {
      const win = getWindow();
      if (win && !win.isDestroyed()) win.webContents.send(channels.AUTONOMOUS_STATE, value);
    },
  });
  behavior.start();

  const isFromMascot = (event) => {
    const win = getWindow();
    return Boolean(win) && !win.isDestroyed() && event.sender === win.webContents;
  };

  function stopDrag() {
    if (dragTimer) clearInterval(dragTimer);
    dragTimer = null;
  }

  ipcMain.on(channels.DRAG_START, (event) => {
    if (!isFromMascot(event)) return;
    const win = getWindow();
    behavior.startDrag();
    stopDrag();
    const startCursor = screen.getCursorScreenPoint();
    let lastCursor = startCursor;
    const startBounds = win.getBounds();
    // O processo principal consulta o cursor sozinho: o renderer não precisa (nem pode) mandar posições.
    dragTimer = setInterval(() => {
      if (win.isDestroyed()) return stopDrag();
      const cursor = screen.getCursorScreenPoint();
      const horizontalDelta = cursor.x - lastCursor.x;
      if (Math.abs(horizontalDelta) >= 2) behavior.setDirection(Math.sign(horizontalDelta));
      lastCursor = cursor;
      const x = Math.round(startBounds.x + cursor.x - startCursor.x);
      const y = Math.round(startBounds.y + cursor.y - startCursor.y);
      const now = win.getBounds();
      if (x !== now.x || y !== now.y) {
        // setBounds com largura/altura fixas evita que a janela "cresça" ao mover em telas com escala.
        win.setBounds({ x, y, width: startBounds.width, height: startBounds.height });
      }
    }, config.dragIntervalMs);
  });

  ipcMain.on(channels.DRAG_END, (event) => {
    if (!isFromMascot(event)) return;
    stopDrag();
    clampToDisplay(getWindow());
    behavior.endDrag();
  });

  ipcMain.on(channels.SET_INTERACTIVE, (event, interactive) => {
    if (!isFromMascot(event) || !config.clickThrough) return;
    if (typeof interactive !== 'boolean') return; // valida o tipo
    getWindow().setIgnoreMouseEvents(!interactive, { forward: true });
  });

  ipcMain.on(channels.SHOW_MENU, (event) => {
    if (!isFromMascot(event)) return;
    buildContextMenu().popup({ window: getWindow() });
  });

  ipcMain.on(channels.INTERACT, (event) => {
    if (!isFromMascot(event)) return;
    behavior.interact();
  });

  return { dispose: () => { stopDrag(); behavior.stop(); } };
}

module.exports = { registerIpc };
