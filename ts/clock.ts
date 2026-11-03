/** Status bar clock. */

export function initClock(): void {
  const element = document.getElementById("clock");
  if (!element) return;

  const tick = (): void => {
    element.textContent = new Date().toLocaleTimeString([], { hour12: false });
  };
  tick();
  setInterval(tick, 1000);
}
