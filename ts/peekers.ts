/** ASCII critters that pop in from the panel edges. Draws into the .sprite-layer. */

import { core } from "./core";
import { settings } from "./settings";
import { clamp, isMobile, pick, rand } from "./util";

type Edge = "top" | "bottom" | "left" | "right";
type Phase = "wait" | "rise" | "hold" | "sink";
type Range = readonly [number, number];

const CONFIG = {
  art: String.raw`    |\__/,|   (\
  _.|o o  |_   ) )
-(((---(((--------`,

  scale: 1,
  // Fraction of the sprite's size PERPENDICULAR to its edge that pokes in.
  revealFrac: 1.0,
  riseMs: 220,
  holdMs: [700, 2600] as Range,
  sinkMs: 380,
  waitMs: [2500, 7000] as Range,
  spawnDelayMs: [1200, 33500] as Range,
  mobileCount: 2,
} as const;

const DESKTOP_EDGES: readonly [Edge, ...Edge[]] = ["top", "bottom", "left", "right"];
const MOBILE_EDGES: readonly [Edge, ...Edge[]] = ["left", "right"];
const ROTATION: Readonly<Record<Edge, number>> = { top: 180, bottom: 0, left: 90, right: -90 };

function isSide(edge: Edge): boolean {
  return edge === "left" || edge === "right";
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function easeInQuad(t: number): number {
  return t * t;
}

interface Spot {
  readonly edge: Edge;
  /** Position along the edge, 0..1. */
  readonly at: number;
}

interface Peeker {
  readonly el: HTMLPreElement;
  readonly mobile: boolean;
  readonly observer: ResizeObserver;
  w: number;
  h: number;
  shown: boolean;
  spot: Spot;
  phase: Phase;
  phaseT: number;
  waitFor: number;
  holdFor: number;
}

export function startPeekers(): void {
  const layer = document.querySelector<HTMLElement>(".sprite-layer");
  if (!layer || core.reduceMotion) return;
  const spriteLayer = layer;

  const size = { w: 0, h: 0 };
  function updateSize(): void {
    size.w = spriteLayer.clientWidth;
    size.h = spriteLayer.clientHeight;
  }
  new ResizeObserver(updateSize).observe(spriteLayer);
  updateSize();

  function visibleYRange(): readonly [number, number] {
    const rect = spriteLayer.getBoundingClientRect();
    const top = Math.max(0, -rect.top);
    const bottom = Math.min(size.h, window.innerHeight - rect.top);
    return bottom > top ? [top, bottom] : [0, size.h];
  }

  /** On-screen footprint for a given edge. Rotating 90° swaps width and height. */
  function footprint(p: Peeker, edge: Edge): { w: number; h: number } {
    const w = p.w * CONFIG.scale;
    const h = p.h * CONFIG.scale;
    return isSide(edge) ? { w: h, h: w } : { w, h };
  }

  function pickSpot(p: Peeker): Spot {
    const edge = pick(p.mobile ? MOBILE_EDGES : DESKTOP_EDGES);
    let at = rand(0, 1);

    if (p.mobile && isSide(edge)) {
      const f = footprint(p, edge);
      const [yMin, yMax] = visibleYRange();
      const lo = yMin + f.h / 2;
      const hi = Math.max(lo, yMax - f.h / 2); // whole sprite stays in view
      at = size.h > 0 ? rand(lo, hi) / size.h : 0.5;
    }
    return { edge, at };
  }

  function makePeeker(mobile: boolean): Peeker {
    const el = document.createElement("pre");
    el.className = "peeker";
    el.textContent = CONFIG.art;
    el.setAttribute("aria-hidden", "true");

    // Pin the layout box to (0,0) so translate() is the ONLY thing that positions
    // it, independent of the layer's own layout.
    Object.assign(el.style, {
      position: "absolute",
      top: "0",
      left: "0",
      margin: "0",
      width: "max-content",
      whiteSpace: "pre",
      visibility: "hidden",
      pointerEvents: "none",
      transformOrigin: "50% 50%",
    });
    spriteLayer.appendChild(el);

    // offsetWidth/Height are layout sizes: unaffected by transforms, and no
    // per-frame measuring. The observer re-measures on font load / CSS changes.
    const peeker: Peeker = {
      el,
      mobile,
      observer: new ResizeObserver(() => measure(peeker)),
      w: 0,
      h: 0,
      shown: false,
      spot: { edge: "left", at: 0.5 },
      phase: "wait",
      phaseT: 0,
      waitFor: rand(...CONFIG.waitMs) + rand(0, 1500) + rand(0, CONFIG.spawnDelayMs[1]),
      holdFor: 0,
    };
    measure(peeker);
    peeker.observer.observe(el);
    peeker.spot = pickSpot(peeker);
    return peeker;
  }

  function measure(p: Peeker): void {
    p.w = p.el.offsetWidth;
    p.h = p.el.offsetHeight;
  }

  /**
   * Returns the translate that centers the sprite on the target point.
   * reveal 0 = fully outside its edge, 1 = revealFrac of it inside.
   */
  function place(p: Peeker, reveal: number): { x: number; y: number } {
    const { edge, at } = p.spot;
    const f = footprint(p, edge);
    const perpendicular = isSide(edge) ? f.w : f.h;
    const depth = perpendicular * CONFIG.revealFrac * reveal;

    const alongX = clamp(at * size.w, f.w / 2, size.w - f.w / 2);
    const alongY = clamp(at * size.h, f.h / 2, size.h - f.h / 2);

    let cx: number;
    let cy: number;
    switch (edge) {
      case "top":
        cx = alongX;
        cy = -f.h / 2 + depth;
        break;
      case "bottom":
        cx = alongX;
        cy = size.h + f.h / 2 - depth;
        break;
      case "left":
        cx = -f.w / 2 + depth;
        cy = alongY;
        break;
      case "right":
        cx = size.w + f.w / 2 - depth;
        cy = alongY;
        break;
    }
    // Translate uses the LAYOUT box (rotation/scale happen around its center).
    return { x: cx - p.w / 2, y: cy - p.h / 2 };
  }

  function draw(p: Peeker): void {
    if (p.phase === "wait") {
      if (p.shown) {
        p.el.style.visibility = "hidden";
        p.shown = false;
      }
      return;
    }
    if (!p.shown) {
      p.el.style.visibility = "visible";
      p.shown = true;
    }

    let reveal: number;
    if (p.phase === "rise") {
      reveal = easeOutCubic(Math.min(p.phaseT / CONFIG.riseMs, 1));
    } else if (p.phase === "hold") {
      reveal = 1;
    } else {
      reveal = 1 - easeInQuad(Math.min(p.phaseT / CONFIG.sinkMs, 1));
    }

    const pos = place(p, reveal);
    p.el.style.transform =
      `translate3d(${pos.x}px, ${pos.y}px, 0)` +
      ` rotate(${ROTATION[p.spot.edge]}deg)` +
      ` scale(${CONFIG.scale})`;
  }

  function step(p: Peeker, dtMs: number): void {
    p.phaseT += dtMs;

    if (p.phase === "wait") {
      if (p.phaseT >= p.waitFor) {
        p.spot = pickSpot(p);
        p.phase = "rise";
        p.phaseT = 0;
      }
    } else if (p.phase === "rise" && p.phaseT >= CONFIG.riseMs) {
      p.phase = "hold";
      p.phaseT = 0;
      p.holdFor = rand(...CONFIG.holdMs);
    } else if (p.phase === "hold" && p.phaseT >= p.holdFor) {
      p.phase = "sink";
      p.phaseT = 0;
    } else if (p.phase === "sink" && p.phaseT >= CONFIG.sinkMs) {
      p.phase = "wait";
      p.phaseT = 0;
      p.waitFor = rand(...CONFIG.waitMs) + rand(...CONFIG.spawnDelayMs);
    }
  }

  const mobile = isMobile();
  const peekers: Peeker[] = [];

  function desired(): number {
    if (mobile) return CONFIG.mobileCount; // mobile: fixed, not user-adjustable
    return settings.get("peekerOn") ? settings.get("peekerCount") : 0;
  }

  function reconcile(): void {
    const count = desired();
    while (peekers.length < count) peekers.push(makePeeker(mobile));
    while (peekers.length > count) {
      const removed = peekers.pop();
      removed?.observer.disconnect();
      removed?.el.remove();
    }
  }

  reconcile();
  if (!mobile) settings.onChange(["peekerOn", "peekerCount"], reconcile);

  core.add((dt) => {
    const dtMs = dt * 1000;
    for (const p of peekers) {
      step(p, dtMs);
      draw(p);
    }
  });
}
