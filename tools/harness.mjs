// Headless harness: builds the full model in Node (no browser) so the
// geometry, materials and collision data can be validated, and dumps the
// merged scene to a binary file for the offline preview renderer.
import fs from 'node:fs';
import path from 'node:path';
const require$write = (p, d) => fs.writeFileSync(p, d);

/* ---------------------------------------------------------- DOM shims --- */
function ctx2d() {
  const noop = () => {};
  const g = {
    canvas: null,
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', globalAlpha: 1,
    lineCap: 'butt', lineJoin: 'miter', textAlign: 'left', textBaseline: 'alphabetic',
    fillRect: noop, strokeRect: noop, clearRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, ellipse: noop, rect: noop, fill: noop, stroke: noop,
    bezierCurveTo: noop, quadraticCurveTo: noop, save: noop, restore: noop, translate: noop,
    rotate: noop, scale: noop, setTransform: noop, transform: noop, clip: noop,
    fillText: noop, strokeText: noop, drawImage: noop, createPattern: () => null,
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4), width: w, height: h }),
    putImageData: noop,
  };
  return g;
}
function meta3d() {
  const noop = () => {};
  return { addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    appendChild: noop, setAttribute: noop, style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false } };
}
const made = [];
class El {
  constructor(tag) {
    this.tagName = tag; this.style = {}; this.dataset = {}; this.children = [];
    this.width = 1; this.height = 1;
    this.classList = { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false };
    this.getContext = () => (this._c = this._c || ctx2d());
    this.addEventListener = () => {}; this.removeEventListener = () => {};
    this.appendChild = (c) => this.children.push(c); this.setAttribute = () => {};
    this.focus = () => {}; this.toDataURL = () => '';
    made.push(this);
  }
}
globalThis.document = {
  createElement: (t) => (t === 'canvas' ? new El('canvas') : new El(t)),
  createElementNS: () => meta3d(),
  getElementById: () => new El('div'),
  querySelector: () => new El('div'),
  querySelectorAll: () => [],
  addEventListener: () => {},
  body: new El('body'),
};
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 800;
globalThis.addEventListener = () => {};
globalThis.requestAnimationFrame = () => 0;
globalThis.performance = globalThis.performance || { now: () => Date.now() };

/* ------------------------------------------------------------- build ---- */
const THREE = await import('../vendor/three.module.js');
const { PLAN } = await import('../src/plandata.js');
const { materials } = await import('../src/materials.js');
const { buildArchitecture } = await import('../src/builder.js');
const { buildFurniture } = await import('../src/furniture.js');
const { Player } = await import('../src/player.js');

const scene = new THREE.Scene();
const M = materials();
const t0 = Date.now();
const arch = buildArchitecture(PLAN, M, scene);
const furn = buildFurniture(PLAN, M, scene, { perItem: true });
const ms = Date.now() - t0;

let meshes = 0, tris = 0;
const matName = new Map(Object.entries(M).flatMap(([k, v]) => Array.isArray(v) ? v.map((m, i) => [m, k + i]) : [[v, k]]));
const buckets = [];
scene.traverse((o) => {
  if (!o.isMesh || !o.geometry) return;
  if (!o.geometry.attributes.position) return;
  meshes++;
  const g = o.geometry;
  tris += g.attributes.position.count / 3;
  const mat = Array.isArray(o.material) ? o.material[0] : o.material;
  const nm = matName.get(mat) || (mat.name || 'unnamed');
  buckets.push({ name: nm, mat, geo: g, mesh: o });
});

console.log(`built in ${ms} ms`);
console.log(`  meshes ${meshes}   triangles ${Math.round(tris)}`);
console.log(`  arch colliders ${arch.colliders.length}   furniture colliders ${furn.colliders.length}   doors ${arch.doors.length}`);
console.log(`  point lights ${furn.lights.length}   flames ${furn.flames.length}`);

// furniture sanity: every built group must sit inside its footprint (with a
// little slack for counters, headboards, stools) and never over the stairwell
const voids = PLAN.rooms.filter(r => r.kind === 'void').map(r => r.rect);
let overVoid = 0, outOfRect = 0;
const TOL = 0.35;
for (const b of furn.boxes) {
  if (!b.box) continue;
  const [x0, z0, x1, z1] = b.rect;
  const LOOSE = ['island', 'counter_run', 'dining_table', 'outdoor_table', 'bed_queen', 'bed_king',
    'ceiling_light', 'pendant', 'tub_freestanding', 'fireplace'];
  const slack = LOOSE.includes(b.kind) ? 2.6 : 0.55;
  const bad = [b.box.min.x < x0 - slack, b.box.max.x > x1 + slack, b.box.min.z < z0 - slack, b.box.max.z > z1 + slack];
  if (bad.some(Boolean)) {
    outOfRect++;
    console.log(`  ! ${b.kind} rect[${x0},${z0},${x1},${z1}] built [${b.box.min.x.toFixed(1)},${b.box.min.z.toFixed(1)} .. ${b.box.max.x.toFixed(1)},${b.box.max.z.toFixed(1)}]`);
  }
  for (const v of voids) {
    const ox = Math.min(b.box.max.x, v[2]) - Math.max(b.box.min.x, v[0]);
    const oz = Math.min(b.box.max.z, v[3]) - Math.max(b.box.min.z, v[1]);
    if (ox > 0.25 && oz > 0.25 && b.kind !== 'rug') {
      overVoid++;
      console.log(`  ! ${b.kind} rect[${b.rect}] overlaps the void by ${ox.toFixed(1)} x ${oz.toFixed(1)} ft`);
    }
  }
}
console.log(`  furniture placement: ${outOfRect} outside their footprint, ${overVoid} over the stairwell`);

// walkability: sample the plan on a grid, make sure rooms connect and the
// player never spawns inside geometry
const player = new Player(PLAN, new THREE.PerspectiveCamera(74, 1.6, 0.1, 500));
player.addColliders(arch.colliders);
player.addColliders(furn.colliders);

let stuck = 0, unreachable = 0;
const step = 3.0;
for (let x = 1; x < 33; x += step) {
  for (let z = 1; z < 40; z += step) {
    const before = { x, z };
    player.pos.set(x, 0, z);
    player.move(0.0001, 0.0001);
    const d = Math.hypot(player.pos.x - x, player.pos.z - z);
    if (d > 1.2) { stuck++; if (stuck < 6) console.log(`  stuck at ${x.toFixed(1)},${z.toFixed(1)} pushed ${d.toFixed(2)}ft`); }
  }
}

// flood fill from the top of the stairs to see how much floor is reachable
function reachable() {
  const cell = 1.0, seen = new Set(), q = [[23.6, 21.2]];
  const inside = (x, z) => PLAN.rooms.some(r => r.kind !== 'void' && x >= r.rect[0] - 0.4 && x <= r.rect[2] + 0.4 && z >= r.rect[1] - 0.4 && z <= r.rect[3] + 0.4);
  let n = 0;
  while (q.length) {
    const [x, z] = q.pop();
    const k = Math.round(x / cell) + ':' + Math.round(z / cell);
    if (seen.has(k)) continue;
    if (!inside(x, z)) continue;
    player.pos.set(x, 0, z);
    const px = x, pz = z;
    player.move(0.001, 0.001);
    if (Math.hypot(player.pos.x - px, player.pos.z - pz) > 0.8) continue;
    seen.add(k); n++;
    q.push([x + cell, z], [x - cell, z], [x, z + cell], [x, z - cell]);
  }
  return n * cell * cell;
}
// exact reachability: a cell is free when the player circle (r=0.95) clears
// every collider; then 4-connected flood fill from the top of the stairs.
function floodReport() {
  const cell = 0.3, R = 0.8;
  const cols = Math.ceil(35 / cell), rows = Math.ceil(58 / cell);
  const idx = (i, j) => (i + 12) * (rows + 32) + (j + 32);
  const isRoom = (x, z) => PLAN.rooms.some(r => r.kind !== 'void' &&
    x >= r.rect[0] - 0.35 && x <= r.rect[2] + 0.35 && z >= r.rect[1] - 0.35 && z <= r.rect[3] + 0.35);
  const colliders = player.colliders;
  const grid = new Int8Array(cols * rows);        // 0 unknown, -1 blocked, 1 free
  const at = (i, j) => [i * cell, j * cell];
  const freeAt = (x, z) => {
    if (!isRoom(x, z)) return false;
    for (const c of colliders) {
      if (c.maxY !== undefined && 0 > c.maxY) continue;
      if (c.h !== undefined && 1.6 > c.h) continue;
      if (x < c.x0 - R || x > c.x1 + R || z < c.z0 - R || z > c.z1 + R) continue;
      const cx = Math.max(c.x0, Math.min(x, c.x1)), cz = Math.max(c.z0, Math.min(z, c.z1));
      if (Math.hypot(x - cx, z - cz) < R) return false;
    }
    return true;
  };
  const seen = new Set();
  const seedI = Math.round(23.0 / cell), seedJ = Math.round(20.4 / cell);
  const q = [[seedI, seedJ]];
  let n = 0;
  while (q.length) {
    const [i, j] = q.pop();
    if (i < -12 || j < -32 || i >= cols || j >= rows) continue;
    const k = idx(i, j);
    if (seen.has(k)) continue;
    const [x, z] = at(i, j);
    if (!freeAt(x, z)) continue;
    seen.add(k); n++;
    q.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  const area = n * cell * cell;
  let roomArea = 0;
  const unreachable = [];
  for (const r of PLAN.rooms) {
    if (r.kind === 'void') continue;
    const [x0, z0, x1, z1] = r.rect;
    let tot = 0, got = 0;
    for (let i = Math.floor(x0 / cell); i <= Math.ceil(x1 / cell); i++) {
      for (let j = Math.floor(z0 / cell); j <= Math.ceil(z1 / cell); j++) {
        const [x, z] = at(i, j);
        if (x < x0 || x > x1 || z < z0 || z > z1) continue;
        if (!freeAt(x, z)) continue;          // wall / furniture ring around the room
        tot++;
        if (seen.has(idx(i, j))) got++;
      }
    }
    roomArea += tot * cell * cell;
    if (process.env.VERBOSE && tot > 12) console.log(`    ${r.id.padEnd(9)} free ${String(tot).padStart(4)} cells  reached ${(got / tot * 100).toFixed(0)}%`);
    if (r.name && tot > 12 && got / tot < 0.7) unreachable.push(`${r.id} ${(got / tot * 100).toFixed(0)}%`);
  }
  for (const L of PLAN.labels) {
    let best = Infinity;
    for (let i = Math.round((L.jump[0] - 4) / cell); i <= Math.round((L.jump[0] + 4) / cell); i++) {
      for (let j = Math.round((L.jump[1] - 4) / cell); j <= Math.round((L.jump[1] + 4) / cell); j++) {
        if (seen.has(idx(i, j))) best = Math.min(best, Math.hypot(i * cell - L.jump[0], j * cell - L.jump[1]));
      }
    }
    if (best > 4) unreachable.push(`near(${L.id})`);
  }
  if (process.env.MAP) {
    let out = '    ' + '-1'.padStart(3);
    for (let i = 0; i < cols; i++) out += (i % 10 === 0 ? String(Math.round(i * cell / 10) % 10) : ' ');
    out = '    x=' + out.slice(4, 8) + '\n';
    for (let j = 0; j < rows; j++) {
      let row = String(Math.round(j * cell)).padStart(3) + ' ';
      for (let i = 0; i < cols; i++) {
        const [x, z] = at(i, j);
        row += seen.has(idx(i, j)) ? '·' : (freeAt(x, z) ? 'o' : (isRoom(x, z) ? '#' : ' '));
      }
      out += row + '\n';
    }
    console.log(out);
  }
  return { area, roomArea, unreachable };
}
const rep = floodReport();
const floorArea = rep.roomArea;
console.log(`  walkable ${rep.area.toFixed(0)} sq ft of ${floorArea.toFixed(0)} room area (${(rep.area / floorArea * 100).toFixed(0)}%)`);
if (rep.unreachable.length) console.log('  unreachable: ' + rep.unreachable.join(', '));
const reach = rep.area;

if (stuck) console.log(`  note: ${stuck} sample points sit inside furniture (expected)`);

/* --------------------------------------------------------- dump binary -- */
const out = [];
const chroma = (mat) => {
  const c = mat.color || { r: 1, g: 1, b: 1 };
  const e = mat.emissive || { r: 0, g: 0, b: 0 };
  return [c.r, c.g, c.b, mat.roughness ?? 0.8, mat.metalness ?? 0, e.r, e.g, e.b, mat.transparent ? 1 : 0];
};
const parts = [];
for (const b of buckets) {
  if (!b.geo.attributes.position) continue;
  const n = b.geo.attributes.position.count;
  b.mesh.updateWorldMatrix(true, false);
  parts.push({ name: b.name, props: chroma(b.mat), pos: b.geo.attributes.position.array,
    nor: b.geo.attributes.normal.array, n, m: Array.from(b.mesh.matrixWorld.elements) });
}
const totalVerts = parts.reduce((a, p) => a + p.n, 0);
const head = Buffer.alloc(8);
head.writeUInt32LE(parts.length, 0);
head.writeUInt32LE(totalVerts, 4);
const chunks = [head];
for (const p of parts) {
  const nm = Buffer.from(p.name, 'utf8');
  const meta = Buffer.alloc(4 + nm.length + 4 * 9 + 64 + 4);
  meta.writeUInt32LE(nm.length, 0);
  nm.copy(meta, 4);
  let o = 4 + nm.length;
  for (const v of p.props) { meta.writeFloatLE(v, o); o += 4; }
  for (const v of p.m) { meta.writeFloatLE(v, o); o += 4; }
  meta.writeUInt32LE(p.n, o);
  chunks.push(meta);
  chunks.push(Buffer.from(p.pos.buffer, p.pos.byteOffset, p.pos.byteLength));
  chunks.push(Buffer.from(p.nor.buffer, p.nor.byteOffset, p.nor.byteLength));
}
const file = path.join(path.dirname(new URL(import.meta.url).pathname), 'scene.bin');
fs.writeFileSync(file, Buffer.concat(chunks));
console.log(`  wrote ${file} (${(fs.statSync(file).size / 1048576).toFixed(1)} MB)`);

const lights = furn.lights.map(L => ({ pos: L.pos, color: L.color, intensity: L.intensity, dist: L.dist }));
require$write(file.replace('.bin', '.lights.json'), JSON.stringify(lights));
const report = { ms, meshes, tris: Math.round(tris), reach, floorArea, stuck,
  colliders: arch.colliders.length + furn.colliders.length, doors: arch.doors.length,
  materials: Object.keys(M).length, furniture: PLAN.furniture.length };
fs.writeFileSync(file.replace('.bin', '.json'), JSON.stringify(report, null, 1));
