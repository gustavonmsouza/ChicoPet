// Todos os arquivos de runtime têm o mesmo canvas (640×512), a mesma paleta
// e um fundo RGBA transparente. Os arquivos left/right já são espelhados no
// disco, o que evita uma convenção global de CSS inverter a pose errada.
const url = (file) => new URL(`../../../assets/sprites/final/${file}.png`, import.meta.url).href;

const sequence = (prefix, length) => Object.freeze(
  Array.from({ length }, (_, index) => url(`${prefix}-${String(index + 1).padStart(2, '0')}`)),
);

const directional = (prefix, length) => Object.freeze({
  left: sequence(`${prefix}-left`, length),
  right: sequence(`${prefix}-right`, length),
});

export const SPRITES = Object.freeze({
  idle: url('idle'),
  dragging: url('dragging'),
  curious: url('curious'),
  happy: url('happy'),
  sitting: url('sitting'),
  sleeping: url('sleeping'),
  walking: directional('walk', 4),
  running: directional('run', 4),
  falling: directional('fall', 5),
  landing: directional('landing', 1),
  recovering: directional('recovery', 2),
});
