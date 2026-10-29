'use strict';

// Configurações do processo principal. Centralizadas aqui para não espalhar "números mágicos".
module.exports = {
  window: {
    width: 320,   // largura da janela transparente, em pixels de tela (não do sprite)
    height: 320,  // altura: sobra espaço em cima para o balão de fala
    margin: 24,   // distância da borda da tela na posição inicial
    groundMargin: 0, // patas alinhadas à borda física inferior do monitor
  },
  // Faz a janela "ignorar" o mouse nas áreas vazias, para você clicar nos apps que estão atrás.
  // A opção `forward` do Electron só existe no macOS e no Windows; no Linux desligamos.
  // Se o Chico parar de responder a cliques no seu Mac, troque para false e reinicie.
  clickThrough: process.platform !== 'linux',
  dragIntervalMs: 16, // ~60 atualizações por segundo, só enquanto você está arrastando
  physics: {
    gravity: 1650, // pixels por segundo ao quadrado
    maxFallSpeed: 1250, // pixels por segundo
    groundSnapTolerance: 8, // queda curta abaixo desta distância é corrigida sem animação de queda
    landingMs: 420,
    recoveryMs: 520,
  },
};
