const h = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
const L = (a, b, t) => a + (b - a) * t, S = t => t * t * (3 - 2 * t);
function vnoise(x, y, z) {
  const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
  const fx = S(x - X), fy = S(y - Y), fz = S(z - Z), c = (i, j, k) => h(X + i, Y + j, Z + k);
  return L(L(L(c(0,0,0), c(1,0,0), fx), L(c(0,1,0), c(1,1,0), fx), fy),
           L(L(c(0,0,1), c(1,0,1), fx), L(c(0,1,1), c(1,1,1), fx), fy), fz);
}
function fbm(x, y, z) { let v = 0, a = 0.5, f = 1; for (let o = 0; o < 4; o++) { v += a * vnoise(x * f, y * f, z * f); a *= 0.5; f *= 2; } return v; }

// c = centre normalisé (0..1, y=1 surface), r = rayons, amp en nT
export const DEFAULT_BODIES = [
  { c: [0.45, 0.35, 0.5], r: [0.18, 0.25, 0.2], amp: 520, drift: [0.05, 0.04, 0], speed: 0.6, pulse: 0.25, phase: 0 },
  { c: [0.7, 0.5, 0.35],  r: [0.12, 0.2, 0.15], amp: 320, drift: [0, 0.06, 0.04], speed: 0.9, pulse: 0.3, phase: 1.7 },
  { c: [0.2, 0.75, 0.6],  r: [0.15, 0.1, 0.2],  amp: -140, drift: [0.04, 0, 0], speed: 0.5, pulse: 0.2, phase: 3.1 },
  { c: [0.85, 0.8, 0.8],  r: [0.12, 0.08, 0.15], amp: -120, drift: [0, 0, 0.05], speed: 0.7, pulse: 0.2, phase: 4.2 },
];

export function createField({ nx = 64, ny = 32, nz = 48, range = [-150, 650], unit = 'nT', seed = 1, bodies = DEFAULT_BODIES } = {}) {
  const n = nx * ny * nz, base = new Float32Array(n), data = new Float32Array(n);
  const id = (i, j, k) => i + nx * (j + ny * k);

  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const u = i / (nx - 1), v = j / (ny - 1), w = k / (nz - 1), depth = 1 - v;
    const strata = 45 * Math.sin(depth * 10 + fbm(u * 3 + seed, v * 3, w * 3) * 4);
    const grain = 110 * (fbm(u * 5, v * 5 + seed, w * 5) - 0.5);
    base[id(i, j, k)] = strata + grain + 60 * depth;
  }

  function update(t) {
    data.set(base);
    for (const b of bodies) {
      const s = Math.sin(t * b.speed + b.phase);
      const cx = b.c[0] + b.drift[0] * s, cy = b.c[1] + b.drift[1] * s, cz = b.c[2] + b.drift[2] * s;
      const amp = b.amp * (1 + b.pulse * Math.sin(t * b.speed * 1.7 + b.phase));
      const [rx, ry, rz] = b.r;
      const i0 = Math.max(0, Math.floor((cx - 3 * rx) * (nx - 1))), i1 = Math.min(nx - 1, Math.ceil((cx + 3 * rx) * (nx - 1)));
      const j0 = Math.max(0, Math.floor((cy - 3 * ry) * (ny - 1))), j1 = Math.min(ny - 1, Math.ceil((cy + 3 * ry) * (ny - 1)));
      const k0 = Math.max(0, Math.floor((cz - 3 * rz) * (nz - 1))), k1 = Math.min(nz - 1, Math.ceil((cz + 3 * rz) * (nz - 1)));
      for (let k = k0; k <= k1; k++) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = (i / (nx - 1) - cx) / rx, dy = (j / (ny - 1) - cy) / ry, dz = (k / (nz - 1) - cz) / rz;
        data[id(i, j, k)] += amp * Math.exp(-(dx * dx + dy * dy + dz * dz));
      }
    }
  }

  function sample(u, v, w) {
    const x = Math.min(Math.max(u, 0), 1) * (nx - 1), y = Math.min(Math.max(v, 0), 1) * (ny - 1), z = Math.min(Math.max(w, 0), 1) * (nz - 1);
    const i = Math.min(Math.floor(x), nx - 2), j = Math.min(Math.floor(y), ny - 2), k = Math.min(Math.floor(z), nz - 2);
    const fx = x - i, fy = y - j, fz = z - k, d = (a, b, c) => data[id(i + a, j + b, k + c)];
    return L(L(L(d(0,0,0), d(1,0,0), fx), L(d(0,1,0), d(1,1,0), fx), fy),
             L(L(d(0,0,1), d(1,0,1), fx), L(d(0,1,1), d(1,1,1), fx), fy), fz);
  }

  function toJSON(times) {
    return { dims: [nx, ny, nz], range, unit, times,
      frames: times.map(t => { update(t); return Array.from(data, x => Math.round(x)); }) };
  }

  update(0);
  return { nx, ny, nz, range, unit, base, data, update, sample, toJSON };
}
