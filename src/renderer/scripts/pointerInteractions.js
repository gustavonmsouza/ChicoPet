export function bindPointerInteractions({
  element,
  character,
  api,
  clickMoveThreshold,
  onClick,
}) {
  let press = null;
  let interactive = false;
  const listeners = new AbortController();
  const options = { signal: listeners.signal };

  function finishPress(isClick) {
    if (!press) return;
    const wasClick = isClick && !press.moved;
    const previousState = press.previousState;
    press = null;
    element.classList.remove('dragging');
    api.dragEnd();
    if (wasClick) onClick(previousState);
  }

  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.ctrlKey) return;
    element.setPointerCapture(event.pointerId);
    press = { x: event.screenX, y: event.screenY, moved: false, previousState: character.state };
    element.classList.add('dragging');
    api.dragStart();
  }, options);

  element.addEventListener('pointermove', (event) => {
    if (!press) return;
    const distance = Math.hypot(event.screenX - press.x, event.screenY - press.y);
    if (distance > clickMoveThreshold) press.moved = true;
  }, options);

  element.addEventListener('pointerup', () => finishPress(true), options);
  element.addEventListener('pointercancel', () => finishPress(false), options);
  element.addEventListener('lostpointercapture', () => finishPress(false), options);

  function setInteractive(next) {
    if (next === interactive) return;
    interactive = next;
    api.setInteractive(next);
  }

  document.addEventListener('mousemove', (event) => {
    if (press) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    setInteractive(Boolean(target && target.closest('[data-hit]')));
  }, options);

  document.documentElement.addEventListener('mouseleave', () => {
    if (!press) setInteractive(false);
  }, options);

  document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    if (event.target.closest('[data-hit]')) api.showMenu();
  }, options);

  return () => {
    if (press) finishPress(false);
    listeners.abort();
  };
}
