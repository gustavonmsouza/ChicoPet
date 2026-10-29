// Configurações do renderer (a página). O processo principal tem as suas em src/main/config.js.
// Os frames finais usam um canvas comum; manter a medida fixa elimina saltos
// de tamanho e mantém os pés na mesma linha de chão entre animações.
export const SPRITE_FRAME_WIDTH = 640;
export const SPRITE_FRAME_HEIGHT = 512;
export const SPRITE_SCALE = 0.3;        // tamanho do Chico na tela = canvas × este valor
export const BUBBLE_MS = 3200;          // quanto tempo o balão fica visível
export const HAPPY_MS = 2600;           // quanto tempo o Chico fica feliz depois de um clique
export const CLICK_MOVE_THRESHOLD = 5;  // pixels: acima disso é arrasto, não clique
