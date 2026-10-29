'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Nomes dos canais (cópia de src/main/ipc/channels.js; o preload em sandbox só pode importar 'electron').
const CH = {
  DRAG_START: 'mascot:drag-start',
  DRAG_END: 'mascot:drag-end',
  SET_INTERACTIVE: 'mascot:set-interactive',
  SHOW_MENU: 'mascot:show-menu',
  SET_POSE: 'mascot:set-pose',
  INTERACT: 'mascot:interact',
  AUTONOMOUS_STATE: 'mascot:autonomous-state',
};

// Única ponte entre a página e o sistema: poucas funções, nenhuma recebe comando livre.
contextBridge.exposeInMainWorld('chicoApi', {
  dragStart: () => ipcRenderer.send(CH.DRAG_START),
  dragEnd: () => ipcRenderer.send(CH.DRAG_END),
  setInteractive: (value) => ipcRenderer.send(CH.SET_INTERACTIVE, Boolean(value)),
  showMenu: () => ipcRenderer.send(CH.SHOW_MENU),
  interact: () => ipcRenderer.send(CH.INTERACT),
  onSetPose: (callback) => {
    if (typeof callback !== 'function') return;
    // Não repassamos o objeto "event" do Electron para a página.
    ipcRenderer.on(CH.SET_POSE, (_event, pose) => callback(String(pose)));
  },
  onAutonomousState: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on(CH.AUTONOMOUS_STATE, (_event, value) => {
      if (!value || typeof value.state !== 'string' || ![-1, 1].includes(value.direction)) return;
      callback({ state: value.state, direction: value.direction });
    });
  },
});
