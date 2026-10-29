'use strict';

// Configurações do processo principal. Centralizadas aqui para não espalhar "números mágicos".
module.exports = {
  window: {
    width: 320,   // largura da janela transparente, em pixels de tela (não do sprite)
    height: 320,  // altura: sobra espaço em cima para o balão de fala
    margin: 24,   // distância da borda da tela na posição inicial
  },
  // Faz a janela "ignorar" o mouse nas áreas vazias, para você clicar nos apps que estão atrás.
  // A opção `forward` do Electron só existe no macOS e no Windows; no Linux desligamos.
  // Se o Chico parar de responder a cliques no seu Mac, troque para false e reinicie.
  clickThrough: process.platform !== 'linux',
  dragIntervalMs: 16, // ~60 atualizações por segundo, só enquanto você está arrastando
};
