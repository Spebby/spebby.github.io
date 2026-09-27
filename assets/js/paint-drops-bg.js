(function () {
  "use strict";

  const bgVertSrc = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

  const bgFragSrc = `
precision highp float;

uniform vec2  u_resolution;
uniform vec3  u_bg;
uniform vec3  u_water;
uniform float u_level;
uniform float u_time;
uniform vec3  u_impact[8]; // x, radius, age-since-impact (age < 0 => inactive slot)

const float RADIUS_MAX  = 0.075;
const float WAVE_SPEED  = 0.52;
const float WAVE_DECAY  = 1.3;
const float ACTIVE_TTL  = 2.5;

// gentle, always-present oscillation of the surface. The first three terms
// are a clean wave; the last two have non-harmonic frequency ratios and a
// slow phase drift, which keeps the sum from reading as a clean repeating
// wave. Closer to mild turbulence than a metronome.
float ambient(float x, float t) {
  float w = 0.0070 * sin(x * 8.0  + t * 1.05);
  w += 0.0032 * sin(x * 15.0 - t * 0.82);
  w += 0.0015 * sin(x * 26.0 + t * 0.57);

  // Smaller secondary waves keep the surface from looking like
  // three synchronized sine waves.
  w += 0.0012 * sin(x * 41.0 + t * 2.15 + sin(t * 0.31) * 1.5);
  w += 0.0007 * sin(x * 63.0 - t * 2.8 + sin(x * 3.1 + t * 0.2) * 1.5);

  return w * 2.0;
}

// outward-travelling ring launched at the moment of impact. Damped both by
// how long it's been travelling and by how far it's gone, so it visibly
// dies out instead of looking like it propagates forever.
float impactWave(float x, float impactX, float age, float strength) {
  if (age <= 0.0) return 0.0;
  float dist = abs(x - impactX);
  float radius = age * WAVE_SPEED;
  float front = dist - radius;
  float width = 0.025 + age * 0.012;
  float envelope = exp(-(front * front) / (2.0 * width * width));
  float timeDecay = exp(-age / WAVE_DECAY);
  float spreadDecay = exp(-radius * 1.6);
  return sin(front * 38.0) * envelope * timeDecay * spreadDecay * strength;
}

// brief local depression where the drop actually pushes the surface down,
// with a small raised shoulder around it, both fading fast
float impactDip(float x, float impactX, float age, float radius) {
  if (age <= 0.0) return 0.0;
  float dx = x - impactX;

  float width = radius * 1.2 + age * 0.018;
  float center = exp(-(dx * dx) / (2.0 * width * width));

  float shoulderWidth = radius * 3.0 + age * 0.035;
  float shoulder = exp(-(dx * dx) / (2.0 * shoulderWidth * shoulderWidth));
  shoulder *= 1.0 - center;

  float size = radius / RADIUS_MAX;
  float strength = 0.7 + size * 0.8;
  float decay = exp(-age * 3.2);

  return (shoulder * 0.045 - center * 0.075) * strength * decay;
}


void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float surface = u_level;

  if (u_level >= 0.0) {
    surface += ambient(uv.x, u_time);
  }

  for (int i = 0; i < 8; i++) {
    vec3 imp = u_impact[i];
    float age = imp.z;
    if (age >= 0.0 && age < ACTIVE_TTL) {
      float size = imp.y / RADIUS_MAX;
      surface += impactWave(uv.x, imp.x, age, 0.032 + size * 0.022);
      surface += impactDip(uv.x, imp.x, age, imp.y);
    }
  }

  float mask = smoothstep(surface + 0.0025, surface - 0.0025, uv.y);
  vec3 color = mix(u_bg, u_water, mask);

  gl_FragColor = vec4(color, 1.0);
}
`;

  const circleVertSrc = `
attribute vec2 a_pos;
uniform vec2  u_center;
uniform float u_radius;
uniform vec2  u_stretch; // per-axis multiplier: squash/stretch + mirroring (negative flips)
uniform float u_aspect;
void main() {
  vec2 local = a_pos * u_stretch;
  vec2 world = u_center + vec2(local.x * u_radius / u_aspect, local.y * u_radius);
  vec2 ndc = world * 2.0 - 1.0;
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

  const circleFragSrc = `
precision mediump float;
uniform vec3  u_color;
uniform float u_alpha;
void main() { gl_FragColor = vec4(u_color, u_alpha); }
`;

  const canvas = document.createElement("canvas");
  canvas.id = "paint-drops-bg";
  // The site's global CSS makes every <canvas> position:fixed and
  // pointer-events:none; that only sets its position, not its display
  // size, so it's set explicitly here to fill the viewport regardless
  // of the (possibly downscaled) render-buffer resolution below.
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.display = "block";
  document.body.prepend(canvas);

  const gl =
    canvas.getContext("webgl", { antialias: true }) ||
    canvas.getContext("experimental-webgl", { antialias: true });

  if (!gl) {
    console.error("WebGL not supported; paint-drops background disabled.");
    canvas.remove();
    return;
  }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // ---------------------------------------------------------------------------
  // Shader helpers
  // ---------------------------------------------------------------------------

  function compile(type, src) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
    }

    return shader;
  }

  function link(vertSrc, fragSrc) {
    const program = gl.createProgram();

    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertSrc));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragSrc));

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
    }

    return program;
  }

  // ---------------------------------------------------------------------------
  // Background / fluid program
  // ---------------------------------------------------------------------------

  const bgProgram = link(bgVertSrc, bgFragSrc);

  const bgQuad = new Float32Array([
    -1, -1, 1, -1, -1, 1,

    1, -1, 1, 1, -1, 1,
  ]);

  const bgBuf = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, bgBuf);
  gl.bufferData(gl.ARRAY_BUFFER, bgQuad, gl.STATIC_DRAW);

  const bgPosLoc = gl.getAttribLocation(bgProgram, "a_pos");

  const bgU = {
    resolution: gl.getUniformLocation(bgProgram, "u_resolution"),
    bg: gl.getUniformLocation(bgProgram, "u_bg"),
    water: gl.getUniformLocation(bgProgram, "u_water"),
    level: gl.getUniformLocation(bgProgram, "u_level"),
    time: gl.getUniformLocation(bgProgram, "u_time"),
    impact: gl.getUniformLocation(bgProgram, "u_impact"),
  };

  // ---------------------------------------------------------------------------
  // Circle program
  //
  // Droplets, spray particles and impact bursts are all actual polygon
  // geometry rather than fragment-shader distance fields, so edges are
  // resolved by the GPU's own antialiasing, not a smoothstep width.
  //
  // Two meshes share this one program: a plain circle (spray + bursts) and
  // a teardrop (falling drops + pre-impact reflections) — the vertex shader
  // just needs a_pos, so any convex-ish, star-shaped-from-center polygon
  // works interchangeably. u_stretch lets any shape be squashed, stretched,
  // or mirrored per-axis without a second mesh.
  // ---------------------------------------------------------------------------

  const circleProgram = link(circleVertSrc, circleFragSrc);

  function buildCircleMesh(segments) {
    const verts = [0, 0];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      verts.push(Math.cos(angle), Math.sin(angle));
    }
    return verts;
  }

  // Round belly (bottom half of a unit circle) + a straight-sided tail
  // tapering to a point above, like a falling raindrop. Built as a fan
  // around the belly's center, which stays inside the shape for any
  // reasonable tail height.
  function buildTeardropMesh(segments, tailHeight) {
    const verts = [0, 0]; // fan center
    verts.push(0, tailHeight); // tip
    for (let i = 0; i <= segments; i++) {
      const angle = -(i / segments) * Math.PI; // 0 -> -PI: right, bottom, left
      verts.push(Math.cos(angle), Math.sin(angle));
    }
    verts.push(0, tailHeight); // close back to the tip
    return verts;
  }

  function makeBuffer(verts) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    return { buf, count: verts.length / 2 };
  }

  const circleMesh = makeBuffer(buildCircleMesh(24));
  const teardropMesh = makeBuffer(buildTeardropMesh(20, 1.45));

  const circlePosLoc = gl.getAttribLocation(circleProgram, "a_pos");

  const circU = {
    center: gl.getUniformLocation(circleProgram, "u_center"),
    radius: gl.getUniformLocation(circleProgram, "u_radius"),
    stretch: gl.getUniformLocation(circleProgram, "u_stretch"),
    aspect: gl.getUniformLocation(circleProgram, "u_aspect"),
    color: gl.getUniformLocation(circleProgram, "u_color"),
    alpha: gl.getUniformLocation(circleProgram, "u_alpha"),
  };

  let boundMesh = null;
  function useMesh(mesh) {
    if (boundMesh === mesh) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
    gl.vertexAttribPointer(circlePosLoc, 2, gl.FLOAT, false, 0, 0);
    boundMesh = mesh;
  }

  function drawShape(mesh, x, y, r, color, alpha, aspect, stretchX, stretchY) {
    useMesh(mesh);
    gl.uniform2f(circU.center, x, y);
    gl.uniform1f(circU.radius, r);
    gl.uniform2f(
      circU.stretch,
      stretchX === undefined ? 1.0 : stretchX,
      stretchY === undefined ? 1.0 : stretchY,
    );
    gl.uniform1f(circU.aspect, aspect);
    gl.uniform3f(circU.color, color[0], color[1], color[2]);
    gl.uniform1f(circU.alpha, alpha);

    gl.drawArrays(gl.TRIANGLE_FAN, 0, mesh.count);
  }

  // ===========================================================================
  // Simulation
  // ===========================================================================

  // Once the water gets above this point, the current cycle is complete.
  //
  // 1.0 is the top of the visible canvas.
  // 1.1 gives the final wave/drop enough room to push the water completely
  // beyond the screen before we switch colors.
  const COMPLETE_LEVEL = 1.05;
  const START_LEVEL = -0.01;

  const GRAVITY = 2.4;

  const RADIUS_MIN = 0.022;
  const RADIUS_MAX = 0.075;

  const FILL_UNIT = 0.14;

  const ACTIVE_WINDOW = 2.5;
  const MAX_ACTIVE = 8; // shader ripple-array size only — not a cap on activeImpacts

  const BLACK = [0.03, 0.03, 0.03];
  const WHITE = [0.97, 0.97, 0.97];

  // How close a falling drop needs to be to the surface (in level units)
  // before it starts showing a faint pre-impact reflection.
  const REFLECT_THRESHOLD = 0.14;

  // ---------------------------------------------------------------------------
  // Cycle state
  //
  // There is deliberately NO cycle timer.
  //
  // cycleIndex only changes when the water actually reaches COMPLETE_LEVEL.
  // ---------------------------------------------------------------------------

  let cycleIndex = 0;

  let settledLevel = START_LEVEL;
  let activeImpacts = [];

  // No floor on level any more — it starts at true zero so a new cycle never
  // pops in with an already-visible strip of water. It fills in naturally
  // (and smoothly, via riseEase) the moment the first drop lands.
  let level = START_LEVEL;

  let drops = [];
  let sprays = [];
  let bursts = [];

  let nextSpawnAt = -1;

  // Set after the water crosses COMPLETE_LEVEL.
  //
  // We don't immediately reset the simulation in the same update. This lets
  // the completed frame actually render with the water beyond the top.
  let cycleComplete = false;

  // ---------------------------------------------------------------------------
  // Random helpers
  // ---------------------------------------------------------------------------

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  // Irregular spawn pacing: mostly a normal-ish gap, occasionally a quick
  // follow-up (drops arriving almost together), occasionally a longer lull.
  // Keeps the rhythm from reading as a metronome.
  function scheduleNextSpawn(t) {
    const roll = Math.random();
    let gap;

    if (roll < 0.14) {
      gap = rand(0.05, 0.3); // quick follow-up / small cluster
    } else if (roll < 0.26) {
      gap = rand(2.2, 3.8); // occasional lull
    } else {
      gap = rand(0.7, 1.7); // typical pacing
    }

    nextSpawnAt = t + gap;
  }

  // ---------------------------------------------------------------------------
  // Surface functions
  //
  // These mirror the functions used by the background shader so that falling
  // droplets collide with the visible surface rather than an approximation.
  // ---------------------------------------------------------------------------

  function ambientAt(x, t) {
    let w = 0.007 * Math.sin(x * 8.0 + t * 1.05);
    w += 0.0032 * Math.sin(x * 15.0 - t * 0.82);
    w += 0.0015 * Math.sin(x * 26.0 + t * 0.57);

    w += 0.0012 * Math.sin(x * 41.0 + t * 2.15 + Math.sin(t * 0.31) * 1.5);

    w +=
      0.0007 * Math.sin(x * 63.0 - t * 2.8 + Math.sin(x * 3.1 + t * 0.2) * 1.5);

    return w * 2;
  }

  function surfaceAt(x, t) {
    return level + (level >= 0.0 ? ambientAt(x, t) : 0.0);
  }

  // ---------------------------------------------------------------------------
  // Fluid rise
  //
  // Each impact eases into the water instead of causing a hard step.
  // ---------------------------------------------------------------------------

  function riseEase(age) {
    if (age <= 0) return 0;

    const x = age * 3.0;
    return 1.0 - Math.exp(-x) * (1.0 + x);
  }

  function dropAmount(r) {
    const ratio = Math.min(
      1,
      Math.max(0, (r - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN)),
    );
    return FILL_UNIT * (0.3 + ratio * ratio * 0.7);
  }

  // ---------------------------------------------------------------------------
  // Current colors
  //
  // Every cycle alternates which color is the water and which is the
  // background. The swap is driven exclusively by cycleIndex.
  // ---------------------------------------------------------------------------

  function colors() {
    const even = cycleIndex % 2 === 0;
    return {
      bg: even ? BLACK : WHITE,
      water: even ? WHITE : BLACK,
    };
  }

  // ---------------------------------------------------------------------------
  // Start a new cycle
  // ---------------------------------------------------------------------------

  function beginCycle(t) {
    settledLevel = START_LEVEL;
    activeImpacts.length = 0;

    drops.length = 0;
    sprays.length = 0;
    bursts.length = 0;

    level = START_LEVEL;
    cycleComplete = false;

    // Don't immediately drop something on the surface. Give the new cycle
    // a short breathing period before the first droplet appears.
    nextSpawnAt = t + rand(0.3, 0.8);
  }

  // ---------------------------------------------------------------------------
  // Spawn a falling droplet
  //
  // There is no predetermined number of drops per cycle. We keep spawning
  // until the accumulated fluid actually reaches COMPLETE_LEVEL.
  // ---------------------------------------------------------------------------

  function spawnDrop(t) {
    // Skewed toward smaller drops with occasional larger ones, instead of
    // a flat range — reads as more natural/random than uniform.
    const r =
      RADIUS_MIN + Math.pow(Math.random(), 1.6) * (RADIUS_MAX - RADIUS_MIN);

    drops.push({
      x: rand(0.08, 0.92),
      y: 1.1,
      r,
      vy: 0,
      gravityScale: rand(0.85, 1.2),
    });

    scheduleNextSpawn(t);
  }

  // ---------------------------------------------------------------------------
  // Splash particles
  //
  // r controls both the particle count/speed and the size of the ring burst.
  // ---------------------------------------------------------------------------

  function spawnSplash(t, x, y, r) {
    const sizeRatio = Math.max(
      0,
      Math.min(1, (r - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN)),
    );

    const n = Math.round(rand(5, 9) + sizeRatio * 5);

    for (let i = 0; i < n; i++) {
      const angle = rand(0.25, Math.PI - 0.25);
      const speed = rand(0.5, 0.95) * (0.6 + r * 6.0);

      sprays.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: rand(0.005, 0.012),
        born: t,
      });
    }

    bursts.push({
      x,
      y,
      r0: r * 1.1,
      r1: r * 4.4,
      born: t,
      life: 0.32,
    });
  }

  // Update
  function update(t, dt) {
    // Begin the first cycle.
    if (cycleIndex === 0 && nextSpawnAt < 0) {
      beginCycle(t);
    }

    // If the previous frame completed the cycle, switch colors NOW.
    // This intentionally happens one update after reaching COMPLETE_LEVEL.
    // The previous frame therefore gets rendered normally with level > 1.0,
    // allowing the water to completely cover the screen instead of abruptly
    // cutting to the next background.
    if (cycleComplete) {
      cycleIndex++;
      beginCycle(t);
    }

    // Calculate the current baseline water level.
    // settledLevel contains impacts whose transition has finished.
    // activeImpacts contains recent impacts that are still rising.
    let lvl = settledLevel;

    for (const imp of activeImpacts) {
      lvl += imp.amount * riseEase(t - imp.born);
    }

    level = lvl;

    // Move old active impacts into the settled total.
    // This keeps activeImpacts bounded so the CPU simulation doesn't grow
    // indefinitely as the cycle progresses.
    for (let i = activeImpacts.length - 1; i >= 0; i--) {
      if (t - activeImpacts[i].born > ACTIVE_WINDOW) {
        settledLevel += activeImpacts[i].amount;
        activeImpacts.splice(i, 1);
      }
    }

    // Spawn new droplets while the screen isn't (almost) full.
    // Spawning stops once level crosses 1.0 — no point starting a new drop
    // once the water has visually reached the top. Drops already in flight
    // still land and contribute normally, carrying the level on up to
    // COMPLETE_LEVEL and letting the cycle wind down instead of cutting off.
    if (!cycleComplete && level < COMPLETE_LEVEL && t >= nextSpawnAt) {
      spawnDrop(t);

      // Occasional double drop — two falling at once from different x — for
      // rhythm variation. Just one more branch on top of the existing
      // irregular pacing.
      if (Math.random() < 0.12) {
        spawnDrop(t);
      }
    }

    // Falling droplets
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];

      d.vy -= GRAVITY * d.gravityScale * dt;
      d.y += d.vy * dt;

      // Collision uses the same base surface position as the shader.
      const surf = surfaceAt(d.x, t);

      if (d.y <= surf + d.r * 0.3) {
        const amount = dropAmount(d.r);

        activeImpacts.push({
          x: d.x,
          radius: d.r,
          amount,
          born: t,
        });

        // Note: no count-based eviction here on purpose. Folding an impact
        // into settledLevel early (before its riseEase has actually reached
        // ~1) used to cause a sudden jump in the water line the moment a
        // 9th concurrent impact showed up — visible as a pop that depended
        // on drop ordering. Impacts only settle once they've actually aged
        // out below (ACTIVE_WINDOW), by which point riseEase is ~0.995+, so
        // folding them in is imperceptible. This list is JS-side bookkeeping
        // (cheap regardless of length); only the shader's ripple array is
        // bounded to 8, and that's just a rendering cutoff, not a level one.

        spawnSplash(t, d.x, surf, d.r);

        drops.splice(i, 1);
      }
    }

    // -------------------------------------------------------------------------
    // Spray particles
    // -------------------------------------------------------------------------

    for (let i = sprays.length - 1; i >= 0; i--) {
      const s = sprays[i];
      s.vy -= GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      const age = t - s.born;

      if (age > 0.75 || s.y < level - 0.03) {
        sprays.splice(i, 1);
      }
    }

    // -------------------------------------------------------------------------
    // Expanding impact bursts
    // -------------------------------------------------------------------------

    for (let i = bursts.length - 1; i >= 0; i--) {
      if (t - bursts[i].born > bursts[i].life) {
        bursts.splice(i, 1);
      }
    }

    // Cycle completion
    //
    // This is the only thing that advances cycleIndex.
    //
    // We use COMPLETE_LEVEL = 1.10 rather than 1.0 so that the final paint
    // contribution is allowed to push the surface well beyond the top edge.

    if (!cycleComplete && level >= COMPLETE_LEVEL) {
      cycleComplete = true;
    }
  }

  // Rendering
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;

      gl.viewport(0, 0, w, h);
    }
  }

  window.addEventListener("resize", resize);
  resize();

  const start = performance.now();

  let lastT = 0;
  let rafId = null;

  function frame(now) {
    resize();

    const t = (now - start) / 1000;
    const dt = Math.min(0.05, t - lastT);

    lastT = t;

    update(t, dt);

    const aspect = canvas.width / canvas.height;
    const { bg, water } = colors();

    // Pass 1: fluid surface
    gl.useProgram(bgProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, bgBuf);
    gl.enableVertexAttribArray(bgPosLoc);
    gl.vertexAttribPointer(bgPosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(bgU.resolution, canvas.width, canvas.height);
    gl.uniform3f(bgU.bg, bg[0], bg[1], bg[2]);
    gl.uniform3f(bgU.water, water[0], water[1], water[2]);
    gl.uniform1f(bgU.level, level);
    gl.uniform1f(bgU.time, t);

    // Pack the currently active impact waves into the shader's fixed 8 slots.
    // This is purely a rendering cutoff — activeImpacts itself is never
    // truncated for level accounting, only the most recent 8 get a visible
    // ripple. Older ones (rare — needs 9+ impacts within ACTIVE_WINDOW) are
    // already fading anyway by the time they'd be dropped here.
    const impactData = new Float32Array(24).fill(0);
    for (let i = 0; i < 8; i++) {
      impactData[i * 3 + 2] = -1;
    }

    const recentImpacts =
      activeImpacts.length > 8 ? activeImpacts.slice(-8) : activeImpacts;
    for (let i = 0; i < recentImpacts.length; i++) {
      const imp = recentImpacts[i];
      impactData[i * 3 + 0] = imp.x;
      impactData[i * 3 + 1] = imp.radius;
      impactData[i * 3 + 2] = t - imp.born;
    }

    gl.uniform3fv(bgU.impact, impactData);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Pass 2: droplets, spray, impact bursts, and pre-impact reflections
    gl.useProgram(circleProgram);
    boundMesh = null; // program switched buffers; force a rebind on first draw

    // Pre-impact reflections — a faint, squashed, upside-down copy of each
    // falling drop, mirrored just below the surface, fading in over the
    // last stretch of the fall. Reads as "there's a surface here" before
    // the splash actually happens.
    if (level > 0.0) {
      for (const d of drops) {
        const surf = surfaceAt(d.x, t);
        const offset = d.y - surf;

        if (offset > 0 && offset < REFLECT_THRESHOLD) {
          const alpha = (1.0 - offset / REFLECT_THRESHOLD) * 0.22;
          const reflY = surf - offset * 0.5;
          const reflColor = [
            water[0] * 0.8 + bg[0] * 0.2,
            water[1] * 0.8 + bg[1] * 0.2,
            water[2] * 0.8 + bg[2] * 0.2,
          ];

          drawShape(
            teardropMesh,
            d.x,
            reflY,
            d.r,
            reflColor,
            alpha,
            aspect,
            1.3,
            -0.55,
          );
        }
      }
    }

    // Falling droplets — teardrop mesh, elongated along its fall direction
    // as speed increases (squash/stretch), tapered slightly on the
    // perpendicular axis to read as momentum rather than a stretched blob.
    for (const d of drops) {
      const speed = Math.abs(d.vy);
      const stretchY = Math.min(1.6, 1 + speed * 0.15);
      const stretchX = 1 / Math.sqrt(stretchY);
      drawShape(
        teardropMesh,
        d.x,
        d.y,
        d.r,
        water,
        1.0,
        aspect,
        stretchX,
        stretchY,
      );
    }

    // Spray droplets — plain circles.
    for (const s of sprays) {
      const age = t - s.born;
      drawShape(
        circleMesh,
        s.x,
        s.y,
        s.r,
        water,
        Math.max(0, 1.0 - age / 0.75),
        aspect,
      );
    }

    // Expanding impact bursts — plain circles, but squashed into a wide
    // flat ellipse at the moment of impact and easing toward a circular
    // ring as they expand and decay, instead of a uniform radial scale.
    for (const b of bursts) {
      const f = (t - b.born) / b.life;
      const r = b.r0 + (b.r1 - b.r0) * f;
      const stretchX = 1.5 - f * 0.5;
      const stretchY = 0.5 + f * 0.5;

      drawShape(
        circleMesh,
        b.x,
        b.y,
        r,
        water,
        (1.0 - f) * 0.55,
        aspect,
        stretchX,
        stretchY,
      );
    }

    rafId = requestAnimationFrame(frame);
  }

  // Reduced motion: render a single static frame instead of looping.
  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function drawStaticFrame() {
    resize();

    const aspect = canvas.width / canvas.height;
    const bg = BLACK;
    const water = WHITE;

    gl.useProgram(bgProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, bgBuf);
    gl.enableVertexAttribArray(bgPosLoc);
    gl.vertexAttribPointer(bgPosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(bgU.resolution, canvas.width, canvas.height);
    gl.uniform3f(bgU.bg, bg[0], bg[1], bg[2]);
    gl.uniform3f(bgU.water, water[0], water[1], water[2]);
    gl.uniform1f(bgU.level, 0.45);
    gl.uniform1f(bgU.time, 0.0);

    const impactData = new Float32Array(24).fill(0);
    for (let i = 0; i < 8; i++) impactData[i * 3 + 2] = -1;
    gl.uniform3fv(bgU.impact, impactData);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  if (reduceMotion) {
    drawStaticFrame();
    window.addEventListener("resize", drawStaticFrame);
  } else {
    // -------------------------------------------------------------------------
    // Pause the animation loop when the tab isn't visible — free CPU/battery
    // savings, no reason a screensaver should burn cycles in the background.
    // -------------------------------------------------------------------------

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else if (rafId === null) {
        rafId = requestAnimationFrame(frame);
      }
    });

    rafId = requestAnimationFrame(frame);
  }
})();
