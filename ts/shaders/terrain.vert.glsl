
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
