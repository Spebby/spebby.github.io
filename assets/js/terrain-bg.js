// NOTE TO SELF: removed the mouse interaction in this version but could add it back easily
(function () {
  "use strict";

  /*
   * =====================================
   * CONFIG
   * =====================================
   */

  const GRID = 96;
  const QUALITY = 0.85;
  const MAX_DPR = 1.5;
  const YAW = 0.78539816339;
  const PITCH = 0.64;
  const MESH_HALF_RANGE = 6.0; // `p = a_pos * 8.0` in the vertex shader
  const DIAMOND_WX = 2 * MESH_HALF_RANGE * Math.cos(YAW); // max |view.x|
  const DIAMOND_HY = 2 * MESH_HALF_RANGE * Math.cos(YAW) * Math.sin(PITCH); // max |view.y|
  const BASE_ZOOM = 0.4;

  /*
   * ============================================================
   * FALLBACK / CANVAS
   * ============================================================
   */

  const body = document.body;

  // The CSS fallback should be enabled by default:
  // <body class="shader-fallback">
  // If the terrain initializes successfully, we remove it below.
  const canvas = document.createElement("canvas");
  canvas.id = "terrain-bg";

  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    display: "block",
    pointerEvents: "none",
    zIndex: "0",
  });

  /*
   * Put the terrain behind the site's content.
   * Explicitly establish a stacking context instead of relying
   * on z-index:-1, which can put the canvas behind the root/background.
   */
  body.prepend(canvas);

  function fail(reason, error) {
    console.error("[terrain-bg] " + reason, error || "");
    canvas.remove();
    // Leave the fallback enabled.
  }

  /*
   * ============================================================
   * WEBGL
   * ============================================================
   */

  let gl;
  try {
    gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: true,
      powerPreference: "high-performance",
    });
  } catch (error) {
    fail("Unable to create WebGL context.", error);
    return;
  }

  if (!gl) {
    fail("WebGL is not supported.");
    return;
  }

  /*
   * ============================================================
   * RESIZE
   * ============================================================
   */

  let currentZoom = BASE_ZOOM;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const canvasWidth = Math.max(
      1,
      Math.floor(window.innerWidth * dpr * QUALITY),
    );
    const canvasHeight = Math.max(
      1,
      Math.floor(window.innerHeight * dpr * QUALITY),
    );

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      gl.viewport(0, 0, canvasWidth, canvasHeight);
    }

    const aspect = window.innerWidth / window.innerHeight;
    const coverZoom = aspect / DIAMOND_WX + 1 / DIAMOND_HY; // true corner-coverage condition
    currentZoom = Math.max(BASE_ZOOM, coverZoom);
  }

  window.addEventListener("resize", resize, { passive: true });
  resize();

  /*
   * ============================================================
   * VERTEX SHADER
   * ============================================================
   */

  const vertSrc = `
attribute vec2 a_pos;
uniform float uVertexTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform float uZoom;

varying vec2 vTerrainUV;
varying float vHeight;
varying vec3 vNormal;


float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}


// Base terrain
float terrain(vec2 p, float t) {
    float h = 0.0;
    h += sin(p.x * 0.92 + t * 0.115) * 0.72;
    h += cos(p.y * 0.80 - t * 0.085) * 0.58;
    h += sin((p.x + p.y) * 0.63 + t * 0.052) * 0.42;
    h += cos((p.x - p.y) * 0.48 - t * 0.041) * 0.32;
    h += sin(p.x * 1.65 - p.y * 0.55 + t * 0.07) * 0.16;
    h += cos(p.y * 1.55 + p.x * 0.35 - t * 0.055) * 0.13;
    h += (noise(p * 0.55 + t * 0.012) - 0.5) * 0.28;

    vec2 center = vec2(sin(t * 0.075) * 2.5, cos(t * 0.060) * 2.5);
    float d = length(p - center);
    h -= exp(-d * d * 0.085) * 0.95;

    float ridge = sin(p.x * 0.55 + p.y * 0.85 + t * 0.035);
    h += smoothstep(0.35, 0.95, ridge) * 0.22;

    return h;
}


vec2 projectTerrain(vec2 p, float height) {
    const float yaw = 0.78539816339;

    float cy = cos(yaw);
    float sy = sin(yaw);

    vec3 world = vec3(p.x * cy - p.y * sy, height, p.x * sy + p.y * cy);
    const float pitch = 0.64;

    float cp = cos(pitch);
    float sp = sin(pitch);

    vec3 view = vec3(
        world.x,
        world.y * cp - world.z * sp,
        world.y * sp + world.z * cp
    );

    float aspect = uResolution.x / uResolution.y;
    view.x /= aspect;

    const float zoom = 0.40;
    return view.xy * zoom;
}


float terrainHeight(vec2 p, float t) {
    float height = terrain(p, t) * 0.36;

    if (uMouseActive > 0.001) {
        vec2 projected = projectTerrain(p, height);
        float d = length(projected - uMouse);

        float hover = exp(-d * d * 20.0);
        hover *= smoothstep(1.0, 0.0, d * 1.15);

        height += hover * 0.15;
    }
    return height;
}


void main() {
    float t = uVertexTime;

    vec2 terrainUV = a_pos;
    vec2 p = terrainUV * 8.0;

    float height = terrainHeight(p, t);


	// surface normal
    float e = 0.055;

    float hx = terrainHeight(p + vec2(e, 0.0), t);
    float hz = terrainHeight(p + vec2(0.0, e), t);

    vec3 dx = vec3(e, hx - height, 0.0);
    vec3 dz = vec3(0.0, hz - height, e);
    vec3 normal = normalize(cross(dz, dx));

	// Isometric camera
    const float yaw = 0.78539816339;

    float cy = cos(yaw);
    float sy = sin(yaw);

    vec3 world = vec3(
        p.x * cy - p.y * sy,
        height,
        p.x * sy + p.y * cy
    );

    const float pitch = 0.64;

    float cp = cos(pitch);
    float sp = sin(pitch);

    vec3 view = vec3(
        world.x,
        world.y * cp - world.z * sp,
        world.y * sp + world.z * cp
    );

    float aspect = uResolution.x / uResolution.y;
    view.x /= aspect;

    const float zoom = 0.40;
    gl_Position = vec4(view.x * uZoom, view.y * uZoom, view.z * 0.035, 1.0);

    vTerrainUV = terrainUV;
    vHeight = height;
    vNormal = normal;
}
`;

  /*
   * ============================================================
   * FRAGMENT SHADER
   * ============================================================
   */

  const fragSrc = `
precision highp float;
uniform float uFragmentTime;
varying vec2 vTerrainUV;
varying float vHeight;
varying vec3 vNormal;


// Oil noise
vec2 hash2(vec2 p) {
    p = vec2(
        dot(p, vec2(127.1, 311.7)),
        dot(p, vec2(269.5, 183.3))
    );

    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
        mix(
            dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
            dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)),
            u.x
        ),
        mix(
            dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
            dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)),
            u.x
        ),
        u.y
    );
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;

    mat2 rot = mat2(
        0.8, 0.6,
        -0.6, 0.8
    );

    for (int i = 0; i < 6; i++) {
        v += a * noise(p);
        p = rot * p * 2.0;
        a *= 0.5;
    }

    return v;
}


float oilPattern(vec2 p, float t) {
    vec2 q = vec2(
        fbm(p + t * 0.05),
        fbm(p + vec2(5.2, 1.3) - t * 0.04)
    );

    vec2 r = vec2(
        fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.08),
        fbm(p + 4.0 * q + vec2(8.3, 2.8) - t * 0.06)
    );

    return fbm(p + 4.0 * r);
}

vec3 palette(float t) {
    vec3 a = vec3(0.55, 0.45, 0.55);
    vec3 b = vec3(0.45, 0.45, 0.45);
    vec3 c = vec3(1.0, 0.9, 0.6);
    vec3 d = vec3(0.3, 0.55, 0.75);

    return a + b * cos(6.28318 * (c * t + d));
}


void main() {
    float t = uFragmentTime * 0.5;

	// Terrain space coords for oil.
    vec2 uv = vTerrainUV * 2.4;

	// Stretch slightly on elevanted terrain
    uv += vec2(
        vHeight * 0.18,
        vHeight * 0.12
    );


	// oil swirl
    float radius = length(uv);
    float ang = 0.6 * sin(radius * 1.5 - t * 0.3) + 0.05 * t;
    mat2 rot = mat2(
        cos(ang), -sin(ang),
        sin(ang), cos(ang)
    );
    vec2 sp = rot * uv * 1.6;


	// pattern
    float n = oilPattern(sp, t);
    vec3 col = palette(n * 1.3 + 0.05 * t);
    float sheen = smoothstep(
        0.35,
        0.9,
        fbm(sp * 2.0 - t * 0.1)
    );

    col += 0.25 * sheen * palette(n * 2.0 + 0.5);


    float veins = smoothstep(
        0.0,
        0.15,
        abs(n - 0.5) - 0.02
    );
    col *= mix(0.55, 1.0, veins);


	// Terrain lighting
    vec3 N = normalize(vNormal);
    vec3 lightDir = normalize(vec3(-0.55, 0.58, 0.48));
    float diffuse = dot(N, lightDir);
    float lighting = 0.24 + max(diffuse, 0.0) * 0.95;
    lighting = max(lighting, 0.20);
    col *= lighting;


	// grazing
    float grazing = 1.0 - abs(dot(N, lightDir));
    grazing = smoothstep(0.30, 0.92, grazing);
    col += grazing * 0.11 * palette(n * 2.0 + 0.15);


	// Height contrast
    float h01 = smoothstep(-0.55, 0.65, vHeight);
    col *= 0.68 + h01 * 0.38;


     // Additional darkening for downward-facing terrain.
    float underside = smoothstep(-0.25, 0.45, N.y);
    col *= 0.72 + underside * 0.28;

    col = pow(max(col, 0.0), vec3(0.85));
    gl_FragColor = vec4(col, 1.0);
}
`;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error("gl.createShader() failed.");
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader) || "Unknown shader error.";
      gl.deleteShader(shader);
      throw new Error("Shader compilation failed:\n" + log);
    }

    return shader;
  }

  let vertexShader;
  let fragmentShader;
  let program;

  try {
    vertexShader = compileShader(gl.VERTEX_SHADER, vertSrc);
    fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragSrc);

    program = gl.createProgram();

    if (!program) {
      throw new Error("gl.createProgram() failed.");
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log =
        gl.getProgramInfoLog(program) || "Unknown program linking error.";

      throw new Error("Program linking failed:\n" + log);
    }

    gl.useProgram(program);
  } catch (error) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    if (program) gl.deleteProgram(program);

    fail("Terrain shader initialization failed.", error);
    return;
  }

  /*
   * ============================================================
   * TERRAIN MESH
   * ============================================================
   */

  // Terrain mesh
  const positions = [];
  const indices = [];

  for (let y = 0; y <= GRID; y++) {
    for (let x = 0; x <= GRID; x++) {
      const px = (x / GRID) * 2.0 - 1.0;
      const py = (y / GRID) * 2.0 - 1.0;

      positions.push(px, py);
    }
  }

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * (GRID + 1) + x;
      indices.push(i, i + 1, i + GRID + 1, i + 1, i + GRID + 2, i + GRID + 1);
    }
  }

  const positionBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  if (!positionBuffer || !indexBuffer) {
    fail("Unable to create terrain buffers.");
    return;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW,
  );

  const positionLocation = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(positionLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const uVertexTime = gl.getUniformLocation(program, "uVertexTime");
  const uFragmentTime = gl.getUniformLocation(program, "uFragmentTime");
  const uResolution = gl.getUniformLocation(program, "uResolution");
  const uMouse = gl.getUniformLocation(program, "uMouse");
  const uMouseActive = gl.getUniformLocation(program, "uMouseActive");
  const uZoom = gl.getUniformLocation(program, "uZoom");

  // Mouse pointer
  // NOTE: the site's global CSS sets `canvas { pointer-events: none; }` so
  // that the background never blocks clicks on real page content. That
  // means pointer listeners have to live on the window, not the canvas,
  // for the terrain's mouse-hover ripple to keep working.
  let targetMouseX = 0;
  let targetMouseY = 0;

  let mouseX = 0;
  let mouseY = 0;

  let mouseActive = 0;
  let targetMouseActive = 0;

  function updatePointer(x, y) {
    const px = x / window.innerWidth;
    const py = y / window.innerHeight;

    targetMouseX = px * 2.0 - 1.0;
    targetMouseY = 1.0 - py * 2.0;
    targetMouseActive = 1;
  }

  window.addEventListener(
    "pointermove",
    (e) => updatePointer(e.clientX, e.clientY),
    { passive: true },
  );

  window.addEventListener(
    "pointerleave",
    () => {
      targetMouseActive = 0;
    },
    { passive: true },
  );

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);

  // Render
  const start = performance.now();
  let animationFrame = null;
  let stopped = false;
  function render() {
    if (stopped) return;
    const time = (performance.now() - start) / 1000;

    // smooth pointer movement
    mouseX += (targetMouseX - mouseX) * 0.12;
    mouseY += (targetMouseY - mouseY) * 0.12;
    mouseActive += (targetMouseActive - mouseActive) * 0.1;

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(program);

    gl.uniform1f(uVertexTime, time);
    gl.uniform1f(uFragmentTime, time);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform2f(uMouse, mouseX, mouseY);
    gl.uniform1f(uMouseActive, mouseActive);
    gl.uniform1f(uZoom, currentZoom);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    animationFrame = requestAnimationFrame(render);
  }

  canvas.addEventListener("webglcontextlost", function (event) {
    event.preventDefault();

    stopped = true;

    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
    }

    fail("WebGL context was lost.");
  });

  // success!
  body.classList.remove("shader-fallback");
  render();
})();
