// This project loads Three.js as a global (classic <script>, not an ES
// module / import map), so `import ... from 'three'` can't resolve here.
const THREE = window.THREE;

const DIRS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const QUAD = [[0,0],[1,0],[1,1],[0,1]];

function jet(x) {
  const c = v => Math.min(Math.max(v, 0), 1);
  return [c(1.5 - Math.abs(4 * x - 3)), c(1.5 - Math.abs(4 * x - 2)), c(1.5 - Math.abs(4 * x - 1))];
}

export function buildBlock(field, {
  size = [6, 3, 4],
  cut = (i, j, k) => i > field.nx * 0.55 && k > field.nz * 0.5 && j > field.ny * 0.35,
} = {}) {
  const { nx, ny, nz } = field;
  const solid = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < nx && j < ny && k < nz && !cut(i, j, k);
  const pos = [], nrm = [], uvw = [];

  const faceCorners = DIRS.map(d => {
    const a = d.findIndex(v => v !== 0), [b, c] = [0, 1, 2].filter(x => x !== a);
    const pts = QUAD.map(([p, q]) => { const o = [0, 0, 0]; o[a] = d[a] > 0 ? 1 : 0; o[b] = p; o[c] = q; return o; });
    const e1 = pts[1].map((v, n) => v - pts[0][n]), e2 = pts[2].map((v, n) => v - pts[0][n]);
    const cr = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
    const ok = cr[0]*d[0] + cr[1]*d[1] + cr[2]*d[2] > 0;
    return (ok ? [0,1,2,0,2,3] : [0,2,1,0,3,2]).map(n => pts[n]);
  });

  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!solid(i, j, k)) continue;
    DIRS.forEach((d, di) => {
      if (solid(i + d[0], j + d[1], k + d[2])) return;
      for (const o of faceCorners[di]) {
        const ci = i + o[0], cj = j + o[1], ck = k + o[2];
        pos.push((ci / nx - 0.5) * size[0], (cj / ny - 0.5) * size[1], (ck / nz - 0.5) * size[2]);
        nrm.push(...d);
        uvw.push((ci - 0.5) / (nx - 1), (cj - 0.5) / (ny - 1), (ck - 0.5) / (nz - 1));
      }
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  const color = new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3);
  color.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('color', color);

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  const U = new Float32Array(uvw), C = color.array;

  function recolor() {
    const [lo, hi] = field.range;
    for (let v = 0; v < U.length; v += 3) {
      const [r, g, b] = jet((field.sample(U[v], U[v + 1], U[v + 2]) - lo) / (hi - lo));
      C[v] = r; C[v + 1] = g; C[v + 2] = b;
    }
    color.needsUpdate = true;
  }

  function update(t) { field.update(t); recolor(); }
  recolor();
  return { mesh, update, recolor };
}
