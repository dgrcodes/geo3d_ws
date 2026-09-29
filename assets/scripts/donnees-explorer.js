/* =========================================================================
   GEO3D -- EXPLORER LES DONNÉES
   Immersive underground data explorer. The terrain cube IS the interface:
   each dataset lives inside the cube as its own visual phenomenon. Hover to
   reveal it, click to fly in; the cube opens along an animated clipping
   plane and scientific callouts anchor directly onto the anomaly.

   DATA-DRIVEN: everything visual (position, depth, size, color, labels,
   description, metadata) is generated from the DATASETS array below.
   To plug in real GEO3D data later, either edit DATASETS in place or drop
   a `geo3d-donnees.json` file next to this script (same shape as DATASETS)
   -- it is fetched automatically at load and replaces the placeholders
   without touching any animation or interface code.
   ========================================================================= */

// -------- INDEX --------
// Immersive "explorer les données" cube: CONFIG, DATASETS, background dot
// grid, the terrain cube (shared shader look with the homepage cube), one
// visual BUILDER per dataset visualization type, the DOM/callout UI, camera
// focus fly-in/out, and the main render loop.
const getCSSColor = window.GEO3D.getCSSColor;

import { createField } from './geo3d/field.js';
import { buildBlock } from './geo3d/block.js';

// -------- DATA --------
/* =========================================================================
   CONFIG
   ========================================================================= */
const CONFIG = {
    cube: {
        size: 2,
        baseRotationX: 0,
        baseRotationY: 0,
        autoRotateSpeed: 0.0018, // rad/frame in overview mode
        parallax: { strengthX: 0.12, strengthY: 0.18, ease: 0.06 } // match homepage cube tilt-follow
    },
    strata: [
        // bottom -> top, same vars as the homepage cube
        getCSSColor("--cube-band-0", "#2d1b12"),
        getCSSColor("--cube-band-1", "#3f2a1c"),
        getCSSColor("--cube-band-2", "#553a26"),
        getCSSColor("--cube-band-3", "#6f5136"),
        getCSSColor("--cube-band-4", "#93724f"),
        getCSSColor("--cube-band-5", "#bda28b")
    ],
    topColor: getCSSColor("--cube-top-color", "#556b2f"),
    style: {
        wireColor: getCSSColor("--cube-wire-color", "#3d2b1f"),
        rimColor: getCSSColor("--cube-rim-color", "#d8cfc2"),
        lineColor: getCSSColor("--nav-line-color", "#3d2b1f"),
        labelColor: getCSSColor("--nav-label-color", "#2a2a2a")
    },
    // Surface treatment ported from the homepage cube (assets/scripts/cube-scene.js):
    // random expanding ripple bursts on the point under the cursor, the ring's
    // color cycling between colorA <-> colorB as it grows.
    ripple: {
        colorA: getCSSColor("--cube-ripple-color-a", "#2b6d8b"),
        colorB: getCSSColor("--cube-ripple-color-b", "#a0846e"),
        speed: 0.5,      // how fast colorA <-> colorB cycles
        sharpness: 25.0, // higher = thinner ring line
        ringCount: 3,    // concentric trailing rings per burst
        ringSpacing: 0.16 // gap between them, world units (scales with cube size)
    },
    // This page now shows exactly one dataset (Réponse magnétique), whose
    // block fills the whole cube and needs to actually read through the
    // terrain shell instead of sitting behind an opaque wall of it -- these
    // used to be 0.82 (a solid "crystal" look) back when the cube's own
    // faces were the only thing drawn here; if other datasets come back,
    // this is worth revisiting since it was tuned for the block, not them.
    faceOpacity: 0.05,
    noise: { amplitude: 0.05, frequency: 10, segments: 8, bandHeightSegments: 8 }, // match homepage bump depth/size
    // Cube is sliced into horizontal bands, same as the homepage cube (each
    // band exposes all 4 side faces), plus two unsliced caps ("top"/"bottom").
    layers: {
        count: 6,
        opacities: [0.05, 0.05, 0.05, 0.05, 0.05, 0.05]
    },
    // Layer hover (separation/highlight) is intentionally disabled -- the
    // terrain bands stay static and never animate on hover.
    interaction: {
        borderOpacity: 0.1
    },
    background: {
        dots: { size: 1.5, spacing: 48, opacityMin: 0.12, opacityMax: 0.45 },
        dotParallax: { strength: 18, ease: 0.05 }
    },
    focus: {
        flyDuration: 1.7, // seconds, camera fly-in
        cameraDistance: 2.1, // distance from anomaly center when focused
        anomalyScale: 1.35, // how much the selected anomaly expands
        dimOthers: 0.06 // opacity multiplier on non-selected anomalies
    },
    intro: { duration: 1.2 } // global fade-in on load
};

/* =========================================================================
   DATASETS -- placeholder data, replace freely (or via geo3d-donnees.json).
   position: local cube coordinates, each axis -1..1 (cube half = 1 unit).
   radius:   anomaly size in the same units.
   visualization: "cloud" | "flow" | "current" | "field" | "seismic" |
                  "gradient" | "fog" | "strata" | "risk"
   ========================================================================= */
// Temporarily trimmed to magnétisme + sismique -- the other 7 (cloud/flow/
// current/gradient/fog/strata/risk) are removed from here but their BUILDERS
// entries are left intact below, so re-adding a dataset object with the
// matching `visualization` key brings one back with no other code change.
const DATASETS = [
    {
        id: "04",
        title: "Réponse magnétique",
        description: "Lignes de champ rendant visibles des forces invisibles. Le dipôle affiché sera positionné et orienté selon les relevés magnétométriques.",
        depth: "3.5–7.2 m",
        intensity: "Forte",
        confidence: "91 %",
        visualization: "field",
        color: "#8a5fb0",
        colorB: "#c9a7e8",
        affectedVolume: "180 m²",
        notes: "Données de démonstration",
        position: [-0.45, 0.4, -0.25],
        radius: 0.3,
        // Optional -- path to a real 2D figure (e.g. a classic profile/map
        // view of this dataset) shown in the main callout. Left unset here
        // since there's no real asset yet; buildCallouts() shows a dashed
        // placeholder box instead until one is provided.
        image2D: null
    },
    {
        id: "05",
        title: "Sismique",
        description: "Coupe sismique en niveaux de gris révélant les horizons réfléchissants et leurs plissements. Les réflecteurs affichés seront calés sur les profils sismiques réels du site.",
        depth: "0–12 m",
        intensity: "Variable",
        confidence: "87 %",
        visualization: "seismic",
        color: "#8a8a8a",
        colorB: "#d8d8d8",
        affectedVolume: "620 m²",
        notes: "Données de démonstration",
        position: [0, 0, 0],
        radius: 0.3,
        image2D: null
    }
];

// -------- INITIALIZATION --------
/* =========================================================================
   BACKGROUND DOT GRID -- same treatment as the homepage (built by the
   shared helper in dom-utils.js).
   ========================================================================= */
const bgDots = window.GEO3D.createDotGridBackground(CONFIG.background.dots);

/* =========================================================================
   SCENE
   ========================================================================= */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
const OVERVIEW_CAM = new THREE.Vector3(2.6, 2.0, 3.6);
camera.position.copy(OVERVIEW_CAM);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
Object.assign(renderer.domElement.style, { position: "fixed", top: "0", left: "0" });
document.body.appendChild(renderer.domElement);

// Everything else in this scene is unlit (ShaderMaterial/MeshBasicMaterial),
// so no lights existed here before -- added only so the magnétisme dataset's
// lit voxel block (assets/scripts/geo3d/block.js, MeshStandardMaterial) isn't
// rendered black. Has no effect on the unlit materials above.
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const blockLight = new THREE.DirectionalLight(0xffffff, 0.9);
blockLight.position.set(2, 3, 2);
scene.add(blockLight);

const clock = new THREE.Clock();
const sharedTime = { value: 0 };

const cubeRoot = new THREE.Group();
cubeRoot.rotation.x = CONFIG.cube.baseRotationX;
cubeRoot.rotation.y = CONFIG.cube.baseRotationY;
scene.add(cubeRoot);

const half = CONFIG.cube.size / 2;

/* =========================================================================
   TERRAIN CUBE -- ported directly from the homepage cube (assets/scripts/cube-scene.js):
   sliced into horizontal bands, each band exposing all 4 side faces (front/
   back/left/right), plus single top/bottom caps. Same per-face "crystal"
   shader (fresnel rim, flowing wave lines, height-shaded bumps, world-space
   ripple bursts) and the same hover-driven layer separation.
   Since focus fly-in can no longer discard through a single solid box, the
   whole cube instead fades out (see cubeMats/applyCubeFade below) while the
   camera flies into the selected anomaly, and fades back in on return.
   ========================================================================= */
const MAX_RIPPLES = 3;
const RIPPLE_LIFETIME = 2.2; // seconds a ripple stays visible before fully fading
const RIPPLE_EXPAND_SPEED = 0.55 * CONFIG.cube.size; // world units/sec
const RIPPLE_SHARPNESS = CONFIG.ripple.sharpness / CONFIG.cube.size;
const RIPPLE_RING_COUNT = CONFIG.ripple.ringCount;
const RIPPLE_RING_SPACING = CONFIG.ripple.ringSpacing * CONFIG.cube.size;

const FACE_VERTEX_SHADER = `
  uniform vec2 uUvOffset;
  uniform vec2 uUvScale;
  uniform float uNoiseAmp;
  uniform float uNoiseFreq;
  uniform vec3 uNoiseSeed;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  varying float vNoiseHeight;
  varying vec3 vWorldPos; // used to render ripples in world space, so they carry across face seams

  float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // Cheap trilinear value noise -- just enough to break up a perfectly flat face.
  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
    float nx00 = mix(n000, n100, f.x);
    float nx10 = mix(n010, n110, f.x);
    float nx01 = mix(n001, n101, f.x);
    float nx11 = mix(n011, n111, f.x);
    float nxy0 = mix(nx00, nx10, f.y);
    float nxy1 = mix(nx01, nx11, f.y);
    return mix(nxy0, nxy1, f.z) * 2.0 - 1.0; // -1..1
  }

  float displacementAt(vec3 worldPos) {
    return noise3(worldPos * uNoiseFreq + uNoiseSeed) * uNoiseAmp;
  }

  void main() {
    // Remaps this band's own 0-1 uv into the whole face's 0-1 uv space, so a
    // ripple's position/radius line up across band seams instead of each
    // band replaying its own copy of the ripple in local coordinates.
    vUv = uv * uUvScale + uUvOffset;

    // Displace along the normal using world-space position (not local position),
    // so bands of the same physical face line up into one continuous bumpy
    // surface instead of each band having its own disconnected bump pattern.
    vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    vWorldPos = worldPos;
    float rawNoise = noise3(worldPos * uNoiseFreq + uNoiseSeed); // -1..1, same field as displacementAt
    vNoiseHeight = rawNoise;
    vec3 displaced = position + normal * rawNoise * uNoiseAmp;

    // The fresnel/rim shading only reacts to vNormal, not raw vertex position, so
    // without this the bumps move geometry but look completely flat-shaded.
    // Recover a bumped normal via finite differences of the same displacement
    // function along the face's tangent/bitangent, then perturb the flat normal.
    vec3 worldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec3 tangent = normalize((modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
    vec3 bitangent = normalize((modelMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    float eps = 0.03;
    float dHu = (displacementAt(worldPos + tangent * eps) - displacementAt(worldPos - tangent * eps)) / (2.0 * eps);
    float dHv = (displacementAt(worldPos + bitangent * eps) - displacementAt(worldPos - bitangent * eps)) / (2.0 * eps);
    vec3 bumpedWorldNormal = normalize(worldNormal - dHu * tangent - dHv * bitangent);

    vNormal = normalize((viewMatrix * vec4(bumpedWorldNormal, 0.0)).xyz);
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FACE_FRAGMENT_SHADER = `
  uniform vec3 uBaseColor;
  uniform vec3 uRimColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform vec3 uRippleColorA;
  uniform vec3 uRippleColorB;
  uniform float uRippleSpeed;
  uniform vec3 uRippleOrigin[${MAX_RIPPLES}];
  uniform float uRippleStart[${MAX_RIPPLES}];
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;
  varying float vNoiseHeight;
  varying vec3 vWorldPos;

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    vec3 n = normalize(vNormal);
    float fresnel = pow(1.0 - abs(dot(n, viewDir)), 2.2);

    // Flowing wavy lines across the face, slowly animated
    float wave = sin(vUv.y * 200.0 + sin(vUv.x * 5.0 + uTime * 0.25) * 2.5 + uTime * 0.4);
    float lines = smoothstep(0.99, 1.0, abs(wave)) * 0.5;

    vec3 color = mix(uBaseColor, uRimColor, fresnel * 0.8);
    color += lines * uRimColor;

    // Height-based shading: valleys read darker/more transparent, peaks read
    // brighter/lighter, regardless of viewing angle -- fresnel alone goes flat
    // when a face is viewed near head-on, so this keeps the bumps visible everywhere.
    float heightShade = vNoiseHeight * 0.5 + 0.5; // -1..1 -> 0..1
    color = mix(color * 0.7, mix(color, uRimColor, 0.5), heightShade);
    float heightAlpha = (heightShade - 0.5) * 0.3;

    // Randomly-timed expanding ripple bursts, computed in WORLD space (not
    // per-face UV) so a ripple travels across face seams instead of stopping
    // dead at the edge of whichever face it started on.
    float rippleSum = 0.0;
    for (int i = 0; i < ${MAX_RIPPLES}; i++) {
      float start = uRippleStart[i];
      if (start < 0.0) continue;
      float elapsed = uTime - start;
      if (elapsed < 0.0 || elapsed > ${RIPPLE_LIFETIME.toFixed(1)}) continue;

      float dist = length(vWorldPos - uRippleOrigin[i]);
      float radius = elapsed * ${RIPPLE_EXPAND_SPEED.toFixed(3)};
      float fade = exp(-elapsed * 1.1);

      // Concentric trailing rings behind the leading edge (a real ripple has
      // more than one wavefront), each fainter than the last.
      for (int j = 0; j < ${RIPPLE_RING_COUNT}; j++) {
        float ringRadius = radius - float(j) * ${RIPPLE_RING_SPACING.toFixed(3)};
        if (ringRadius < 0.0) continue;
        float ring = exp(-pow((dist - ringRadius) * ${RIPPLE_SHARPNESS.toFixed(3)}, 2.0));
        float ringFalloff = 1.0 - float(j) / float(${RIPPLE_RING_COUNT});
        rippleSum += ring * fade * ringFalloff;
      }
    }
    rippleSum = clamp(rippleSum, 0.0, 1.0);

    float rt = sin(uTime * uRippleSpeed * 6.2831) * 0.5 + 0.5;
    vec3 rippleColor = mix(uRippleColorA, uRippleColorB, rt);
    color += rippleColor * rippleSum;

    float alpha = clamp(uOpacity + fresnel * 0.35 + lines * 0.15 + rippleSum * 0.5 + heightAlpha, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

function createRippleState() {
    return {
        origins: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector3()), // world-space points
        starts: Array.from({ length: MAX_RIPPLES }, () => -1), // -1 = inactive slot
        slotCursor: 0
    };
}

function randomNoiseSeed() {
    return new THREE.Vector3(Math.random() * 1000, Math.random() * 1000, Math.random() * 1000);
}

// Collects every material belonging to the terrain cube (band fills + border
// lines + boundary wires + corner/perimeter wires) so the whole cube can fade
// out/in as one during a focus fly-in/return (see applyCubeFade below).
const cubeMats = []; // { mat, base, isShader }
let cubeFade = 1;
function applyCubeFade(fade) {
    cubeMats.forEach(({ mat, base, isShader }) => {
        if (isShader) mat.uniforms.uOpacity.value = base * fade;
        else mat.opacity = base * fade;
    });
}

function createFaceMaterial(color, opacity, rippleState, uvOffset, uvScale, noiseSeed) {
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uBaseColor: { value: new THREE.Color(color) },
            uRimColor: { value: new THREE.Color(CONFIG.style.rimColor) },
            uOpacity: { value: opacity },
            uTime: sharedTime,
            uUvOffset: { value: uvOffset || new THREE.Vector2(0, 0) },
            uUvScale: { value: uvScale || new THREE.Vector2(1, 1) },
            uNoiseAmp: { value: CONFIG.noise.amplitude },
            uNoiseFreq: { value: CONFIG.noise.frequency },
            uNoiseSeed: { value: noiseSeed || randomNoiseSeed() },
            uRippleColorA: { value: new THREE.Color(CONFIG.ripple.colorA) },
            uRippleColorB: { value: new THREE.Color(CONFIG.ripple.colorB) },
            uRippleSpeed: { value: CONFIG.ripple.speed },
            uRippleOrigin: { value: rippleState.origins },
            uRippleStart: { value: rippleState.starts }
        },
        vertexShader: FACE_VERTEX_SHADER,
        fragmentShader: FACE_FRAGMENT_SHADER,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    material.userData.rippleState = rippleState;
    cubeMats.push({ mat: material, base: opacity, isShader: true });
    return material;
}

/* =========================================================================
   LAYERS -- horizontal bands (all 4 side faces) + top and bottom caps.
   Every one of these is individually hoverable, same as the homepage cube.
   ========================================================================= */
const layerGroup = new THREE.Group();
const layers = []; // { fill, border, baseColor, baseOpacity, anchorLocal, layerIndex, face, group }

const layerOffsets = {}; // layerIndex -> current separation offset
const layerInitialPositions = {}; // layerIndex -> { fill, border }
const layerMeshes = {}; // layerIndex -> array of all meshes (fill, border, wires) for that layer

function initializeLayerPosition(layer) {
    if (layer.layerIndex === null) return;
    if (!(layer.layerIndex in layerInitialPositions)) {
        layerInitialPositions[layer.layerIndex] = {
            fill: layer.fill.position.clone(),
            border: layer.border ? layer.border.position.clone() : null
        };
        layerOffsets[layer.layerIndex] = 0;
    }
    if (!(layer.layerIndex in layerMeshes)) layerMeshes[layer.layerIndex] = [];
    layerMeshes[layer.layerIndex].push(layer.fill);
    if (layer.border) layerMeshes[layer.layerIndex].push(layer.border);
}

function addFace({ layerIndex, face, color, opacity, fillGeo, fillPos, fillRot, anchorLocal, rippleState, uvOffset, uvScale, noiseSeed }) {
    const fillMat = createFaceMaterial(color, opacity, rippleState, uvOffset, uvScale, noiseSeed);
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.position.copy(fillPos);
    fill.rotation.copy(fillRot);
    layerGroup.add(fill);

    const layerData = { fill, border: null, baseColor: color, baseOpacity: opacity, anchorLocal, layerIndex, face };
    fill.userData.layerRef = layerData;
    layers.push(layerData);
    initializeLayerPosition(layerData);
    return layerData;
}

const bandCount = CONFIG.layers.count;
const bandHeight = CONFIG.cube.size / bandCount;

const SIDE_FACES = [
    { key: "front", axis: "x", sign: 1, rotY: Math.PI / 2 },
    { key: "back", axis: "x", sign: -1, rotY: -Math.PI / 2 },
    { key: "left", axis: "z", sign: 1, rotY: 0 },
    { key: "right", axis: "z", sign: -1, rotY: Math.PI }
];

// Ripples render in world space, so one shared ripple state covers the whole
// cube -- a burst started on one face naturally carries onto its neighbors.
const globalRippleState = createRippleState();
const faceRippleStates = {
    front: globalRippleState, back: globalRippleState, left: globalRippleState, right: globalRippleState,
    top: globalRippleState, bottom: globalRippleState
};

// One noise seed per physical face (shared by every band on that face), so
// the bump pattern is continuous across band seams instead of restarting per band.
const faceNoiseSeeds = {
    front: randomNoiseSeed(), back: randomNoiseSeed(), left: randomNoiseSeed(), right: randomNoiseSeed(),
    top: randomNoiseSeed(), bottom: randomNoiseSeed()
};

const bandWidthSegments = CONFIG.noise.segments;
const bandHeightSegments = CONFIG.noise.bandHeightSegments;

for (let i = 0; i < bandCount; i++) {
    const yCenter = -half + bandHeight * (i + 0.5);
    const color = CONFIG.strata[i % CONFIG.strata.length];
    const opacity = CONFIG.layers.opacities[i % CONFIG.layers.opacities.length];

    SIDE_FACES.forEach((sf) => {
        const pos = sf.axis === "x"
            ? new THREE.Vector3(sf.sign * half, yCenter, 0)
            : new THREE.Vector3(0, yCenter, sf.sign * half);

        const layerData = addFace({
            layerIndex: i,
            face: sf.key,
            color,
            opacity,
            fillGeo: new THREE.PlaneGeometry(CONFIG.cube.size, bandHeight, bandWidthSegments, bandHeightSegments),
            fillPos: pos,
            fillRot: new THREE.Euler(0, sf.rotY, 0),
            anchorLocal: pos.clone(),
            rippleState: faceRippleStates[sf.key],
            uvOffset: new THREE.Vector2(0, i / bandCount),
            uvScale: new THREE.Vector2(1, 1 / bandCount),
            noiseSeed: faceNoiseSeeds[sf.key]
        });
        layerData.group = [layerData];
    });
}

// TOP + BOTTOM caps -- single faces, not sliced into bands
const topData = addFace({
    layerIndex: null,
    face: "top",
    color: CONFIG.topColor,
    opacity: CONFIG.faceOpacity,
    fillGeo: new THREE.PlaneGeometry(CONFIG.cube.size, CONFIG.cube.size, CONFIG.noise.segments, CONFIG.noise.segments),
    fillPos: new THREE.Vector3(0, half, 0),
    fillRot: new THREE.Euler(-Math.PI / 2, 0, 0),
    anchorLocal: new THREE.Vector3(half, half, half),
    rippleState: faceRippleStates.top,
    noiseSeed: faceNoiseSeeds.top
});
topData.group = [topData];

const bottomData = addFace({
    layerIndex: null,
    face: "bottom",
    color: CONFIG.strata[0],
    opacity: CONFIG.faceOpacity,
    fillGeo: new THREE.PlaneGeometry(CONFIG.cube.size, CONFIG.cube.size, CONFIG.noise.segments, CONFIG.noise.segments),
    fillPos: new THREE.Vector3(0, -half, 0),
    fillRot: new THREE.Euler(Math.PI / 2, 0, 0),
    anchorLocal: new THREE.Vector3(half, -half, half),
    rippleState: faceRippleStates.bottom,
    noiseSeed: faceNoiseSeeds.bottom
});
bottomData.group = [bottomData];

// Attach the top/bottom caps to the outermost bands so they ride along with
// them during layer separation instead of staying fixed underneath/above.
if (!(bandCount - 1 in layerMeshes)) layerMeshes[bandCount - 1] = [];
layerMeshes[bandCount - 1].push(topData.fill);
if (!(0 in layerMeshes)) layerMeshes[0] = [];
layerMeshes[0].push(bottomData.fill);

// Boundary lines: one continuous loop per height level, running across all 4
// side faces so there's no seam at the shared edges.
const WIRE_SEGMENTS_PER_EDGE = 10;
const loopEdgeFaces = [
    { key: "left", normal: new THREE.Vector3(0, 0, 1) },
    { key: "front", normal: new THREE.Vector3(1, 0, 0) },
    { key: "right", normal: new THREE.Vector3(0, 0, -1) },
    { key: "back", normal: new THREE.Vector3(-1, 0, 0) }
];
function fract(v) { return v - Math.floor(v); }
function hash13(x, y, z) {
    x = fract(x * 0.1031); y = fract(y * 0.1031); z = fract(z * 0.1031);
    const d = x * (y + 33.33) + y * (z + 33.33) + z * (x + 33.33);
    x += d; y += d; z += d;
    return fract((x + y) * z);
}
function lerp(a, b, t) { return a + (b - a) * t; }
function noise3JS(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let fx = x - ix, fy = y - iy, fz = z - iz;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const n000 = hash13(ix, iy, iz), n100 = hash13(ix + 1, iy, iz);
    const n010 = hash13(ix, iy + 1, iz), n110 = hash13(ix + 1, iy + 1, iz);
    const n001 = hash13(ix, iy, iz + 1), n101 = hash13(ix + 1, iy, iz + 1);
    const n011 = hash13(ix, iy + 1, iz + 1), n111 = hash13(ix + 1, iy + 1, iz + 1);
    const nx00 = lerp(n000, n100, fx), nx10 = lerp(n010, n110, fx);
    const nx01 = lerp(n001, n101, fx), nx11 = lerp(n011, n111, fx);
    const nxy0 = lerp(nx00, nx10, fy), nxy1 = lerp(nx01, nx11, fy);
    return lerp(nxy0, nxy1, fz) * 2 - 1;
}
function displaceAlongNormal(point, normal, seed) {
    const freq = CONFIG.noise.frequency;
    const amp = CONFIG.noise.amplitude;
    const n = noise3JS(point.x * freq + seed.x, point.y * freq + seed.y, point.z * freq + seed.z);
    return point.clone().addScaledVector(normal, n * amp);
}
function buildBoundaryLoopPoints(yLevel) {
    const corners = [
        new THREE.Vector3(-half, yLevel, half),
        new THREE.Vector3(half, yLevel, half),
        new THREE.Vector3(half, yLevel, -half),
        new THREE.Vector3(-half, yLevel, -half),
        new THREE.Vector3(-half, yLevel, half)
    ];
    const points = [];
    for (let e = 0; e < 4; e++) {
        const start = corners[e];
        const end = corners[e + 1];
        const { key, normal } = loopEdgeFaces[e];
        const seed = faceNoiseSeeds[key];
        for (let s = 0; s < WIRE_SEGMENTS_PER_EDGE; s++) {
            const t = s / WIRE_SEGMENTS_PER_EDGE;
            points.push(displaceAlongNormal(start.clone().lerp(end, t), normal, seed));
        }
    }
    points.push(points[0].clone());
    return points;
}

const layerBoundaryLines = {};
for (let i = 0; i < bandCount; i++) {
    if (i > 0) {
        const yLevel = -half + bandHeight * i;
        const loopPoints = buildBoundaryLoopPoints(yLevel);
        const makeLoopLine = () => {
            const loopGeo = new THREE.BufferGeometry().setFromPoints(loopPoints);
            const loopMat = new THREE.LineBasicMaterial({
                color: CONFIG.style.wireColor,
                transparent: true,
                opacity: CONFIG.interaction.borderOpacity
            });
            cubeMats.push({ mat: loopMat, base: CONFIG.interaction.borderOpacity, isShader: false });
            const loopLine = new THREE.Line(loopGeo, loopMat);
            layerGroup.add(loopLine);
            return loopLine;
        };
        if (!(i in layerBoundaryLines)) layerBoundaryLines[i] = [];
        layerBoundaryLines[i].push(makeLoopLine());
        if (!((i - 1) in layerBoundaryLines)) layerBoundaryLines[i - 1] = [];
        layerBoundaryLines[i - 1].push(makeLoopLine());
    }
}
Object.keys(layerBoundaryLines).forEach((layerIndex) => {
    const idx = parseInt(layerIndex, 10);
    if (!(idx in layerMeshes)) layerMeshes[idx] = [];
    layerBoundaryLines[idx].forEach((wireMesh) => layerMeshes[idx].push(wireMesh));
});

/* =========================================================================
   CUBE EDGES -- the box's own outline (4 vertical corner struts + top/bottom
   perimeters), built per band so every segment moves with its own layer
   during separation, same as the homepage cube.
   ========================================================================= */
function registerLayerMesh(idx, mesh) {
    if (!(idx in layerMeshes)) layerMeshes[idx] = [];
    layerMeshes[idx].push(mesh);
}
function makeStraightLine(points) {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: CONFIG.style.wireColor, transparent: true, opacity: 0.9 });
    cubeMats.push({ mat, base: 0.9, isShader: false });
    const line = new THREE.Line(geo, mat);
    layerGroup.add(line);
    return line;
}

const cubeCornersXZ = [[half, half], [half, -half], [-half, half], [-half, -half]];
cubeCornersXZ.forEach(([x, z]) => {
    for (let i = 0; i < bandCount; i++) {
        const yBottom = -half + bandHeight * i;
        const yTop = yBottom + bandHeight;
        const segment = makeStraightLine([new THREE.Vector3(x, yBottom, z), new THREE.Vector3(x, yTop, z)]);
        registerLayerMesh(i, segment);
    }
});

const topPerimeter = makeStraightLine([
    new THREE.Vector3(-half, half, half), new THREE.Vector3(half, half, half),
    new THREE.Vector3(half, half, -half), new THREE.Vector3(-half, half, -half),
    new THREE.Vector3(-half, half, half)
]);
registerLayerMesh(bandCount - 1, topPerimeter);

const bottomPerimeter = makeStraightLine([
    new THREE.Vector3(-half, -half, half), new THREE.Vector3(half, -half, half),
    new THREE.Vector3(half, -half, -half), new THREE.Vector3(-half, -half, -half),
    new THREE.Vector3(-half, -half, half)
]);
registerLayerMesh(0, bottomPerimeter);

cubeRoot.add(layerGroup);

/* =========================================================================
   CUBE HOVER -- the terrain bands themselves never separate, move, or
   highlight from being hovered directly (that stays fully disabled). The
   only thing that makes the cube react is hovering an ANOMALY (see
   updateHover()/hoveredEntry below): a subtle whole-cube ambient tint,
   tied to the same easing this function drives, entirely temporary and
   gone the moment the hover ends -- reuses the bands' own existing
   uBaseColor/uOpacity uniforms, no new visual elements.
   ========================================================================= */
let cubeAmbientAmount = 0;
let cubeAmbientColorHex = "#ffffff";
const _ambientBase = new THREE.Color();
const _ambientTint = new THREE.Color();
function updateCubeAmbient() {
    if (hoveredEntry) cubeAmbientColorHex = hoveredEntry.data.color;
    const target = hoveredEntry ? 1 : 0;
    cubeAmbientAmount += (target - cubeAmbientAmount) * 0.12;
    if (cubeAmbientAmount < 0.001) cubeAmbientAmount = 0;

    _ambientTint.set(cubeAmbientColorHex);
    layers.forEach((l) => {
        _ambientBase.set(l.baseColor).lerp(_ambientTint, 0.16 * cubeAmbientAmount);
        l.fill.material.uniforms.uBaseColor.value.copy(_ambientBase);
        l.fill.material.uniforms.uOpacity.value = l.baseOpacity * cubeFade + 0.05 * cubeAmbientAmount;
    });
}

// -------- FUNCTIONS --------
/* =========================================================================
   SHARED HELPERS for anomaly builders
   ========================================================================= */
function hexWithAlpha(hex) {
    // ensures "#rrggbb" form for canvas gradients below
    const col = new THREE.Color(hex);
    return "#" + col.getHexString();
}

// Soft radial halo -- diffuse colored glow around the marker. Alpha-blended
// (not additive), so it stays visible against both light and dark
// backdrops instead of washing out on the page's light "paper" background.
function haloTexture(hex) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, hex + "cc");
    g.addColorStop(0.25, hex + "88");
    g.addColorStop(0.6, hex + "30");
    g.addColorStop(1, hex + "00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
}

// Thin reticle ring with a few radial tick marks -- the "scientific data
// marker" flourish around the halo. Rendered as a Sprite so it always faces
// the camera, and slowly rotated per-frame via material.rotation.
function ringTexture(hex) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    ctx.strokeStyle = hex;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58);
        ctx.lineTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46);
        ctx.stroke();
    }
    return new THREE.CanvasTexture(c);
}

// Holographic marker -- a small luminous core sphere (with a cheap backface
// "atmosphere" shell for radiance) plus a diffuse halo and a rotating
// reticle ring, all layered at the anomaly's position. Always visible at
// low intensity; updateAnomalies() drives the select-boosted intensity.
function buildHoloMarker(d) {
    const colorHex = hexWithAlpha(d.color);
    const coreRadius = 0.045;

    const coreMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(d.color).lerp(new THREE.Color("#ffffff"), 0.3),
        transparent: true,
        depthWrite: false,
        depthTest: false
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(coreRadius, 16, 12), coreMat);

    const rimMat = new THREE.MeshBasicMaterial({
        color: d.color,
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false
    });
    const rim = new THREE.Mesh(new THREE.SphereGeometry(coreRadius * 2.1, 16, 12), rimMat);

    const haloMat = new THREE.SpriteMaterial({
        map: haloTexture(colorHex),
        transparent: true,
        depthWrite: false,
        depthTest: false
    });
    const halo = new THREE.Sprite(haloMat);

    const ringMat = new THREE.SpriteMaterial({
        map: ringTexture(colorHex),
        transparent: true,
        depthWrite: false,
        depthTest: false
    });
    const ring = new THREE.Sprite(ringMat);

    // depthTest is off so these never fight the terrain on the z-buffer, but
    // three.js still sorts transparent objects back-to-front by camera
    // distance -- meaning a terrain face nearer the camera than the anomaly
    // behind it still gets painted AFTER (on top of) the marker, dimming it
    // out purely because of which way the cube happens to be facing.
    // renderOrder forces these to always draw after (on top of) the terrain
    // (default renderOrder 0), so the marker looks the same from any angle.
    halo.renderOrder = 1000;
    rim.renderOrder = 1001;
    core.renderOrder = 1002;
    ring.renderOrder = 1003;

    const group = new THREE.Group();
    group.add(rim, core, halo, ring);
    return { group, core, rim, halo, ring };
}
function randInSphere(r) {
    let v;
    do {
        v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    } while (v.lengthSq() > 1);
    return v.multiplyScalar(r);
}
function pointsMaterial(color, size, opacity, additive = true) {
    return new THREE.PointsMaterial({
        color,
        size,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        sizeAttenuation: true
    });
}
function circlePoints(r, n = 64, axis = "y") {
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        if (axis === "y") pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
        else if (axis === "x") pts.push(new THREE.Vector3(0, Math.cos(a) * r, Math.sin(a) * r));
        else pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    return pts;
}
function lineMat(color, opacity) {
    return new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
}

// Real geological anomalies vary hugely in size -- one broad/tall zone next
// to a much smaller, shallower one -- not a crowd of similarly-sized bumps.
// This builds two tiers as Gaussian bodies (the only way to add real spatial
// information here -- field.js's own built-in noise has a fixed spatial
// frequency, not something tunable from the call site):
//  1) REGIONAL: a handful of huge-radius-in-x/z bodies (so each is
//     effectively uniform across the horizontal extent, only varying with
//     depth) stacked at increasing depth with increasing amplitude -- their
//     overlap approximates one smooth cold-to-warm vertical gradient, same
//     as a real resistivity/IP/magnetic section reads mostly by depth.
//  2) ANOMALIES: ~35 bodies with a power-law-biased size (mostly small, a
//     few much bigger/taller ones -- see the tube-shaped reference: one
//     segment tall/wide and red, the next much lower and smaller), with
//     amplitude scaling with size so the big ones also read stronger. At
//     this grid's resolution (52 cells across x) a body's Gaussian sigma
//     needs to be roughly >0.035 in normalized units to span more than a
//     couple of voxels -- an earlier attempt with many uniformly-small
//     bodies (sigma ~1.3-2.3 voxels) was sub-pixel and rendered as
//     near-invisible noise, which is why "more detail" wasn't showing up.
// Seeded, so the layout is irregular but stable across reloads. Used by
// BUILDERS.field.

// Rounds every cell to the nearest of `bands` discrete steps across the
// field's current range, in place -- turns block.js's continuous jet()
// gradient into a banded/contoured colormap (visible color-step boundaries),
// like a real "Inverse Model Resistivity Section" figure, instead of a
// smooth blend that hides all the underlying anomaly variation inside a few
// big solid-looking color fields. Must run between field.update() and
// block.recolor() (both already separately exposed), since neither file is
// otherwise touched. Used by BUILDERS.field.
function quantizeFieldData(field, bands = 8) {
    const step = (field.range[1] - field.range[0]) / bands;
    if (!(step > 0)) return;
    const data = field.data;
    for (let i = 0; i < data.length; i++) {
        data[i] = Math.round(data[i] / step) * step;
    }
}

// Separable 3-tap box blur (radius 1) over the field's data, in place --
// smooths out field.js's own high-frequency "grain" noise term (a fixed
// spatial frequency baked into field.js, not tunable from the call site)
// that otherwise reads as speckly/pixelated once quantized into bands.
// Written without closures/helper calls in the hot loop (benchmarked ~15ms
// at this grid size otherwise vs ~9ms this way) since it's the most
// expensive step in the block's refresh -- see BLOCK_UPDATE_INTERVAL below
// for why the whole refresh is throttled slower to afford it.
function smoothFieldData(field) {
    const { nx, ny, nz, data } = field;
    const tmp = new Float32Array(data.length);

    for (let k = 0; k < nz; k++) {
        const kOff = nx * ny * k;
        for (let j = 0; j < ny; j++) {
            const base = kOff + nx * j;
            tmp[base] = (data[base] * 2 + data[base + 1]) / 3;
            for (let i = 1; i < nx - 1; i++) {
                const p = base + i;
                tmp[p] = (data[p - 1] + data[p] + data[p + 1]) * 0.33333333;
            }
            tmp[base + nx - 1] = (data[base + nx - 2] + data[base + nx - 1] * 2) / 3;
        }
    }
    data.set(tmp);

    for (let k = 0; k < nz; k++) {
        const kOff = nx * ny * k;
        for (let i = 0; i < nx; i++) {
            const base = kOff + i;
            tmp[base] = (data[base] * 2 + data[base + nx]) / 3;
            for (let j = 1; j < ny - 1; j++) {
                const p = base + nx * j;
                tmp[p] = (data[p - nx] + data[p] + data[p + nx]) * 0.33333333;
            }
            const last = base + nx * (ny - 1);
            tmp[last] = (data[last - nx] + data[last] * 2) / 3;
        }
    }
    data.set(tmp);

    const plane = nx * ny;
    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            const base = nx * j + i;
            tmp[base] = (data[base] * 2 + data[base + plane]) / 3;
            for (let k = 1; k < nz - 1; k++) {
                const p = base + plane * k;
                tmp[p] = (data[p - plane] + data[p] + data[p + plane]) * 0.33333333;
            }
            const last = base + plane * (nz - 1);
            tmp[last] = (data[last - plane] + data[last] * 2) / 3;
        }
    }
    data.set(tmp);
}

// block.js's jet() colormap is hardcoded (block.js is kept as-provided), so
// there's no option to ask block.recolor() for grayscale directly. Instead
// this runs AFTER recolor() and desaturates whatever jet() already wrote
// into the mesh's vertex-color attribute (luminance-weighted, matching how
// grayscale conversion is normally done) -- a call-site post-process, not an
// edit to block.js. Used by BUILDERS.seismic for the seismic-section look
// (classic seismic displays are grayscale/variable-density, not a
// blue-to-red heat colormap).
// `contrast` > 1 pushes values away from mid-gray (toward black/white) --
// real seismic wiggle displays read as high-contrast dark/light bands, and
// the raw luminance conversion alone was too flat/washed out.
function grayscaleBlockColors(block, contrast = 1) {
    // Attributes set via geometry.setAttribute() live under
    // geometry.attributes, not as a direct geometry.color property.
    const colorAttr = block.mesh.geometry.attributes.color;
    const arr = colorAttr.array;
    for (let i = 0; i < arr.length; i += 3) {
        let lum = arr[i] * 0.299 + arr[i + 1] * 0.587 + arr[i + 2] * 0.114;
        if (contrast !== 1) lum = Math.min(1, Math.max(0, (lum - 0.5) * contrast + 0.5));
        arr[i] = lum; arr[i + 1] = lum; arr[i + 2] = lum;
    }
    colorAttr.needsUpdate = true;
}

function generateTerrainBodies() {
    const rand = seededRandom(918273645);
    const bodies = [];

    const depthBands = 6;
    for (let i = 0; i < depthBands; i++) {
        const t = i / (depthBands - 1); // 0 = near-surface, 1 = deep
        bodies.push({
            c: [0.5, 0.92 - t * 0.84, 0.5],
            r: [3, 0.2, 3], // huge rx/rz -> effectively uniform across x/z, varies only with depth
            amp: -120 + t * 680, // cold near the surface, warm at depth
            drift: [0, (rand() - 0.5) * 0.01, 0],
            speed: 0.15 + rand() * 0.1,
            pulse: 0.05,
            phase: rand() * Math.PI * 2
        });
    }

    const anomalyCount = 35;
    for (let i = 0; i < anomalyCount; i++) {
        const sign = rand() < 0.6 ? 1 : -1;
        const sizeT = Math.pow(rand(), 1.8); // biased toward 0 (small), occasional near-1 (large)
        bodies.push({
            c: [rand(), 0.08 + rand() * 0.82, rand()],
            r: [0.035 + sizeT * 0.22, 0.03 + sizeT * 0.14, 0.035 + sizeT * 0.22],
            // Deliberately NOT scaled by sizeT -- tying amplitude to size made
            // the small anomalies both physically tiny AND low-contrast, so
            // they were doubly invisible. The reference shows a small
            // anomaly that's still clearly bright red, just physically
            // smaller -- so every anomaly gets a similarly strong amplitude
            // regardless of size, and size alone carries the big/small look.
            amp: sign * (260 + rand() * 200),
            drift: [(rand() - 0.5) * 0.02, (rand() - 0.5) * 0.012, (rand() - 0.5) * 0.02],
            speed: 0.2 + rand() * 0.35,
            pulse: 0.06 + rand() * 0.12,
            phase: rand() * Math.PI * 2
        });
    }

    return bodies;
}

// Seismic reflection data reads completely differently from a potential-field
// (magnetic/gravity) anomaly map: instead of a few localized highs/lows, it's
// dense, fine, continuous horizontal REFLECTORS -- the classic dark/light
// "wiggle" banding -- folding with depth (anticlines/synclines). A first
// attempt modeled this as ~11 thick layers built from Gaussian bodies (like
// the magnetic dataset's anomalies); that only supports a handful of thick,
// blurry bands before the per-body cost of adding more becomes too
// expensive, nowhere near a real section's dozens of thin, sharp reflectors.
// This instead adds the wiggle DIRECTLY as a sum of a few sine waves, in
// place, after field.update() -- O(cells) with no per-body cost at all, so
// it can afford far more/finer oscillation than summing bodies ever could.
// Three components at different frequencies/fold shapes (not just one pure
// sine) keep it from looking mechanically repetitive. Frequencies are tied
// to the field's own y-resolution (see BUILDERS.seismic) to stay under
// Nyquist -- too fine relative to voxel count aliases into noise instead of
// clean bands, which is why resolution had to go up alongside this rewrite.
// Used by BUILDERS.seismic.
// One SHARED fold (foldAmp/foldFreq/foldPhase below) applied to every
// frequency harmonic -- an earlier version gave each harmonic its own
// independent fold, which let them drift out of parallel with each other and
// produced a crosshatch/dashed interference pattern instead of coherent
// bands. Real reflectors all warp together as one structure; only their
// depth-wise waveform (the harmonics summed per column) varies.
const SEISMIC_FOLD = { amp: 0.14, freq: 2.1, phase: 0.6, freqZ: 1.4, phaseZ: 1.9 };
// Highest frequency kept under ~4 voxels/cycle at ny=90 (see BUILDERS.seismic)
// to stay clear of aliasing -- 28 cycles was tried and sat right at the edge.
const SEISMIC_HARMONICS = [
    { waveFreq: 8, amp: 260, phase: 0 },
    { waveFreq: 13, amp: 150, phase: 0.7 },
    { waveFreq: 18, amp: 90, phase: 1.6 },
    { waveFreq: 22, amp: 55, phase: 2.4 }
];
function applySeismicWiggle(field, t) {
    const { nx, ny, nz, data } = field;
    for (let k = 0; k < nz; k++) {
        const z = k / (nz - 1);
        const kOff = nx * ny * k;
        for (let i = 0; i < nx; i++) {
            const x = i / (nx - 1);
            // Kept close to full-strength everywhere (only dips to 0.85, not
            // 0.1 like an earlier version) -- real seismic texture is dense
            // across the whole section, and a deeper dip here was leaving
            // big blank/washed-out patches instead of organic variation.
            const envelope = 0.85 + 0.15 * Math.sin(x * 3.3 + z * 2.1 + t * 0.04);
            // Both x and z given comparable weight -- an earlier version's
            // z-term was too weak (just "+ z*0.7" inside one sine), so faces
            // where x is roughly constant (the cube's side walls) barely
            // curved at all and read as mechanically straight bands instead
            // of the same organic waviness the x-facing faces already had.
            const fold = SEISMIC_FOLD.amp * (
                0.6 * Math.sin(x * Math.PI * SEISMIC_FOLD.freq + SEISMIC_FOLD.phase) +
                0.4 * Math.sin(z * Math.PI * SEISMIC_FOLD.freqZ + SEISMIC_FOLD.phaseZ)
            );
            const rowBase = kOff + i;
            for (let j = 0; j < ny; j++) {
                const v = j / (ny - 1);
                let wiggle = 0;
                for (let h = 0; h < SEISMIC_HARMONICS.length; h++) {
                    const hm = SEISMIC_HARMONICS[h];
                    wiggle += hm.amp * Math.sin((v - fold) * hm.waveFreq * Math.PI * 2 + hm.phase);
                }
                data[rowBase + nx * j] += wiggle * envelope;
            }
        }
    }
}

/* =========================================================================
   ANOMALY BUILDERS -- one per visualization type. Each returns:
   { group, mats: [{ mat, base }], update(t) }
   Everything is parameterized by the dataset (color, radius), so swapping
   the data restyles the phenomenon automatically.
   ========================================================================= */
const BUILDERS = {

    // Glowing volumetric cloud + rotating contour rings (heavy metals)
    cloud(d) {
        const group = new THREE.Group();
        const mats = [];
        const r = d.radius;

        const count = 420;
        const pos = new Float32Array(count * 3);
        const colA = new THREE.Color(d.color);
        const colB = new THREE.Color(d.colorB || d.color);
        const colors = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            const p = randInSphere(r * 0.9).multiplyScalar(Math.pow(Math.random(), 0.6));
            pos.set([p.x, p.y, p.z], i * 3);
            const c = colA.clone().lerp(colB, p.length() / r); // gradient center -> edge
            colors.set([c.r, c.g, c.b], i * 3);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        const mat = pointsMaterial("#ffffff", 0.035, 0.85);
        mat.vertexColors = true;
        mats.push({ mat, base: 0.85 });
        group.add(new THREE.Points(geo, mat));

        const rings = [];
        [0.55, 0.75, 0.95].forEach((k, i) => {
            const m = lineMat(d.color, 0.5);
            mats.push({ mat: m, base: 0.5 });
            const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePoints(r * k)), m);
            ring.rotation.x = i * 0.5;
            group.add(ring);
            rings.push(ring);
        });

        return {
            group, mats,
            update(t) {
                group.rotation.y = t * 0.12;
                rings.forEach((ring, i) => {
                    ring.rotation.z = t * (0.15 + i * 0.07);
                    ring.rotation.x = i * 0.5 + Math.sin(t * 0.3 + i) * 0.15;
                });
            }
        };
    },

    // Blue translucent lens + particles drifting through it (groundwater)
    flow(d) {
        const group = new THREE.Group();
        const mats = [];
        const r = d.radius;

        const lensMat = new THREE.MeshBasicMaterial({
            color: d.color, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide
        });
        mats.push({ mat: lensMat, base: 0.18 });
        const lens = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), lensMat);
        lens.scale.set(1.25, 0.45, 1.0); // flattened water body
        group.add(lens);

        const tableMat = lineMat(d.colorB || d.color, 0.6);
        mats.push({ mat: tableMat, base: 0.6 });
        const table = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePoints(r * 1.25)), tableMat);
        table.position.y = r * 0.32; // water table line
        group.add(table);

        const count = 260;
        const pos = new Float32Array(count * 3);
        const seeds = [];
        for (let i = 0; i < count; i++) {
            const p = randInSphere(1);
            seeds.push(p);
            pos.set([p.x * r * 1.25, p.y * r * 0.45, p.z * r], i * 3);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const pMat = pointsMaterial(d.colorB || d.color, 0.03, 0.8);
        mats.push({ mat: pMat, base: 0.8 });
        group.add(new THREE.Points(geo, pMat));

        return {
            group, mats,
            update(t) {
                const arr = geo.attributes.position.array;
                for (let i = 0; i < count; i++) {
                    const s = seeds[i];
                    // drift along +x, wrap inside the lens, slight vertical wave
                    let x = ((s.x + t * 0.12 + 1) % 2) - 1;
                    arr[i * 3] = x * r * 1.25;
                    arr[i * 3 + 1] = (s.y + Math.sin(t * 0.8 + s.z * 6.0) * 0.05) * r * 0.45;
                    arr[i * 3 + 2] = s.z * r;
                }
                geo.attributes.position.needsUpdate = true;
                table.position.y = r * 0.32 + Math.sin(t * 0.6) * r * 0.02; // breathing water table
            }
        };
    },

    // Glowing conductive paths with animated currents (electrical conductivity)
    current(d) {
        const group = new THREE.Group();
        const mats = [];
        const r = d.radius;
        const paths = [];

        for (let p = 0; p < 6; p++) {
            const pts = [];
            const y = (p / 5 - 0.5) * r * 1.4;
            for (let i = 0; i <= 24; i++) {
                const x = (i / 24 - 0.5) * r * 2.2;
                pts.push(new THREE.Vector3(
                    x,
                    y + Math.sin(x * 7 + p * 2.1) * r * 0.16,
                    Math.cos(x * 5 + p * 1.3) * r * 0.35
                ));
            }
            const curve = new THREE.CatmullRomCurve3(pts);
            const m = lineMat(d.color, 0.45);
            mats.push({ mat: m, base: 0.45 });
            group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(60)), m));
            paths.push(curve);
        }

        // pulses travelling along the paths
        const pulsesPerPath = 3;
        const total = paths.length * pulsesPerPath;
        const pos = new Float32Array(total * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const pMat = pointsMaterial(d.colorB || d.color, 0.06, 0.95);
        mats.push({ mat: pMat, base: 0.95 });
        group.add(new THREE.Points(geo, pMat));

        const _v = new THREE.Vector3();
        return {
            group, mats,
            update(t) {
                const arr = geo.attributes.position.array;
                let k = 0;
                paths.forEach((curve, p) => {
                    for (let j = 0; j < pulsesPerPath; j++) {
                        const u = (t * (0.25 + p * 0.04) + j / pulsesPerPath + p * 0.13) % 1;
                        curve.getPoint(u, _v);
                        arr[k++] = _v.x; arr[k++] = _v.y; arr[k++] = _v.z;
                    }
                });
                geo.attributes.position.needsUpdate = true;
            }
        };
    },

    // Underground magnetic field block (CSAMT/résistivité-style voxel
    // colormap with a corner notch showing the interior). This anomaly is
    // pinned to the cube's center (see buildAnomalies below) and its block
    // is sized to fill the terrain cube exactly, so the cube itself reads as
    // this colormap once focused -- there used to also be a small dipole
    // field-line + particle animation here, but at cube-filling scale that
    // would shrink to an invisible speck fully engulfed by the solid block,
    // so it was dropped in favor of just the block.
    field(d) {
        const group = new THREE.Group();
        const mats = [];

        // field.js's default grid is 64x32x48 (~98k voxels) and every one of
        // its 4 bodies has a Gaussian radius wide enough to cover the WHOLE
        // grid (3*sigma clamps back to the full range on every axis) -- so
        // field.update(t) recomputes essentially all ~98k cells for each of
        // the 4 bodies (~393k exp() calls) on EVERY call, not just on first
        // build. At the 15fps throttle below that's still ~5.9M exp()/sec
        // while this dataset is open, which is what actually caused the
        // reported slowdown -- not the one-time buildBlock() mesh
        // construction, which only ever runs once (see the `if (!block)`
        // guard below). field.js's own DEFAULT_BODIES are a handful of
        // smooth, symmetric Gaussian blobs -- see generateTerrainBodies()
        // above for why this uses a 3-tier (regional/medium/fine) body set
        // instead, to actually look like a densely-surveyed real dataset.
        //
        // Resolution measured empirically (a Node-side benchmark timing
        // field.update()+recolor() headlessly, the same way the earlier
        // slowdown was diagnosed) rather than guessed: 60x34x48 (bumped up
        // from an earlier 52x30x42 for less voxel-pixelation at the band
        // edges) costs ~15.5ms per throttled update at this body count --
        // under a single 60fps frame's budget (~16.6ms), so the 15fps
        // throttle doesn't risk a stutter, while still resolving the
        // fine-scale bodies without the blocky/patchy look a coarser grid
        // gave them. A visibly higher resolution (e.g. 68x38x54) was tried
        // and measured at ~26ms/call -- enough to risk a periodic hitch --
        // so this is deliberately the safe side of that line.
        const magField = createField({ nx: 60, ny: 34, nz: 48, bodies: generateTerrainBodies() });
        // Calibrate the colormap range to the data actually produced (rather
        // than field.js's fixed [-150, 650] guess) using percentiles rather
        // than the true min/max. Two extremes tried: true min/max (0/100th
        // percentile) read as washed-out/mostly blue, since the real
        // extremes are rare single-voxel peaks nothing else reaches; 4th/96th
        // percentile swung the other way, pushing too much area all the way
        // to jet()'s dark-red (not bright) top end, reading as near-black
        // patches. This splits the difference (halfway between each pair),
        // landing on a middle ground between those two looks. This also
        // feeds the callout's nT range text.
        {
            const sorted = Array.from(magField.data).sort((a, b) => a - b);
            const lo = sorted[Math.floor(sorted.length * 0.01)];
            const hi = sorted[Math.floor(sorted.length * 0.99)];
            magField.range = [Math.round(lo), Math.round(hi)];
        }
        let block = null;
        let blockSize, cut;
        const BANDS = 8;
        let lastBlockUpdate = -Infinity;
        // Slowed from 15fps to 8fps to afford smoothFieldData() (see below),
        // which reduces field.js's speckly grain noise but is itself the
        // most expensive step in this refresh -- together with quantize+
        // recolor it benchmarked at ~25ms/call, too close to a single 60fps
        // frame's budget (~16.6ms) to risk doing 15x/sec. At 8fps the same
        // per-call cost only adds up to ~200ms/sec of CPU time, and the
        // anomalies drift slowly enough (see generateTerrainBodies) that the
        // coarser refresh rate isn't noticeable as choppiness.
        const BLOCK_UPDATE_INTERVAL = 1 / 8;

        return {
            group, mats, field: magField,
            update(t) {
                // Built lazily on first focus instead of eagerly for all
                // datasets at page load -- this block is the only lit/
                // vertex-colored mesh in an otherwise-unlit scene and there's
                // no reason to pay for it before it's ever seen.
                if (!block) {
                    // Matches the terrain cube's own bounds (CONFIG.cube.size
                    // on every axis, cube centered at the origin) so the
                    // block fills the cube instead of floating inside it at
                    // anomaly scale. Shrunk a bit (not exactly CONFIG.cube.size)
                    // both so its outer faces don't sit on exactly the same
                    // plane as the terrain cube's own faces (coincident
                    // geometry like that z-fights/flickers) and so it stays
                    // visibly inside the wireframe box instead of poking past
                    // its edges/corners.
                    blockSize = CONFIG.cube.size * 0.92;
                    // block.js's default `cut` only removes voxels where all
                    // three of i/j/k pass its thresholds at once -- since
                    // it's a solid opaque volume, everything inside that
                    // isn't cut away is completely invisible from outside no
                    // matter how much anomaly detail is in the data; the
                    // default notch only exposes ~15% of the volume. This
                    // widens it to ~40%, still oriented toward the same
                    // corner (+x/+y/+z, matching OVERVIEW_CAM's position) so
                    // the default camera angle looks straight into the cut.
                    cut = (i, j, k) => i > magField.nx * 0.35 && k > magField.nz * 0.3 && j > magField.ny * 0.1;
                    block = buildBlock(magField, { size: [blockSize, blockSize, blockSize], cut });
                    // block.js's material doesn't set metalness, so it defaults
                    // to Three's MeshStandardMaterial default of 0.5 -- a
                    // "half-metal" tints its specular highlight by the vertex
                    // color underneath it, which is what produced the
                    // stray colorful streak where the directional light glints
                    // off the notch's inner corner. Zeroing it out (a runtime
                    // property tweak here, not an edit to block.js itself)
                    // keeps that light a plain white highlight instead.
                    block.mesh.material.metalness = 0;
                    // Registered into `mats` (already read by the shared
                    // applyDim()/entry.dim easing every other anomaly type
                    // uses) so opening/closing this dataset crossfades the
                    // block in/out instead of popping instantly -- that pop
                    // was especially jarring since it landed right on top of
                    // this block's one-time construction cost, reading as a
                    // stutter/bug. transparent must be enabled for opacity to
                    // have any visible effect.
                    block.mesh.material.transparent = true;
                    mats.push({ mat: block.mesh.material, base: 1 });
                    group.add(block.mesh);
                    // Quantize immediately so the very first frame is already
                    // banded (see quantizeFieldData below), not just the
                    // throttled updates after it.
                    smoothFieldData(magField);
                    quantizeFieldData(magField, BANDS);
                    block.recolor();
                }
                if (t - lastBlockUpdate >= BLOCK_UPDATE_INTERVAL) {
                    // Not block.update(t) -- that does field.update() then
                    // recolor() back-to-back with no way to intervene.
                    // Calling field.update()/recolor() separately (both
                    // already exposed by field.js/block.js) lets this snap
                    // the data to discrete steps in between, turning a smooth
                    // continuous gradient into a banded/contoured colormap
                    // like a real inversion figure -- that banding is what
                    // was actually missing, not more underlying variation:
                    // the anomalies were already there, just blended away
                    // into big smooth color fields instead of visible steps.
                    // smoothFieldData() softens field.js's own high-frequency
                    // grain noise, which otherwise reads as pixelated/speckly
                    // once quantized into bands.
                    magField.update(t);
                    smoothFieldData(magField);
                    quantizeFieldData(magField, BANDS);
                    block.recolor();
                    lastBlockUpdate = t;
                }
            }
        };
    },

    // Seismic reflection block: grayscale, wavy/folded horizons (a
    // completely different look from the magnetic block's jet colormap and
    // isolated-anomaly data, matching how real seismic sections are
    // displayed). Reuses the same lazy-build/crossfade/throttle scaffolding
    // as BUILDERS.field above -- see that builder's comments for the
    // reasoning behind each piece (empirically-measured resolution, the
    // notch-widening `cut`, metalness=0, the mats/crossfade registration).
    seismic(d) {
        const group = new THREE.Group();
        const mats = [];

        // Resolution measured empirically for this analytic-wiggle approach
        // (see applySeismicWiggle above) -- the wiggle's finest frequency
        // component needs enough y-resolution to stay under Nyquist (too few
        // voxels per oscillation aliases into noise instead of clean bands),
        // so this needs a much taller grid than the magnetic block's 60x34x48
        // despite costing LESS per tick: ~18.9ms for update+recolor+grayscale
        // at 60x90x46 (Node-benchmarked headlessly, same method used
        // throughout), safely under a single 60fps frame and cheaper than the
        // body-sum approach's own ~28ms at a much coarser 34 deep.
        // field.js defaults unit to 'nT' (magnetic), not appropriate for
        // seismic amplitude -- overridden here via the same `unit` option
        // createField() already accepts. bodies: [] since the wiggle is
        // added directly to field.data instead (see applySeismicWiggle).
        const seisField = createField({ nx: 60, ny: 90, nz: 46, unit: "u.a.", bodies: [] });
        let block = null;
        let blockSize, cut;
        let lastBlockUpdate = -Infinity;
        const BLOCK_UPDATE_INTERVAL = 1 / 8;

        function refreshSeismicData(t) {
            // field.update(t) with no bodies just resets data to field.js's
            // own (cheap, bodies-free) base noise -- applySeismicWiggle then
            // adds the actual reflector pattern on top of that light texture.
            seisField.update(t);
            applySeismicWiggle(seisField, t);
        }

        return {
            group, mats, field: seisField,
            update(t) {
                if (!block) {
                    refreshSeismicData(0);
                    // Calibrated after the first real data pass (not at
                    // construction, since bodies: [] means the field starts
                    // essentially flat). Percentile-clipped rather than true
                    // min/max -- same lesson as the magnetic block: the
                    // summed-harmonics peaks only happen where several
                    // harmonics constructively line up, so true min/max left
                    // most of the section reading as washed-out pale gray.
                    // Clipping the outer ~3% pushes more of it to real
                    // black/white. Feeds the callout/legend range.
                    const sorted = Array.from(seisField.data).sort((a, b) => a - b);
                    const lo = sorted[Math.floor(sorted.length * 0.03)];
                    const hi = sorted[Math.floor(sorted.length * 0.97)];
                    seisField.range = [Math.round(lo), Math.round(hi)];

                    blockSize = CONFIG.cube.size * 0.92;
                    cut = (i, j, k) => i > seisField.nx * 0.35 && k > seisField.nz * 0.3 && j > seisField.ny * 0.1;
                    block = buildBlock(seisField, { size: [blockSize, blockSize, blockSize], cut });
                    // block.js's material is a lit MeshStandardMaterial --
                    // fine for the magnetic block (reads as a solid 3D
                    // object), but for seismic it made the block look like
                    // shiny brushed metal: the scene's lighting was
                    // overpowering the actual grayscale data, washing
                    // everything toward white instead of showing the real
                    // value contrast. A real seismic wiggle display is flat/
                    // unlit by nature, so this swaps in an unlit material
                    // (vertexColors still reads the same color attribute
                    // block.recolor() writes into) -- a call-site material
                    // swap, not an edit to block.js, same as the metalness/
                    // opacity tweaks on the magnetic block.
                    block.mesh.material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true });
                    mats.push({ mat: block.mesh.material, base: 1 });
                    group.add(block.mesh);
                    block.recolor();
                    // No quantizeFieldData()/smoothFieldData() here -- real
                    // seismic sections are a continuous grayscale/variable-
                    // density display (not discretely banded like a
                    // resistivity contour map), and smoothing would blur out
                    // the fine wiggle detail that's the whole point here.
                    // grayscaleBlockColors() runs last since it desaturates
                    // whatever block.recolor() just wrote; contrast=1.8
                    // pushes it toward the dark/light extremes real seismic
                    // wiggle bands have instead of a flat wash of mid-grays.
                    grayscaleBlockColors(block, 1.8);
                }
                if (t - lastBlockUpdate >= BLOCK_UPDATE_INTERVAL) {
                    refreshSeismicData(t);
                    block.recolor();
                    grayscaleBlockColors(block, 1.8);
                    lastBlockUpdate = t;
                }
            }
        };
    },

    // Concentric shells colored by intensity (mineral concentration)
    gradient(d) {
        const group = new THREE.Group();
        const mats = [];
        const r = d.radius;
        const shells = [0.3, 0.55, 0.8, 1.0];
        const colA = new THREE.Color(d.color);
        const colB = new THREE.Color(d.colorB || d.color);

        shells.forEach((k, s) => {
            const count = 90 + s * 70;
            const pos = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                const p = randInSphere(1).normalize().multiplyScalar(r * k * (0.96 + Math.random() * 0.08));
                pos.set([p.x, p.y, p.z], i * 3);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
            const c = colA.clone().lerp(colB, s / (shells.length - 1));
            const m = pointsMaterial("#" + c.getHexString(), 0.03, 0.85 - s * 0.14);
            mats.push({ mat: m, base: 0.85 - s * 0.14 });
            const pts = new THREE.Points(geo, m);
            pts.userData.speed = 0.05 + s * 0.03;
            group.add(pts);
        });

        return {
            group, mats,
            update(t) {
                group.children.forEach((shell, i) => {
                    shell.rotation.y = t * shell.userData.speed * (i % 2 === 0 ? 1 : -1);
                });
            }
        };
    },

    // Grayscale voxel fog (density)
    fog(d) {
        const group = new THREE.Group();
        const mats = [];
        const r = d.radius;
        const n = 8; // voxels per axis
        const positions = [];
        for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
            const p = new THREE.Vector3((x / (n - 1) - 0.5) * 2, (y / (n - 1) - 0.5) * 2, (z / (n - 1) - 0.5) * 2);
            if (p.length() > 1) continue;
            positions.push(p.multiplyScalar(r));
        }
        const pos = new Float32Array(positions.length * 3);
        positions.forEach((p, i) => pos.set([p.x, p.y, p.z], i * 3));
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const m = pointsMaterial(d.color, 0.045, 0.55, false);
        mats.push({ mat: m, base: 0.55 });
        group.add(new THREE.Points(geo, m));

        return {
            group, mats,
            update(t) {
                m.opacity = Math.max(0.0, m.userData._dim ?? 1) * (0.45 + Math.sin(t * 0.7) * 0.1);
                group.rotation.y = t * 0.05;
            }
        };
    },

    // Local micro-stratigraphy: tilted colored plates (soil composition)
    strata(d) {
        const group = new THREE.Group();
        const mats = [];
        const r = d.radius;
        const colA = new THREE.Color(d.color);
        const colB = new THREE.Color(d.colorB || d.color);
        const layers = 5;
        for (let i = 0; i < layers; i++) {
            const c = colA.clone().lerp(colB, i / (layers - 1));
            const m = new THREE.MeshBasicMaterial({
                color: c, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide
            });
            mats.push({ mat: m, base: 0.55 });
            const plate = new THREE.Mesh(new THREE.CircleGeometry(r * (1.05 - i * 0.08), 32), m);
            plate.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.18;
            plate.rotation.z = (Math.random() - 0.5) * 0.2;
            plate.position.y = (i / (layers - 1) - 0.5) * r * 1.3;
            group.add(plate);

            const em = lineMat(CONFIG.style.wireColor, 0.4);
            mats.push({ mat: em, base: 0.4 });
            // circle built in the XY plane ("z" axis) so it can share the plate's rotation
            const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePoints(r * (1.05 - i * 0.08), 64, "z")), em);
            edge.rotation.copy(plate.rotation);
            edge.position.copy(plate.position);
            group.add(edge);
        }
        return {
            group, mats,
            update(t) { group.rotation.y = t * 0.06; }
        };
    },

    // Pulsing warning rings + probability contours (environmental risk)
    risk(d) {
        const group = new THREE.Group();
        const mats = [];
        const r = d.radius;
        const rings = [];
        for (let i = 0; i < 3; i++) {
            const m = lineMat(i === 0 ? d.color : (d.colorB || d.color), 0.8);
            mats.push({ mat: m, base: 0.8 });
            const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(circlePoints(1)), m);
            ring.userData.phase = i / 3;
            group.add(ring);
            rings.push(ring);
        }
        const coreMat = new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: 0.25, depthWrite: false });
        mats.push({ mat: coreMat, base: 0.25 });
        const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 20, 14), coreMat);
        group.add(core);

        return {
            group, mats,
            update(t) {
                rings.forEach((ring) => {
                    const u = (t * 0.35 + ring.userData.phase) % 1;
                    const s = 0.2 + u * 1.0;
                    ring.scale.setScalar(s * r);
                    const dim = ring.material.userData._dim ?? 1;
                    ring.material.opacity = dim * 0.8 * (1 - u);
                });
                core.scale.setScalar(1 + Math.sin(t * 3.0) * 0.08); // pulse
            }
        };
    }
};

/* =========================================================================
   ANOMALY REGISTRY -- generated 100% from DATASETS
   ========================================================================= */
const anomalies = []; // { data, root, viz, proxy, core, rim, halo, ring, selectAmount }

// Anomalies get one fixed random position inside the cube's volume each --
// stable per dataset (seeded), never reassigned or moved afterward. Opacity
// stays constant regardless of cube rotation/orientation; only hover,
// selection, and focus change how an anomaly looks (see updateAnomalies()).
function seededRandom(seed) {
    // Hash the seed first (mulberry32) -- a raw small integer seed fed
    // straight into a linear generator produces tiny, one-sided first
    // outputs, which clustered every anomaly toward the same cube corner.
    let s = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
    s ^= s >>> 13;
    s = Math.imul(s, 0xc2b2ae35) >>> 0;
    return function () {
        s |= 0; s = (s + 0x6d2b79f5) | 0;
        let r = Math.imul(s ^ (s >>> 15), 1 | s);
        r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}
function randomVolumePosition(rand) {
    // Kept well away from the walls (not just "inside" the cube) -- some
    // builders' focused animation (e.g. "strata"/soil composition, whose
    // tilted plates span well past the anomaly's own radius) extends past
    // the anomaly's point position, and was clipping through the cube
    // walls when placed too close to the edge.
    const margin = 0.5; // fraction of `half`
    return new THREE.Vector3(
        (rand() * 2 - 1) * half * margin,
        (rand() * 2 - 1) * half * margin,
        (rand() * 2 - 1) * half * margin
    );
}
// Minimum spacing enforced between anomalies -- the RNG alone can still
// deal two points near each other, so re-roll (bounded) until every new
// point clears this distance from all previously placed ones.
const _placedPositions = [];
function randomVolumePositionSpread(rand) {
    const minDist = half * 0.5;
    let best = randomVolumePosition(rand);
    let bestScore = -Infinity;
    for (let attempt = 0; attempt < 24; attempt++) {
        const candidate = randomVolumePosition(rand);
        let nearest = Infinity;
        for (const p of _placedPositions) nearest = Math.min(nearest, candidate.distanceTo(p));
        if (_placedPositions.length === 0) { best = candidate; break; }
        if (nearest > bestScore) { bestScore = nearest; best = candidate; }
        if (nearest >= minDist) break;
    }
    _placedPositions.push(best);
    return best;
}

// "field" (magnétisme) and "seismic" both fill the whole terrain cube with a
// block instead of being a small point-sized anomaly (see BUILDERS.field/
// BUILDERS.seismic) -- several places need to treat both the same way
// (centered position, no camera fly-in/zoom, callouts anchored to the cube's
// surface instead of a small marker radius, rotation staying available while
// focused).
function isBlockDataset(viz) {
    return viz === "field" || viz === "seismic";
}

function buildAnomalies(datasets) {
    datasets.forEach((d, i) => {
        const rand = seededRandom(Math.imul(i + 1, 2654435761));

        const builder = BUILDERS[d.visualization] || BUILDERS.cloud;
        const viz = builder(d);

        const root = new THREE.Group();
        // "field" (Réponse magnétique) fills the whole terrain cube once
        // focused (see BUILDERS.field/buildBlock below) instead of sitting
        // at a small random offset like the other anomaly types, so it stays
        // centered on the cube instead of being placed off-center inside it.
        if (isBlockDataset(d.visualization)) root.position.set(0, 0, 0);
        else root.position.copy(randomVolumePositionSpread(rand));
        root.add(viz.group);

        // Holographic marker: what you see (and click) through the terrain
        // in overview -- always visible, subtle at rest (see updateAnomalies).
        const marker = buildHoloMarker(d);
        root.add(marker.group);

        // Invisible raycast proxy
        const proxy = new THREE.Mesh(
            new THREE.SphereGeometry(d.radius * 1.15, 12, 10),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        proxy.userData.anomaly = null; // filled below
        root.add(proxy);

        cubeRoot.add(root);

        const entry = {
            data: d, root, viz, proxy,
            core: marker.core, rim: marker.rim, halo: marker.halo, ring: marker.ring,
            selectAmount: 0, dim: 1
        };
        proxy.userData.anomaly = entry;
        anomalies.push(entry);
    });
}

/* =========================================================================
   DOM -- header caption, hover tag, callouts, retour, SVG leader lines
   ========================================================================= */
const svgNS = "http://www.w3.org/2000/svg";
const calloutSvg = document.createElementNS(svgNS, "svg");
calloutSvg.setAttribute("class", "donnees-callout-svg");
document.body.appendChild(calloutSvg);

const ui = document.createElement("div");
ui.className = "donnees-ui";
document.body.appendChild(ui);

const caption = document.createElement("div");
caption.className = "donnees-caption";
ui.appendChild(caption);

// Simple axis framing (profondeur / profile distance) so the cube reads as
// a real cross-section instead of an abstract shape, echoing the axes on a
// typical CSAMT/résistivité block figure. Static labels, not tied to the
// cube's live rotation -- a lightweight sense of "this is X/Y data", not a
// full tick/gridline system.
const axisDepth = document.createElement("div");
axisDepth.className = "donnees-axis-label donnees-axis-depth";
axisDepth.textContent = "Profondeur (m)";
ui.appendChild(axisDepth);

const axisProfile = document.createElement("div");
axisProfile.className = "donnees-axis-label donnees-axis-profile";
axisProfile.textContent = "Profile distance (m)";
ui.appendChild(axisProfile);

// Same value->color mapping as block.js's own internal `jet()` (duplicated
// here, not imported -- block.js doesn't export it, and this is just a
// legend swatch, not the actual coloring logic) so the legend always matches
// what's drawn on the block.
function jetColor(x) {
    const c = (v) => Math.min(Math.max(v, 0), 1);
    return [c(1.5 - Math.abs(4 * x - 3)), c(1.5 - Math.abs(4 * x - 2)), c(1.5 - Math.abs(4 * x - 1))];
}

// A visible colormap key, like the "Resistivity (Ω·m)" legend on a real
// inversion figure -- built as a plain canvas gradient (no Lut/addons import:
// this project loads Three as a classic global script with no import map,
// so `three/addons/...` modules can't resolve here, same issue as the
// bare 'three' specifier earlier).
// One legend per dataset visualization type, toggled by startFocus/
// startReturn -- each stays hidden until that dataset is actually opened.
// Keyed by `d.visualization` since that's what identifies which entry is
// focused elsewhere (see startFocus).
const legendEls = {};

function buildLegend(title, unit, range, colorFn) {
    const wrap = document.createElement("div");
    wrap.className = "donnees-legend";
    wrap.style.opacity = "0";
    wrap.style.transition = "opacity 0.4s ease";

    const titleEl = document.createElement("div");
    titleEl.className = "donnees-legend-title";
    titleEl.textContent = `${title} (${unit})`;
    wrap.appendChild(titleEl);

    const row = document.createElement("div");
    row.className = "donnees-legend-row";

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 128;
    canvas.className = "donnees-legend-bar";
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
        const t = 1 - y / (canvas.height - 1); // top = high value, bottom = low value
        const [r, g, b] = colorFn(t);
        const idx = y * 4;
        img.data[idx] = r * 255;
        img.data[idx + 1] = g * 255;
        img.data[idx + 2] = b * 255;
        img.data[idx + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);

    const ticks = document.createElement("div");
    ticks.className = "donnees-legend-ticks";
    const mid = Math.round((range[0] + range[1]) / 2);
    ticks.innerHTML = `<span>${range[1]}</span><span>${mid}</span><span>${range[0]}</span>`;

    row.appendChild(canvas);
    row.appendChild(ticks);
    wrap.appendChild(row);
    ui.appendChild(wrap);
    return wrap;
}
function buildFieldLegend(field) {
    return buildLegend("Champ magnétique", field.unit, field.range, jetColor);
}
// Matches grayscaleBlockColors()'s own luminance conversion so the legend's
// gradient actually corresponds to what's drawn on the block.
function grayColor(t) { return [t, t, t]; }
function buildSeismicLegend(field) {
    return buildLegend("Amplitude sismique", field.unit, field.range, grayColor);
}

const hoverTag = document.createElement("div");
hoverTag.className = "donnees-hover-tag";
ui.appendChild(hoverTag);

const backLink = document.createElement("button");
backLink.className = "donnees-back";
backLink.textContent = "← retour au terrain";
ui.appendChild(backLink);

function setCaption(count) {
    caption.innerHTML = `<span class="donnees-caption-num">${String(count).padStart(2, "0")}</span> anomalies détectées · survoler le cube ou utiliser la liste →`;
}

/* =========================================================================
   ANOMALY LIST -- a side panel of buttons so the datasets can be read without
   hunting for their glow in the cube. Each row expands to its full description
   + metrics, and carries an "explorer" link that flies the camera in (same as
   clicking the anomaly directly). Built 100% from the entries, in list order.
   ========================================================================= */
const listPanel = document.createElement("aside");
listPanel.className = "donnees-list";
listPanel.innerHTML = `<div class="donnees-list-head">anomalies</div>
    <div class="donnees-list-items"></div>`;
ui.appendChild(listPanel);
const listItemsWrap = listPanel.querySelector(".donnees-list-items");

function setListVisible(visible) {
    listPanel.classList.toggle("is-hidden", !visible);
}
setListVisible(false); // shown once the intro fade finishes (see updateIntro)

function buildAnomalyList(entries) {
    listItemsWrap.innerHTML = "";
    entries.forEach((entry) => {
        const d = entry.data;
        const item = document.createElement("div");
        item.className = "donnees-list-item";
        item.innerHTML = `
            <button class="donnees-list-btn" type="button">
                <span class="donnees-list-dot" style="background:${d.color}"></span>
                <span class="donnees-list-num">${d.id}</span>
                <span class="donnees-list-title">${d.title}</span>
                <span class="donnees-list-caret">+</span>
            </button>
            <div class="donnees-list-detail">
                <div class="donnees-list-detail-inner">
                    <p class="donnees-list-desc">${d.description}</p>
                    <dl class="donnees-list-meta">
                        <div><dt>profondeur</dt><dd>${d.depth}</dd></div>
                        <div><dt>intensité</dt><dd>${d.intensity}</dd></div>
                        <div><dt>confiance</dt><dd>${d.confidence}</dd></div>
                        <div><dt>volume affecté</dt><dd>${d.affectedVolume}</dd></div>
                    </dl>
                    <button class="donnees-list-explore" type="button">explorer dans le cube →</button>
                </div>
            </div>`;

        const btn = item.querySelector(".donnees-list-btn");
        const explore = item.querySelector(".donnees-list-explore");

        // Expand/collapse this row (accordion: only one open at a time).
        // Opening it selects the matching anomaly in the cube -- its glow
        // intensifies while the others stay in their normal state; closing
        // it (or opening a different row) clears the highlight. Click-driven
        // only -- no hover effect.
        btn.addEventListener("click", () => {
            const alreadyOpen = item.classList.contains("is-open");
            listItemsWrap.querySelectorAll(".donnees-list-item.is-open")
                .forEach((el) => el.classList.remove("is-open"));
            if (!alreadyOpen) {
                item.classList.add("is-open");
                selectedEntry = entry;
            } else {
                selectedEntry = null;
            }
        });

        explore.addEventListener("click", () => {
            if (state === "overview") startFocus(entry);
        });

        listItemsWrap.appendChild(item);
    });
}

/* Callouts for the focused dataset: a main card + metric tags, each with an
   elbowed leader line anchored to a point on the anomaly itself. */
let activeCallouts = null; // { items: [{ el, line, dot, anchorLocal, elbow, align }] }

function clearCallouts() {
    if (!activeCallouts) return;
    activeCallouts.items.forEach((it) => {
        it.el.remove();
        it.line.remove();
        it.dot.remove();
    });
    activeCallouts = null;
}

function buildCallouts(entry) {
    clearCallouts();
    const d = entry.data;
    // Block-type datasets (see isBlockDataset) fill the whole terrain cube,
    // so their callout leader lines should anchor to the cube's surface
    // (half the cube's edge length), not to the small marker radius the
    // other (point-anomaly) dataset types use.
    const r = isBlockDataset(d.visualization) ? CONFIG.cube.size / 2 : d.radius;
    const items = [];

    function makeItem({ html, className, anchorLocal, screen, elbow, align }) {
        const el = document.createElement("div");
        el.className = "donnees-callout " + (className || "");
        el.innerHTML = html;
        Object.assign(el.style, screen);
        ui.appendChild(el);

        const line = document.createElementNS(svgNS, "polyline");
        line.setAttribute("fill", "none");
        line.style.stroke = "var(--nav-line-color, " + CONFIG.style.lineColor + ")";
        line.setAttribute("stroke-width", "1");
        line.setAttribute("stroke-opacity", "0.55");
        calloutSvg.appendChild(line);

        const dot = document.createElementNS(svgNS, "circle");
        dot.setAttribute("r", "3");
        dot.style.fill = "var(--nav-line-color, " + CONFIG.style.lineColor + ")";
        calloutSvg.appendChild(dot);

        items.push({ el, line, dot, anchorLocal, elbow, align });
    }

    makeItem({
        className: "donnees-callout-main",
        html: `
          <div class="donnees-callout-eyebrow">dataset ${d.id} · ${d.notes}</div>
          <h2>${d.title}</h2>
          <p>${d.description}</p>
          ${d.image2D
                ? `<img class="donnees-callout-image" src="${d.image2D}" alt="${d.title} -- vue 2D">`
                : `<div class="donnees-callout-image donnees-callout-image-placeholder">image des données en 2D<br><span>à ajouter</span></div>`}`,
        anchorLocal: new THREE.Vector3(0, r * 1.05, 0),
        screen: { right: "6%", top: "16%", maxWidth: "300px" },
        elbow: { dx: 90, dy: -70 },
        align: "left"
    });

    makeItem({
        html: `<span>profondeur</span>${d.depth}`,
        anchorLocal: new THREE.Vector3(-r * 1.05, r * 0.2, 0),
        screen: { left: "7%", top: "38%" },
        elbow: { dx: -90, dy: -30 },
        align: "right"
    });

    makeItem({
        html: `<span>intensité</span>${d.intensity} · <span>confiance</span>${d.confidence}`,
        anchorLocal: new THREE.Vector3(-r * 0.7, -r * 0.95, 0),
        screen: { left: "10%", top: "64%" },
        elbow: { dx: -70, dy: 50 },
        align: "right"
    });

    makeItem({
        html: `<span>volume affecté</span>${d.affectedVolume}`,
        anchorLocal: new THREE.Vector3(r * 1.0, -r * 0.6, 0),
        screen: { right: "9%", top: "62%" },
        elbow: { dx: 80, dy: 60 },
        align: "left"
    });

    // Extra callout for block-type datasets -- both BUILDERS.field and
    // BUILDERS.seismic expose a `field` on entry.viz, so this is keyed by
    // visualization type (not just "does entry.viz.field exist") to show the
    // right unit/wording for each.
    if (d.visualization === "field" && entry.viz.field) {
        const f = entry.viz.field;
        makeItem({
            html: `<span>champ magnétique</span>${f.range[0]} à ${f.range[1]} ${f.unit}<br>Les zones rouges montrent des roches plus magnétiques, souvent riches en minéraux ferreux.`,
            anchorLocal: new THREE.Vector3(0, -r * 1.05, 0),
            screen: { left: "50%", bottom: "8%", maxWidth: "280px" },
            elbow: { dx: 0, dy: 70 },
            align: "left"
        });
    }
    if (d.visualization === "seismic" && entry.viz.field) {
        const f = entry.viz.field;
        makeItem({
            html: `<span>amplitude sismique</span>${f.range[0]} à ${f.range[1]} ${f.unit}<br>Les bandes claires/sombres alternées marquent les changements de densité entre les couches du sous-sol.`,
            anchorLocal: new THREE.Vector3(0, -r * 1.05, 0),
            screen: { left: "50%", bottom: "8%", maxWidth: "280px" },
            elbow: { dx: 0, dy: 70 },
            align: "left"
        });
    }

    activeCallouts = { entry, items };

    // fade in
    items.forEach((it, i) => {
        it.el.style.opacity = "0";
        it.el.style.transform = "translateY(6px)";
        setTimeout(() => {
            it.el.style.opacity = "1";
            it.el.style.transform = "translateY(0)";
        }, 350 + i * 130);
    });
}

const _calloutWorld = new THREE.Vector3();
function updateCallouts() {
    if (!activeCallouts) return;
    const entry = activeCallouts.entry;
    activeCallouts.items.forEach((it) => {
        _calloutWorld.copy(it.anchorLocal); // root scale is applied by localToWorld
        entry.root.localToWorld(_calloutWorld);
        _calloutWorld.project(camera);
        const x1 = (_calloutWorld.x * 0.5 + 0.5) * window.innerWidth;
        const y1 = (-_calloutWorld.y * 0.5 + 0.5) * window.innerHeight;
        const xm = x1 + it.elbow.dx;
        const ym = y1 + it.elbow.dy;
        const rect = it.el.getBoundingClientRect();
        const x2 = it.align === "left" ? rect.left : rect.right;
        const y2 = rect.top + rect.height / 2;
        it.line.setAttribute("points", `${x1},${y1} ${xm},${ym} ${x2},${y2}`);
        it.dot.setAttribute("cx", x1);
        it.dot.setAttribute("cy", y1);
    });
}

/* =========================================================================
   INTERACTION + STATE MACHINE
   overview  : auto-rotate + parallax, hover glows, click -> focus
   focusing  : camera tween + clip opening
   focus     : callouts visible, retour available
   returning : reverse tween back to overview
   ========================================================================= */
let state = "overview";
let focused = null;
let hoveredEntry = null;
let selectedEntry = null; // anomaly highlighted via the list panel ("+"/row click)

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-10, -10);
const mousePx = { x: -100, y: -100 };

const tween = {
    t: 0,
    camFrom: new THREE.Vector3(), camTo: new THREE.Vector3(),
    lookFrom: new THREE.Vector3(), lookTo: new THREE.Vector3(),
    cubeFadeFrom: 1, cubeFadeTo: 1,
    scaleFrom: 1, scaleTo: 1
};
const lookCurrent = new THREE.Vector3(0, 0, 0);

function smoothstep(t) { return t * t * (3 - 2 * t); }

function startFocus(entry) {
    focused = entry;
    selectedEntry = null; // focus supersedes the list-panel highlight
    state = "focusing";
    hoverTag.style.opacity = "0";

    // Anomaly world position with the cube's current (now frozen) rotation
    const anomalyWorld = new THREE.Vector3();
    entry.root.getWorldPosition(anomalyWorld);

    tween.t = 0;
    tween.camFrom.copy(camera.position);

    if (isBlockDataset(entry.data.visualization)) {
        // This dataset's visualization already fills the whole terrain cube
        // (see BUILDERS.field/BUILDERS.seismic) -- flying the camera in
        // close and scaling the anomaly up, like the other (small,
        // point-sized) anomaly types do, would zoom past its own faces
        // instead of showing them. Keep the camera and cube exactly as they
        // are and just bring up the callouts.
        tween.camTo.copy(camera.position);
        tween.lookFrom.copy(lookCurrent);
        tween.lookTo.set(0, 0, 0);
        tween.cubeFadeFrom = cubeFade;
        tween.cubeFadeTo = cubeFade;
        tween.scaleFrom = entry.root.scale.x;
        tween.scaleTo = 1;
    } else {
        // Camera flies to a point past the anomaly, along center->anomaly
        const dir = anomalyWorld.clone().sub(cubeRoot.position);
        if (dir.lengthSq() < 0.0001) dir.set(0.5, 0.3, 1);
        dir.normalize();
        const camTo = anomalyWorld.clone().add(dir.multiplyScalar(CONFIG.focus.cameraDistance)).add(new THREE.Vector3(0, 0.25, 0));

        tween.camTo.copy(camTo);
        tween.lookFrom.copy(lookCurrent);
        tween.lookTo.copy(anomalyWorld);
        // Cube fades down instead of clipping open, so the anomaly reads clearly
        // through what was the (now translucent) terrain shell.
        tween.cubeFadeFrom = cubeFade;
        tween.cubeFadeTo = CONFIG.focus.dimOthers;
        tween.scaleFrom = entry.root.scale.x;
        tween.scaleTo = CONFIG.focus.anomalyScale;
    }

    setTimeout(() => buildCallouts(entry), CONFIG.focus.flyDuration * 700);
    backLink.style.opacity = "1";
    backLink.style.pointerEvents = "auto";
    caption.style.opacity = "0";
    setListVisible(false);
    renderer.domElement.style.cursor = "default";
    if (legendEls[entry.data.visualization]) legendEls[entry.data.visualization].style.opacity = "1";
}

function startReturn() {
    if (!focused) return;
    state = "returning";
    clearCallouts();
    backLink.style.opacity = "0";
    backLink.style.pointerEvents = "none";
    if (legendEls[focused.data.visualization]) legendEls[focused.data.visualization].style.opacity = "0";

    tween.t = 0;
    tween.camFrom.copy(camera.position);
    tween.camTo.copy(OVERVIEW_CAM);
    tween.lookFrom.copy(lookCurrent);
    tween.lookTo.set(0, 0, 0);
    tween.cubeFadeFrom = cubeFade;
    tween.cubeFadeTo = 1;
    tween.scaleFrom = focused.root.scale.x;
    tween.scaleTo = 1;
}

// -------- EVENTS --------
backLink.addEventListener("click", startReturn);
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (state === "focus" || state === "focusing")) startReturn();
});

// Free rotation: drag anywhere to turn the terrain; a clean click (no drag)
// on an anomaly opens it. Parallax stays layered on top of the user rotation.
let rotY = CONFIG.cube.baseRotationY;
let rotXUser = CONFIG.cube.baseRotationX;
const drag = { active: false, moved: false, lastX: 0, lastY: 0 };

// Rotation stays available while a block-type dataset is focused -- unlike
// the other (point-anomaly) dataset types, opening one never flies the
// camera in or scales anything (see startFocus), so there's no reason
// dragging to turn the cube should stop working just because it's open.
function canRotateCube() {
    return state === "overview" || (state === "focus" && focused && isBlockDataset(focused.data.visualization));
}

renderer.domElement.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    mousePx.x = e.clientX;
    mousePx.y = e.clientY;

    if (drag.active && canRotateCube()) {
        const dx = e.clientX - drag.lastX;
        const dy = e.clientY - drag.lastY;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        rotY += dx * 0.005;
        rotXUser = Math.min(0.55, Math.max(-0.55, rotXUser + dy * 0.003));
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
    }

    // Hover is only ever (re)computed here, in direct response to a real
    // pointer movement -- never once per animation frame. The cube keeps
    // rotating on its own (auto-rotate/parallax) while the mouse stays put,
    // and re-raycasting every frame against a static screen position would
    // pick up anomalies just drifting past the cursor, lighting them up as
    // if hovered even though nothing was actually pointed at.
    // While actively dragging, the pointer is busy spinning the cube (not
    // pointing at content) and moves every frame right alongside anomalies
    // sweeping across the screen from that same rotation -- raycasting
    // during a drag would keep tripping the same false "hovered" flashes.
    if (!drag.active) evaluateHover();
});
renderer.domElement.addEventListener("pointerleave", () => {
    setHoveredEntry(null);
});

renderer.domElement.addEventListener("pointerdown", (e) => {
    drag.active = true;
    drag.moved = false;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
});

window.addEventListener("pointerup", () => {
    if (drag.active && !drag.moved && state === "overview" && hoveredEntry) {
        startFocus(hoveredEntry);
    }
    drag.active = false;
});

function setHoveredEntry(entry) {
    if (entry === hoveredEntry) return;
    hoveredEntry = entry;
    if (entry) {
        hoverTag.innerHTML = `<span>${entry.data.id}</span> ${entry.data.title}`;
        hoverTag.style.opacity = "1";
    } else {
        hoverTag.style.opacity = "0";
    }
    renderer.domElement.style.cursor = entry ? "pointer" : "default";
}

// Raycast against the anomalies -- only ever called from an actual pointer
// event (pointermove/pointerleave), never once per animation frame (see the
// pointermove listener above for why).
function evaluateHover() {
    if (state !== "overview") { setHoveredEntry(null); return; }
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(anomalies.map((a) => a.proxy));
    setHoveredEntry(hits.length ? hits[0].object.userData.anomaly : null);
}

// Per-frame: no new raycast, just keep the hover tag glued to the cursor
// and clear hover if something (e.g. focusing) left overview state.
function updateHover() {
    if (state !== "overview") { setHoveredEntry(null); return; }
    if (hoveredEntry) {
        hoverTag.style.left = mousePx.x + 18 + "px";
        hoverTag.style.top = mousePx.y - 10 + "px";
    }
}

/* =========================================================================
   PER-FRAME UPDATES
   ========================================================================= */
function applyDim(entry) {
    entry.viz.mats.forEach(({ mat, base }) => {
        mat.userData._dim = entry.dim;
        mat.opacity = base * entry.dim;
    });
}

const _entryWorldPos = new THREE.Vector3();
const OVERVIEW_CAM_DIST = OVERVIEW_CAM.length();
function updateAnomalies(t) {
    anomalies.forEach((entry) => {
        const isActive = entry === focused; // fully revealed + animated only once clicked open

        // Perspective compensation: a point sitting nearer the camera
        // naturally renders bigger (and so reads as "brighter/more opaque")
        // purely from normal 3D projection -- nothing to do with cube
        // orientation, but it looks identical to it since anomalies move
        // closer/farther as the cube turns. Scaling each marker up or down
        // by its actual camera distance cancels that out so its on-screen
        // size (and apparent brightness) stays constant no matter where the
        // cube has rotated it to. Skipped once focused -- the zoom-in shot
        // already accounts for the camera being close on purpose.
        let distComp = 1;
        if (!isActive) {
            cubeRoot.localToWorld(_entryWorldPos.copy(entry.root.position));
            distComp = camera.position.distanceTo(_entryWorldPos) / OVERVIEW_CAM_DIST;
        }

        // Marker highlight: boosted while this entry is selected in the list
        // panel, hovered directly in the cube, or focused/focusing -- eased,
        // and gone the moment none of those are true anymore.
        const targetSelect = (entry === selectedEntry || entry === hoveredEntry || isActive) ? 1 : 0;
        entry.selectAmount += (targetSelect - entry.selectAmount) * 0.12;

        // The full visualization stays hidden at rest (only the holo marker
        // below signals it) and only reveals + animates once clicked open --
        // hidden outright (not just dimmed) so a builder's un-animated
        // initial geometry (e.g. "risk"'s rings, sized before their first
        // update() call) never renders as a stray permanent shape. Stays
        // visible a little past isActive going false so the crossfade
        // (entry.dim easing toward CONFIG.focus.dimOthers below, read by
        // BUILDERS.field's block material) has time to actually play out
        // instead of the group vanishing mid-fade.
        entry.viz.group.visible = isActive || entry.dim > CONFIG.focus.dimOthers + 0.02;
        const targetDim = isActive ? 1 : CONFIG.focus.dimOthers;
        entry.dim += (targetDim - entry.dim) * 0.08;
        applyDim(entry);

        // Holographic marker -- consistent brightness/opacity regardless of
        // cube rotation or orientation; only hover/selection/focus (below)
        // change how it looks.
        const othersFocusedMult = (focused && !isActive) ? 0.15 : 1;
        const s = entry.selectAmount;
        const idlePulse = 1 + Math.sin(t * 0.9 + entry.root.position.x * 5) * 0.08; // slow, always-on breathing
        const selectPulse = 1 + Math.sin(t * 3.0 + entry.root.position.x * 5) * 0.22 * s; // stronger pulse once selected
        const pulse = idlePulse * selectPulse;

        // Once actually zoomed in, the point-marker chrome (core/rim/ring)
        // disappears entirely -- focus is the glow (halo) + the animation
        // above, nothing else drawn around the focal point.
        const markerFade = isActive ? 0 : 1;

        entry.core.material.opacity = (0.5 + s * 0.35) * pulse * othersFocusedMult * markerFade;
        entry.core.scale.setScalar(distComp);

        entry.rim.material.opacity = (0.2 + s * 0.4) * pulse * othersFocusedMult * markerFade;
        entry.rim.scale.setScalar((1 + s * 0.6) * distComp);

        entry.halo.material.opacity = (0.16 + s * 0.45) * pulse * othersFocusedMult;
        entry.halo.scale.setScalar(entry.data.radius * (1.7 + s * 1.3) * pulse * distComp);

        entry.ring.material.opacity = (0.06 + s * 0.55) * othersFocusedMult * markerFade;
        entry.ring.material.rotation = t * (0.1 + s * 0.35);
        entry.ring.scale.setScalar(entry.data.radius * (2.2 + s * 1.6) * distComp);

        // The anomaly's own animation (particles, currents, rings...) only
        // plays once it's actually focused -- otherwise it stays frozen.
        if (isActive) entry.viz.update(t);
    });
}

function updateTween(dt) {
    if (state !== "focusing" && state !== "returning") return;
    tween.t = Math.min(tween.t + dt / CONFIG.focus.flyDuration, 1);
    const e = smoothstep(tween.t);

    camera.position.lerpVectors(tween.camFrom, tween.camTo, e);
    lookCurrent.lerpVectors(tween.lookFrom, tween.lookTo, e);
    cubeFade = tween.cubeFadeFrom + (tween.cubeFadeTo - tween.cubeFadeFrom) * e;
    applyCubeFade(cubeFade);
    if (focused) focused.root.scale.setScalar(tween.scaleFrom + (tween.scaleTo - tween.scaleFrom) * e);

    if (tween.t >= 1) {
        if (state === "focusing") {
            state = "focus";
        } else {
            state = "overview";
            focused = null;
            selectedEntry = null;
            caption.style.opacity = "1";
            setListVisible(true);
        }
    }
}

let bgDotsX = 0, bgDotsY = 0;
function updateBackgroundParallax() {
    const { strength, ease } = CONFIG.background.dotParallax;
    bgDotsX += (-mouse.x * strength - bgDotsX) * ease;
    bgDotsY += (mouse.y * strength - bgDotsY) * ease;
    bgDots.style.transform = `translate(${bgDotsX.toFixed(2)}px, ${bgDotsY.toFixed(2)}px)`;
}

/* =========================================================================
   INTRO FADE
   ========================================================================= */
let introElapsed = 0;
function updateIntro(dt) {
    if (introElapsed >= CONFIG.intro.duration) return;
    introElapsed += dt;
    const e = smoothstep(Math.min(introElapsed / CONFIG.intro.duration, 1));
    renderer.domElement.style.opacity = e;
    ui.style.opacity = e;
    calloutSvg.style.opacity = e;
    if (introElapsed >= CONFIG.intro.duration) setListVisible(true);
}
renderer.domElement.style.opacity = 0;
ui.style.opacity = 0;

/* =========================================================================
   ANIMATION LOOP
   ========================================================================= */
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    sharedTime.value += dt;
    const t = sharedTime.value;

    updateIntro(dt);
    updateHover();
    updateCubeAmbient();
    updateTween(dt);
    updateAnomalies(t);
    updateBackgroundParallax();

    if (canRotateCube()) {
        if (!drag.active) rotY += CONFIG.cube.autoRotateSpeed;
        const targetRotY = rotY + mouse.x * CONFIG.cube.parallax.strengthY;
        const targetRotX = rotXUser - mouse.y * CONFIG.cube.parallax.strengthX;
        cubeRoot.rotation.y += (targetRotY - cubeRoot.rotation.y) * (drag.active ? 0.35 : CONFIG.cube.parallax.ease);
        cubeRoot.rotation.x += (targetRotX - cubeRoot.rotation.x) * (drag.active ? 0.35 : CONFIG.cube.parallax.ease);
    }
    if (state === "overview") {
        camera.position.lerp(OVERVIEW_CAM, 0.04);
        lookCurrent.lerp(new THREE.Vector3(0, 0, 0), 0.04);
    } else if (state === "focus") {
        // tiny parallax drift around the anomaly, so the shot stays alive
        const drift = new THREE.Vector3(mouse.x * 0.08, mouse.y * 0.06, 0);
        camera.position.lerp(tween.camTo.clone().add(drift), 0.05);
    }
    camera.lookAt(lookCurrent);

    renderer.render(scene, camera);
    updateCallouts();
}

/* =========================================================================
   BOOT -- fetch real data if present, otherwise placeholders
   ========================================================================= */
function boot(datasets) {
    buildAnomalies(datasets);
    buildAnomalyList(anomalies);
    setCaption(datasets.length);
    // A legend for each block's colormap, like the "Resistivity (Ω·m)" key
    // in a real inversion figure -- built now (each block-based entry
    // exposes its `field` (range/unit) on `entry.viz`, same data
    // buildCallouts reads), but stays hidden (see startFocus/startReturn)
    // until that dataset is actually opened -- showing it over an empty cube
    // would be misleading.
    const fieldEntry = anomalies.find((a) => a.data.visualization === "field");
    if (fieldEntry) legendEls.field = buildFieldLegend(fieldEntry.viz.field);
    const seismicEntry = anomalies.find((a) => a.data.visualization === "seismic");
    if (seismicEntry) legendEls.seismic = buildSeismicLegend(seismicEntry.viz.field);
    animate();
}

fetch("./geo3d-donnees.json")
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((json) => boot(Array.isArray(json) ? json : json.datasets || DATASETS))
    .catch(() => boot(DATASETS));

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});