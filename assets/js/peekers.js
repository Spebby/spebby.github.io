// peekers.js — ASCII critters popping from panel edges.
// Requires core.js (TUICore) + .sprite-layer.
(function () {
  const CONFIG = {
    art: String.raw`    |\__/,|   (\
  _.|o o  |_   ) )
-(((---(((--------`,

    scale: 1,
    // Fraction of the sprite's size PERPENDICULAR to its edge that pokes in.
    revealFrac: 1.0,
    riseMs: 220,
    holdMs: [700, 2600],
    sinkMs: 380,
    waitMs: [2500, 7000],
    spawnDelayMs: [1200, 33500],
    desktopCount: 3,
    mobileCount: 2,
  };

  const DESKTOP_EDGES = ["top", "bottom", "left", "right"];
  const MOBILE_EDGES = ["left", "right"];
  const SIDE = { left: true, right: true };
  const ROTATION = { top: 180, bottom: 0, left: 90, right: -90 };

  function isMobile() {
    return window.matchMedia("(max-width: 720px)").matches;
  }
  function rand(min, max) {
    return min + Math.random() * (max - min);
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  function easeInQuad(t) {
    return t * t;
  }

  const layer = document.querySelector(".sprite-layer");
  if (!layer || !window.TUICore || TUICore.reduceMotion) return;

  const size = { w: 0, h: 0 };
  function updateSize() {
    size.w = layer.clientWidth;
    size.h = layer.clientHeight;
  }
  new ResizeObserver(updateSize).observe(layer);
  updateSize();

  function visibleYRange() {
    const rect = layer.getBoundingClientRect();
    const top = Math.max(0, -rect.top);
    const bottom = Math.min(size.h, window.innerHeight - rect.top);
    return bottom > top ? [top, bottom] : [0, size.h];
  }

  // On-screen footprint for a given edge. Rotating 90° swaps width and height.
  function footprint(p, edge) {
    const w = p.w * CONFIG.scale;
    const h = p.h * CONFIG.scale;
    return SIDE[edge] ? { w: h, h: w } : { w, h };
  }

  function pickSpot(p) {
    const edge = pick(p.mobile ? MOBILE_EDGES : DESKTOP_EDGES);
    let at = rand(0, 1);

    if (p.mobile && SIDE[edge]) {
      const f = footprint(p, edge);
      const [yMin, yMax] = visibleYRange();
      const lo = yMin + f.h / 2;
      const hi = Math.max(lo, yMax - f.h / 2); // whole sprite stays in view
      at = size.h > 0 ? rand(lo, hi) / size.h : 0.5;
    }
    return { edge, at };
  }

  function makePeeker(mobile) {
    const el = document.createElement("pre");
    el.className = "peeker";
    el.textContent = CONFIG.art;
    el.setAttribute("aria-hidden", "true");

    // Pin the layout box to (0,0) so translate() is the ONLY thing that
    // positions it, independent of the layer's own layout.
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
    layer.appendChild(el);

    const p = {
      el,
      mobile,
      w: 0,
      h: 0,
      shown: false,
      spot: null,
      phase: "wait",
      phaseT: 0,
      waitFor:
        rand(...CONFIG.waitMs) +
        rand(0, 1500) +
        rand(0, CONFIG.spawnDelayMs[1]),
      holdFor: 0,
    };

    // offsetWidth/Height are layout sizes: unaffected by transforms, and no
    // per-frame measuring. The observer re-measures on font load / CSS changes.
    const measure = () => {
      p.w = el.offsetWidth;
      p.h = el.offsetHeight;
    };
    measure();
    new ResizeObserver(measure).observe(el);

    p.spot = pickSpot(p);
    return p;
  }

  // Returns the translate that centers the sprite on the target point.
  // reveal 0 = fully outside its edge, 1 = revealFrac of it inside.
  function place(p, reveal) {
    const { edge, at } = p.spot;
    const f = footprint(p, edge);
    const perp = SIDE[edge] ? f.w : f.h;
    const depth = perp * CONFIG.revealFrac * reveal;

    let cx, cy;
    switch (edge) {
      case "top":
        cx = clamp(at * size.w, f.w / 2, size.w - f.w / 2);
        cy = -f.h / 2 + depth;
        break;
      case "bottom":
        cx = clamp(at * size.w, f.w / 2, size.w - f.w / 2);
        cy = size.h + f.h / 2 - depth;
        break;
      case "left":
        cx = -f.w / 2 + depth;
        cy = clamp(at * size.h, f.h / 2, size.h - f.h / 2);
        break;
      case "right":
        cx = size.w + f.w / 2 - depth;
        cy = clamp(at * size.h, f.h / 2, size.h - f.h / 2);
        break;
    }
    // Translate uses the LAYOUT box (rotation/scale happen around its center).
    return { x: cx - p.w / 2, y: cy - p.h / 2 };
  }

  function draw(p) {
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

    let reveal;
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

  function step(p, dtMs) {
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

  function init() {
    const S = window.TUISettings;
    const mobile = isMobile();
    const peekers = [];

    function desired() {
      if (mobile) return CONFIG.mobileCount; // mobile: fixed, not user-adjustable
      return S.get("peekerOn") ? S.get("peekerCount") : 0;
    }
    function reconcile() {
      const n = desired();
      while (peekers.length < n) peekers.push(makePeeker(mobile));
      while (peekers.length > n) peekers.pop().el.remove();
    }
    reconcile();
    if (!mobile) S.onChange(["peekerOn", "peekerCount"], reconcile);

    TUICore.add(function update(dt) {
      const dtMs = dt * 1000;
      peekers.forEach((p) => {
        step(p, dtMs);
        draw(p);
      });
    });
  }

  init();
})();
