
precision highp float;
uniform float uFragmentTime;
uniform float uOilSize;    // >1 = bigger swirls
uniform float uHue;        // 0..1 = one full palette cycle
uniform float uIntensity;  // palette amplitude
uniform float uBands;      // palette frequency (more/fewer color bands)
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
    vec3 b = vec3(0.45, 0.45, 0.45) * uIntensity;
    vec3 c = vec3(1.0, 0.9, 0.6) * uBands;
    vec3 d = vec3(0.3, 0.55, 0.75) + uHue;
    return a + b * cos(6.28318 * (c * t + d));
}


void main() {
    float t = uFragmentTime * 0.5;

	// Terrain space coords for oil.
    vec2 uv = vTerrainUV * 2.4 / uOilSize;

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
