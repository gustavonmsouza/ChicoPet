'use strict';

// Nomes dos canais IPC (processo principal <-> renderer).
// O preload tem uma cópia desses nomes porque roda em sandbox e não pode usar require() de arquivos locais.
module.exports = Object.freeze({
  DRAG_START: 'mascot:drag-start',
  DRAG_END: 'mascot:drag-end',
  SET_INTERACTIVE: 'mascot:set-interactive',
  SHOW_MENU: 'mascot:show-menu',
  SET_POSE: 'mascot:set-pose', // principal -> renderer
});
