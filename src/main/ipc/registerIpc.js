'use strict';

const { ipcMain, screen } = require('electron');
const channels = require('./channels');
const config = require('../config');
const { clampToDisplay } = require('../windows/mascotWindow');

/**
 * Registra os "ouvintes" IPC. Regra de segurança: só aceitamos mensagens vindas da NOSSA janela
 * e nenhuma mensagem carrega coordenadas ou comandos arbitrários.
 */
function registerIpc({ getWindow, buildContextMenu }) {
  let dragTimer = null;

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
    stopDrag();
    const startCursor = screen.getCursorScreenPoint();
    const startBounds = win.getBounds();
    // O processo principal consulta o cursor sozinho: o renderer não precisa (nem pode) mandar posições.
    dragTimer = setInterval(() => {
      if (win.isDestroyed()) return stopDrag();
      const cursor = screen.getCursorScreenPoint();
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

  return { dispose: stopDrag };
}

module.exports = { registerIpc };
