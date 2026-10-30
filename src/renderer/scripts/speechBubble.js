export function createSpeechBubble({ element, duration }) {
  let timer = null;

  function clear() {
    clearTimeout(timer);
    timer = null;
  }

  function say(text) {
    clear();
    element.hidden = true;
    void element.offsetWidth;
    element.textContent = text;
    element.hidden = false;
    timer = setTimeout(() => {
      element.hidden = true;
      timer = null;
    }, duration);
  }

  return { say, clear };
}
