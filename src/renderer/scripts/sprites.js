// Registro dos sprites. Para trocar o desenho do Chico, substitua os PNGs em assets/sprites/
// mantendo os nomes (ou altere os caminhos aqui). Convenção: todos os sprites olham para a DIREITA.
const url = (file) => new URL(`../../../assets/sprites/${file}`, import.meta.url).href;
const extracted = (sheet, index) => url(`extracted/${sheet}/pose_${String(index).padStart(2, '0')}.png`);

export const SPRITES = Object.freeze({
  idle: url('idle.png'),
  walk: url('walk.png'),
  happy: url('happy.png'),
  sleep: url('sleep.png'),
  walkCycle: Object.freeze([4, 5, 6, 7].map((index) => extracted('chico1', index))),
  runCycle: Object.freeze([6, 7, 8, 9, 10].map((index) => extracted('chico2', index))),
  fallPawsUp: extracted('chico3', 7),
  fallRolled: extracted('chico3', 8),
  fallCrouched: extracted('chico3', 9),
  fallLow: extracted('chico3', 10),
  fallFaceDown: extracted('chico3', 11),
  fallProne: extracted('chico3', 12),
  landing: extracted('chico3', 14),
  recovery: extracted('chico3', 13),
  seated: extracted('chico3', 15),
  playBow: extracted('chico3', 16),
  lying: extracted('chico3', 17),
  sleeping: extracted('chico3', 18),
  extractedPoses: Object.freeze({
    standing: Object.freeze([1, 2, 3, 4, 5, 6].map((index) => extracted('chico1', index))),
    actions: Object.freeze(Array.from({ length: 20 }, (_, index) => extracted('chico2', index + 1))),
    falls: Object.freeze(Array.from({ length: 18 }, (_, index) => extracted('chico3', index + 1))),
  }),
});
