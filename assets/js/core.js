// core.js — one shared rAF loop + pointer tracking, used by the terrain
// shader, sprites, and (later) the flee-icons and settings-page uniforms.
window.TUICore = (function () {
  const updaters = new Set();
  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clock = { paused: false, scale: 1 };
  let rafId = null,
    lastT = performance.now();

  function tick(now) {
    const real = Math.min((now - lastT) / 1000, 0.1);
    lastT = now;
    const dt = clock.paused ? 0 : real * clock.scale; // virtual dt
    updaters.forEach((fn) => fn(dt, now));
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (rafId === null) {
      lastT = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  document.addEventListener("visibilitychange", () =>
    document.hidden ? stop() : start(),
  );
  if (!reduceMotion) start();

  const pointer = { x: innerWidth / 2, y: innerHeight / 2, active: false };
  window.addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    },
    { passive: true },
  );

  window.addEventListener(
    "pointerleave",
    () => {
      pointer.active = false;
    },
    { passive: true },
  );

  return {
    add: (fn) => updaters.add(fn),
    remove: (fn) => updaters.delete(fn),
    setPaused: (b) => {
      clock.paused = !!b;
    },
    setTimeScale: (x) => {
      clock.scale = x;
    },
    reduceMotion,
    pointer,
  };
})();
