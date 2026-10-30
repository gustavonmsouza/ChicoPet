// Rows follow the ordering in tools/build_sprite_atlas.py. Frames are already
// mirrored on disk so each direction maps to its own strip.
export const SPRITE_SHEET = new URL('../../../assets/sprites/chico-spritesheet.png', import.meta.url).href;
export const SPRITE_SHEET_COLUMNS = 8;
export const SPRITE_SHEET_ROWS = 12;

const frame = (column, row) => Object.freeze({ column, row });
const sequence = (row, length, firstColumn = 0) => Object.freeze(
  Array.from({ length }, (_, index) => frame(firstColumn + index, row)),
);
const directional = (leftRow, rightRow, length) => Object.freeze({
  left: sequence(leftRow, length),
  right: sequence(rightRow, length),
});

export const SPRITES = Object.freeze({
  idle: sequence(0, 6),
  dragging: frame(6, 0),
  curious: frame(7, 0),
  happy: frame(0, 1),
  sitting: sequence(1, 4, 1),
  sleeping: sequence(1, 3, 5),
  walking: directional(2, 3, 8),
  running: directional(4, 5, 8),
  falling: directional(6, 7, 5),
  landing: directional(8, 9, 1),
  recovering: directional(10, 11, 2),
});
