/**
 * Full-screen animated terrain backdrop (plain WebGL1). The <body class="shader-fallback">
 * CSS gradient shows until this initialises, and again if it fails.
 */

import { core } from "./core";
import { settings } from "./settings";
import fragmentSource from "./shaders/terrain.frag.glsl";
import vertexSource from "./shaders/terrain.vert.glsl";

const GRID = 96;
const QUALITY = 0.85;
const MAX_DPR = 1.5;
const YAW = 0.78539816339;
const PITCH = 0.64;
const MESH_HALF_RANGE = 6.0; // `p = a_pos * 8.0` in the vertex shader
const DIAMOND_WX = 2 * MESH_HALF_RANGE * Math.cos(YAW); // max |view.x|
const DIAMOND_HY = 2 * MESH_HALF_RANGE * Math.cos(YAW) * Math.sin(PITCH); // max |view.y|
const BASE_ZOOM = 0.4;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("gl.createShader() failed.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "Unknown shader error.";
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed:\n${log}`);
  }
  return shader;
}

function linkProgram(gl: WebGLRenderingContext): WebGLProgram {
  let vertexShader: WebGLShader | undefined;
  let fragmentShader: WebGLShader | undefined;
  let program: WebGLProgram | null = null;

  try {
    vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    program = gl.createProgram();
    if (!program) throw new Error("gl.createProgram() failed.");

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(
        `Program linking failed:\n${gl.getProgramInfoLog(program) ?? "Unknown error."}`,
      );
    }
    return program;
  } catch (error) {
    if (program) gl.deleteProgram(program);
    throw error;
  } finally {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
  }
}

/** A (GRID+1)² lattice over -1..1, as positions and triangle indices. */
function buildMesh(): { positions: Float32Array; indices: Uint16Array } {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= GRID; y++) {
    for (let x = 0; x <= GRID; x++) {
      positions.push((x / GRID) * 2.0 - 1.0, (y / GRID) * 2.0 - 1.0);
    }
  }

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * (GRID + 1) + x;
      indices.push(i, i + 1, i + GRID + 1, i + 1, i + GRID + 2, i + GRID + 1);
    }
  }

  return { positions: new Float32Array(positions), indices: new Uint16Array(indices) };
}

export function startTerrain(): void {
  const body = document.body;

  // The CSS fallback is on by default (<body class="shader-fallback">); it is removed
  // once the terrain initialises, and restored if anything fails.
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
  body.prepend(canvas);

  function fail(reason: string, error?: unknown): void {
    console.error(`[terrain-bg] ${reason}`, error ?? "");
    canvas.remove();
    body.classList.add("shader-fallback");
  }

  let context: WebGLRenderingContext | null;
  try {
    context = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: true,
      powerPreference: "high-performance",
    });
  } catch (error) {
    fail("Unable to create WebGL context.", error);
    return;
  }
  if (!context) {
    fail("WebGL is not supported.");
    return;
  }
  const gl = context;

  let currentZoom = BASE_ZOOM;
  function resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const width = Math.max(1, Math.floor(window.innerWidth * dpr * QUALITY));
    const height = Math.max(1, Math.floor(window.innerHeight * dpr * QUALITY));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    const aspect = window.innerWidth / window.innerHeight;
    const coverZoom = aspect / DIAMOND_WX + 1 / DIAMOND_HY; // true corner-coverage condition
    currentZoom = Math.max(BASE_ZOOM, coverZoom);
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  let program: WebGLProgram;
  try {
    program = linkProgram(gl);
    gl.useProgram(program);
  } catch (error) {
    fail("Terrain shader initialization failed.", error);
    return;
  }

  const mesh = buildMesh();
  const positionBuffer = gl.createBuffer();
  const indexBuffer = gl.createBuffer();
  if (!positionBuffer || !indexBuffer) {
    fail("Unable to create terrain buffers.");
    return;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(positionLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const uniform = (name: string): WebGLUniformLocation | null =>
    gl.getUniformLocation(program, name);
  const uVertexTime = uniform("uVertexTime");
  const uFragmentTime = uniform("uFragmentTime");
  const uOilSize = uniform("uOilSize");
  const uHue = uniform("uHue");
  const uIntensity = uniform("uIntensity");
  const uBands = uniform("uBands");
  const uResolution = uniform("uResolution");
  const uMouse = uniform("uMouse");
  const uMouseActive = uniform("uMouseActive");
  const uZoom = uniform("uZoom");

  // Pointer position comes from core.ts: the canvas has pointer-events: none (so it never
  // blocks the page), which means pointer listeners have to live on the window.
  let targetMouseX = 0;
  let targetMouseY = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseActive = 0;
  let targetMouseActive = 0;

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);

  let stopped = false;
  let time = 0;

  function render(dt: number): void {
    if (stopped) return;
    time += dt;

    if (core.pointer.active) {
      targetMouseX = (core.pointer.x / window.innerWidth) * 2.0 - 1.0;
      targetMouseY = 1.0 - (core.pointer.y / window.innerHeight) * 2.0;
      targetMouseActive = 1;
    } else {
      targetMouseActive = 0;
    }

    mouseX += (targetMouseX - mouseX) * 0.12;
    mouseY += (targetMouseY - mouseY) * 0.12;
    mouseActive += (targetMouseActive - mouseActive) * 0.1;

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.uniform1f(uVertexTime, time);
    gl.uniform1f(uFragmentTime, time);
    gl.uniform1f(uOilSize, settings.get("oilSize"));
    gl.uniform1f(uHue, settings.get("hue"));
    gl.uniform1f(uIntensity, settings.get("intensity"));
    gl.uniform1f(uBands, settings.get("bands"));
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform2f(uMouse, mouseX, mouseY);
    gl.uniform1f(uMouseActive, mouseActive);
    gl.uniform1f(uZoom, currentZoom);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
  }

  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    stopped = true;
    core.remove(render);
    fail("WebGL context was lost.");
  });

  body.classList.remove("shader-fallback");
  core.add(render);
}
