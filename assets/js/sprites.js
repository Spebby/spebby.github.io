// sprites.js — flipbook critters walking along the bottom of the panel.
// Requires core.js, settings.js, and a .sprite-layer. Art is assumed to face RIGHT.
(function () {
  const CONFIG = {
    sheet: window.location.origin + "/assets/img/critter.png",
    frameW: 32,
    frameH: 32,
    walkFrames: 6,
    walkRow: 0,
    walkFps: 8,
    idleFrames: 4,
    idleRow: 1,
    idleFps: 4,
    speed: 40,
    scale: 2,
    bottomInset: 0,
    walkBeforeIdle: [2, 7], // seconds of on-screen walking between idles
    idleDurationRange: [1000, 3000], // ms
    turnChance: 0.5,
    respawnDelayRange: [4000, 12000], // ms
  };

  const S = window.TUISettings;
  const SPRITE_W = CONFIG.frameW * CONFIG.scale;
  const SPRITE_H = CONFIG.frameH * CONFIG.scale;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  const layer = document.querySelector(".sprite-layer");
  const mobile = window.matchMedia("(max-width: 720px)").matches;
  if (!layer || !S || !window.TUICore || TUICore.reduceMotion || mobile) return; // no critter on mobile

  const size = { w: layer.clientWidth, h: layer.clientHeight };
  new ResizeObserver(() => {
    size.w = layer.clientWidth;
    size.h = layer.clientHeight;
  }).observe(layer);

  function makeSprite() {
    const el = document.createElement("div");
    el.className = "sprite";
    el.style.width = CONFIG.frameW + "px";
    el.style.height = CONFIG.frameH + "px";
    el.style.backgroundImage = `url(${CONFIG.sheet})`;
    el.style.visibility = "hidden";
    layer.appendChild(el);
    return {
      el,
      dir: 1,
      x: 0,
      mode: "gone",
      frame: 0,
      frameT: 0,
      untilIdle: 0,
      idleLeft: 0,
      respawnLeft: rand(0.3, 2),
    };
  }

  function setMode(s, mode) {
    s.mode = mode;
    s.frame = 0;
    s.frameT = 0;
  }

  function launch(s) {
    s.dir = Math.random() < 0.5 ? 1 : -1;
    s.x = s.dir === 1 ? -SPRITE_W : size.w;
    s.untilIdle = rand(...CONFIG.walkBeforeIdle);
    setMode(s, "walk");
    draw(s, 0);
    s.el.style.visibility = "visible";
  }

  function despawn(s) {
    s.el.style.visibility = "hidden";
    s.mode = "gone";
    s.respawnLeft = rand(...CONFIG.respawnDelayRange) / 1000;
  }

  function draw(s, dt) {
    const walking = s.mode === "walk";
    const fps = walking ? CONFIG.walkFps : CONFIG.idleFps;
    const count = walking ? CONFIG.walkFrames : CONFIG.idleFrames;
    const row = walking ? CONFIG.walkRow : CONFIG.idleRow;

    s.frameT += dt;
    if (s.frameT >= 1 / fps) {
      s.frameT = 0;
      s.frame = (s.frame + 1) % count;
    }
    s.el.style.backgroundPosition = `-${s.frame * CONFIG.frameW}px -${row * CONFIG.frameH}px`;

    const flip = s.dir < 0; // origin is top-left, so a mirrored sprite extends left: shift right to compensate
    const x = s.x + (flip ? SPRITE_W : 0);
    const y = size.h - SPRITE_H - CONFIG.bottomInset;
    s.el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${flip ? -CONFIG.scale : CONFIG.scale}, ${CONFIG.scale})`;
  }

  const sprites = [];
  function desired() {
    return S.get("critterOn") ? S.get("critterCount") : 0;
  }
  function reconcile() {
    const n = desired();
    while (sprites.length < n) sprites.push(makeSprite());
    while (sprites.length > n) sprites.pop().el.remove();
  }
  reconcile();
  S.onChange(["critterOn", "critterCount"], reconcile);

  TUICore.add(function update(dt) {
    for (const s of sprites) {
      if (s.mode === "gone") {
        s.respawnLeft -= dt;
        if (s.respawnLeft <= 0) launch(s);
        continue;
      }

      if (s.mode === "walk") {
        s.x += s.dir * CONFIG.speed * dt;

        if (
          (s.dir === 1 && s.x > size.w) ||
          (s.dir === -1 && s.x < -SPRITE_W)
        ) {
          despawn(s);
          continue;
        }

        const onScreen = s.x >= 0 && s.x + SPRITE_W <= size.w;
        if (onScreen) s.untilIdle -= dt;
        if (onScreen && s.untilIdle <= 0) {
          s.idleLeft = rand(...CONFIG.idleDurationRange) / 1000;
          setMode(s, "idle");
        }
      } else {
        s.idleLeft -= dt;
        if (s.idleLeft <= 0) {
          if (Math.random() < CONFIG.turnChance) s.dir *= -1;
          s.untilIdle = rand(...CONFIG.walkBeforeIdle);
          setMode(s, "walk");
        }
      }
      draw(s, dt);
    }
  });
})();
