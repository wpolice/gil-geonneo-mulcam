const KEY_TO_DIRECTION = {
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  ArrowLeft: [1, 0],
  ArrowRight: [-1, 0],
};

export function initInput(onHop) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const direction = KEY_TO_DIRECTION[event.key];
    if (!direction) return;
    event.preventDefault();
    onHop(direction[0], direction[1]);
  });
}
