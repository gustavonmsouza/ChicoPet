// Todos os arquivos de runtime têm o mesmo canvas (640×512), a mesma paleta
// e um fundo RGBA transparente. Os arquivos direita/esquerda já são espelhados no
// disco, o que evita uma convenção global de CSS inverter a pose errada.
const url = (file) => new URL(`../../../assets/sprites/normalized/${file}.png`, import.meta.url).href;

const sequence = (prefix, length) => Object.freeze(
  Array.from({ length }, (_, index) => url(`${prefix}-${String(index + 1).padStart(2, '0')}`)),
);

const directional = (prefix, length) => Object.freeze({
  left: sequence(`${prefix}-esquerda`, length),
  right: sequence(`${prefix}-direita`, length),
});

export const SPRITES = Object.freeze({
  idle: url('parado'),
  dragging: url('arrastando'),
  curious: url('curioso'),
  happy: url('feliz'),
  sitting: url('sentado'),
  sleeping: url('dormindo'),
  walking: directional('caminhada', 4),
  running: directional('corrida', 5),
  falling: directional('queda', 5),
  landing: directional('aterrissagem', 1),
  recovering: directional('recuperacao', 2),
});
