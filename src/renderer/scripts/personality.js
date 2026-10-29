// Personalidade do Chico: o que ele diz. Separada da animação e da movimentação.
export const PHRASES = Object.freeze({
  click: [
    'Au au!',
    'Opa, oi!',
    'Eu te vi aí!',
    'Pode continuar o carinho.',
    'Tem petisco aí?',
    'Tô de olho na sua tela.',
    'Hoje eu só quero companhia.',
  ],
  wake: [
    'Hã? Eu tava sonhando com petisco...',
    'Já acordei! Já acordei!',
    'Só mais cinco minutinhos... tá, acordei.',
  ],
});

/** Devolve uma função que sorteia uma frase, sem repetir a anterior. */
export function createPhrasePicker(phrases, random = Math.random) {
  let last = -1;
  return () => {
    if (phrases.length === 0) return '';
    if (phrases.length === 1) return phrases[0];
    let index;
    do {
      index = Math.floor(random() * phrases.length);
    } while (index === last);
    last = index;
    return phrases[index];
  };
}
