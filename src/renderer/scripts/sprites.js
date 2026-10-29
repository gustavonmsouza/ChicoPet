// Registro dos sprites. Para trocar o desenho do Chico, substitua os PNGs em assets/sprites/
// mantendo os nomes (ou altere os caminhos aqui). Convenção: todos os sprites olham para a DIREITA.
const url = (file) => new URL(`../../../assets/sprites/${file}`, import.meta.url).href;

export const SPRITES = Object.freeze({
  idle: url('idle.png'),
  walk: url('walk.png'),
  happy: url('happy.png'),
  sleep: url('sleep.png'),
});
