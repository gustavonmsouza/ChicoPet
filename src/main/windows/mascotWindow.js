'use strict';

const path = require('node:path');
const { BrowserWindow, screen } = require('electron');
const config = require('../config');

/** Cria a janela transparente e sem moldura onde o Chico vive. */
function createMascotWindow() {
  const { width, height, margin } = config.window;
  const display = screen.getPrimaryDisplay();
  const area = display.workArea;

  const win = new BrowserWindow({
    width,
    height,
    x: Math.max(area.x, area.x + area.width - width - margin),
    y: Math.max(display.bounds.y, display.bounds.y + display.bounds.height - height),
    transparent: true,       // fundo transparente
    frame: false,            // sem barra de título nem bordas
    hasShadow: false,        // sem sombra retangular do macOS
    backgroundColor: '#00000000',
    resizable: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    skipTaskbar: true,
    show: false,             // só mostra quando o conteúdo estiver pronto (evita piscar)
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload', 'preload.js'),
      contextIsolation: true,   // o renderer não enxerga o mundo do preload
      nodeIntegration: false,   // o renderer não tem require() nem acesso ao Node
      sandbox: true,            // processo do renderer com permissões reduzidas
    },
  });

  win.setAlwaysOnTop(true, 'floating');   // fica acima das janelas comuns
  win.setVisibleOnAllWorkspaces(true);    // acompanha você nas áreas de trabalho (Spaces)

  if (config.clickThrough) {
    // Começa ignorando o mouse; o renderer avisa quando o cursor está sobre o Chico.
    win.setIgnoreMouseEvents(true, { forward: true });
  }

  // Por segurança, o renderer nunca navega para outro lugar nem abre janelas novas.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
  return win;
}

/** Mantém a janela inteira dentro do monitor onde ela está. */
function clampToDisplay(win) {
  if (!win || win.isDestroyed()) return;
  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const maxX = Math.max(area.x, area.x + area.width - bounds.width);
  const maxY = Math.max(display.bounds.y, display.bounds.y + display.bounds.height - bounds.height);
  const x = Math.min(Math.max(bounds.x, area.x), maxX);
  const y = Math.min(Math.max(bounds.y, area.y), maxY);
  if (x !== bounds.x || y !== bounds.y) win.setBounds({ ...bounds, x, y });
}

module.exports = { createMascotWindow, clampToDisplay };
