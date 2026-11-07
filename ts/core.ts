/**
 * One shared requestAnimationFrame loop plus pointer tracking, used by the terrain
 * shader, the peekers, and the sprites.
 */

export type Updater = (dt: number, now: number) => void;

export const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const pointer = { x: innerWidth / 2, y: innerHeight / 2, active: false };

const updaters = new Set<Updater>();
const clock = { paused: false, scale: 1 };
let rafId: number | null = null;
let lastTime = performance.now();

function tick(now: number): void {
  const real = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  const dt = clock.paused ? 0 : real * clock.scale; // virtual dt
  for (const update of updaters) update(dt, now);
  rafId = requestAnimationFrame(tick);
}

function start(): void {
  if (rafId === null) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }
}

function stop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));

// The loop also runs under reduced motion. The `paused` setting defaults to
// `reduceMotion`, so updaters then receive dt = 0 and the scene stays still,
// but the terrain still gets drawn.
start();

window.addEventListener(
  "pointermove",
  (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  },
  { passive: true },
);

// pointerleave does not bubble, so it has to be listened for on an element
// (listening on window never fires).
document.documentElement.addEventListener(
  "pointerleave",
  () => {
    pointer.active = false;
  },
  { passive: true },
);

export const core = {
  add: (update: Updater): void => {
    updaters.add(update);
  },
  remove: (update: Updater): void => {
    updaters.delete(update);
  },
  setPaused: (paused: boolean): void => {
    clock.paused = paused;
  },
  setTimeScale: (scale: number): void => {
    clock.scale = scale;
  },
  reduceMotion,
  pointer,
};
