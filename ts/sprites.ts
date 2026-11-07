/**
 * Flipbook critters walking along the bottom of the panel. Art is assumed to face RIGHT.
 *
 * Not currently started: main.ts does not call startSprites(), and the critter controls are
 * not listed on the settings page. To bring it back, put the sprite sheet at
 * static/img/critter.png, call startSprites() from main.ts, and add the critterOn /
 * critterCount controls to the SCHEMA in settings.ts.
 */

import { core } from "./core";
import { settings } from "./settings";
import { isMobile, rand } from "./util";

type Range = readonly [number, number];

const CONFIG = {
  sheet: "/img/critter.png",
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
  walkBeforeIdle: [2, 7] as Range, // seconds of on-screen walking between idles
  idleDurationRange: [1000, 3000] as Range, // ms
  turnChance: 0.5,
  respawnDelayRange: [4000, 12000] as Range, // ms
} as const;

const SPRITE_W = CONFIG.frameW * CONFIG.scale;
const SPRITE_H = CONFIG.frameH * CONFIG.scale;

type Mode = "gone" | "walk" | "idle";

interface Sprite {
  readonly el: HTMLDivElement;
  dir: 1 | -1;
  x: number;
  mode: Mode;
  frame: number;
  frameT: number;
  untilIdle: number;
  idleLeft: number;
  respawnLeft: number;
}

export function startSprites(): void {
  const layer = document.querySelector<HTMLElement>(".sprite-layer");
  if (!layer || core.reduceMotion || isMobile()) return; // no critter on mobile
  const spriteLayer = layer;

  const size = { w: spriteLayer.clientWidth, h: spriteLayer.clientHeight };
  new ResizeObserver(() => {
    size.w = spriteLayer.clientWidth;
    size.h = spriteLayer.clientHeight;
  }).observe(spriteLayer);

  function makeSprite(): Sprite {
    const el = document.createElement("div");
    el.className = "sprite";
    el.style.width = `${CONFIG.frameW}px`;
    el.style.height = `${CONFIG.frameH}px`;
    el.style.backgroundImage = `url(${CONFIG.sheet})`;
    el.style.visibility = "hidden";
    spriteLayer.appendChild(el);
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

  function setMode(s: Sprite, mode: Mode): void {
    s.mode = mode;
    s.frame = 0;
    s.frameT = 0;
  }

  function draw(s: Sprite, dt: number): void {
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

    // The origin is top-left, so a mirrored sprite extends left: shift right to compensate.
    const flip = s.dir < 0;
    const x = s.x + (flip ? SPRITE_W : 0);
    const y = size.h - SPRITE_H - CONFIG.bottomInset;
    s.el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${flip ? -CONFIG.scale : CONFIG.scale}, ${CONFIG.scale})`;
  }

  function launch(s: Sprite): void {
    s.dir = Math.random() < 0.5 ? 1 : -1;
    s.x = s.dir === 1 ? -SPRITE_W : size.w;
    s.untilIdle = rand(...CONFIG.walkBeforeIdle);
    setMode(s, "walk");
    draw(s, 0);
    s.el.style.visibility = "visible";
  }

  function despawn(s: Sprite): void {
    s.el.style.visibility = "hidden";
    s.mode = "gone";
    s.respawnLeft = rand(...CONFIG.respawnDelayRange) / 1000;
  }

  const sprites: Sprite[] = [];

  function desired(): number {
    return settings.get("critterOn") ? settings.get("critterCount") : 0;
  }

  function reconcile(): void {
    const count = desired();
    while (sprites.length < count) sprites.push(makeSprite());
    while (sprites.length > count) sprites.pop()?.el.remove();
  }

  reconcile();
  settings.onChange(["critterOn", "critterCount"], reconcile);

  core.add((dt) => {
    for (const s of sprites) {
      if (s.mode === "gone") {
        s.respawnLeft -= dt;
        if (s.respawnLeft <= 0) launch(s);
        continue;
      }

      if (s.mode === "walk") {
        s.x += s.dir * CONFIG.speed * dt;

        if ((s.dir === 1 && s.x > size.w) || (s.dir === -1 && s.x < -SPRITE_W)) {
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
          if (Math.random() < CONFIG.turnChance) s.dir = s.dir === 1 ? -1 : 1;
          s.untilIdle = rand(...CONFIG.walkBeforeIdle);
          setMode(s, "walk");
        }
      }
      draw(s, dt);
    }
  });
}
