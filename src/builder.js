// Turns the baked plan data into merged, shadowed geometry.
import * as THREE from '../vendor/three.module.js';

/* ------------------------------------------------------------------ bag --- */
function mergeGeos(geos) {
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  return out;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
function trs(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
}

export class Bag {
  constructor() { this.buckets = new Map(); this.mats = null; }
  add(mat, geo, m) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    let b = this.buckets.get(mat);
    if (!b) { b = []; this.buckets.set(mat, b); }
    b.push(g);
    return this;
  }
  box(w, h, d, x, y, z, mat, ry = 0, rx = 0, rz = 0) {
    return this.add(mat, new THREE.BoxGeometry(w, h, d), trs(x, y, z, rx, ry, rz));
  }
  cyl(rt, rb, h, seg, x, y, z, mat, rx = 0, ry = 0, rz = 0) {
    return this.add(mat, new THREE.CylinderGeometry(rt, rb, h, seg), trs(x, y, z, rx, ry, rz));
  }
  /** horizontal quad, uv in world feet so the texture scale never stretches */
  floor(w, d, x, y, z, mat, unit = 8, swap = false) {
    const g = new THREE.PlaneGeometry(w, d, 1, 1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = swap ? uv.getY(i) : uv.getX(i), v = swap ? uv.getX(i) : uv.getY(i);
      uv.setXY(i, u * (swap ? d : w) / unit, v * (swap ? w : d) / unit);
    }
    g.rotateX(-Math.PI / 2);
    return this.add(mat, g, trs(x, y, z));
  }
  build(parent, { shadow = true } = {}) {
    const meshes = [];
    for (const [mat, geos] of this.buckets) {
      const mesh = new THREE.Mesh(mergeGeos(geos), mat);
      mesh.castShadow = shadow; mesh.receiveShadow = shadow;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh); meshes.push(mesh);
    }
    this.buckets.clear();
    return meshes;
  }
}

/* ------------------------------------------------------------ helpers ----- */
export const inRect = (r, x, z, pad = 0) =>
  x >= r[0] - pad && x <= r[2] + pad && z >= r[1] - pad && z <= r[3] + pad;

function roomAt(plan, x, z, kinds = ['in']) {
  for (const r of plan.rooms) if (kinds.includes(r.kind) && inRect(r.rect, x, z, 0.02)) return r;
  return null;
}

const hashTint = (s) => {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
};

/* ==================================================================== ==== */
export function buildArchitecture(plan, M, scene) {
  const B = new Bag();
  const trim = new Bag();          // trim + joinery, kept for niceties
  const glassB = new Bag();
  const doors = [];
  const colliders = [];
  const lights = [];

  const push = (x0, z0, x1, z1, h = 9, tag = 'wall', maxY = undefined) => colliders.push({
    x0: Math.min(x0, x1), x1: Math.max(x0, x1),
    z0: Math.min(z0, z1), z1: Math.max(z0, z1), h, tag, maxY,
  });
  const wallSeg = (w, box) => {           // collider for one wall box
    if (w.y0 > 1.5) return;               // header / transom above a door: walk under
    const t = w.t / 2 + 0.02;
    if (w.axis === 'x') push(w.a, w.c - t, w.b, w.c + t, w.y1);
    else push(w.c - t, w.a, w.c + t, w.b, w.y1);
  };

  /* -------------------------------------------------------- ground plane -- */
  const LOW = plan.lower.y;                       // -10
  B.floor(520, 520, 17, LOW - 0.35, 20, M.grass, 26, false);
  // driveway + path
  B.floor(16, 46, 27, LOW - 0.32, 14, M.asphalt, 20, false);
  B.floor(9, 20, 21.5, LOW - 0.31, -18, M.concrete, 12, false);

  /* ------------------------------------------------------- lower level ---- */
  const e = plan.bounds;
  B.box(e[2] - e[0] + 1.6, 0.6, e[3] - e[1] + 1.6, (e[0] + e[2]) / 2, LOW, (e[1] + e[3]) / 2, M.concrete);
  // first floor walls (shell) + glazing so the storey below reads as a house
  const shellH = 9.4;
  const wallT = 0.7;
  const mkShell = (x0, z0, x1, z1) => {   // first-floor shell, below the upper slab
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const e = 0.25;
    if (Math.abs(w) > Math.abs(d)) {
      B.box(w, shellH, wallT, cx, LOW + shellH / 2, z1, M.wall[1]);
      push(x0 - e, z1 - wallT / 2 - e, x1 + e, z1 + wallT / 2 + e, 0, 'below', LOW + shellH / 2);
    } else {
      B.box(wallT, shellH, d, x1, LOW + shellH / 2, cz, M.wall[1]);
      push(x1 - wallT / 2 - e, z0 - e, x1 + wallT / 2 + e, z1 + e, 0, 'below', LOW + shellH / 2);
    }
  };
  mkShell(e[0] - 0.5, e[1] - 0.5, e[2] + 0.5, e[1] - 0.5);
  mkShell(e[0] - 0.5, e[3] + 0.5, e[2] + 0.5, e[3] + 0.5);
  mkShell(e[0] - 0.5, e[1] - 0.5, e[0] - 0.5, e[3] + 0.5);
  mkShell(e[2] + 0.5, e[1] - 0.5, e[2] + 0.5, e[3] + 0.5);
  // foyer below the stair void
  const V = plan.void;
  B.floor(V[2] - V[0], V[3] - V[1], (V[0] + V[2]) / 2, LOW + 0.02, (V[1] + V[3]) / 2, M.tileFloor, 6);
  // entry door on the north face of the lower level
  const dz = e[1] - 0.5;
  glassB.box(6.4, 7.4, 0.3, 21.0, LOW + 3.7, dz, M.glass);
  trim.box(0.3, 7.6, 0.36, 17.8, LOW + 3.8, dz, M.trim);
  trim.box(0.3, 7.6, 0.36, 24.2, LOW + 3.8, dz, M.trim);
  trim.box(6.7, 0.3, 0.36, 21.0, LOW + 7.6, dz, M.trim);

  /* ------------------------------------------------------------- floors --- */
  const FLOOR = { wood: M.woodFloor, tile: M.tileFloor, carpet: M.carpet, stone: M.deck };
  const FLOOR_UNIT = { wood: 8, tile: 4, carpet: 4, stone: 6 };
  const holes = plan.rooms.filter(r => r.kind === 'void').map(r => r.rect);
  const subtract = (r, h) => {
    const [x0, z0, x1, z1] = r, [a0, b0, a1, b1] = h;
    if (a1 <= x0 || a0 >= x1 || b1 <= z0 || b0 >= z1) return [r];
    const out = [];
    if (b0 > z0) out.push([x0, z0, x1, b0]);
    if (b1 < z1) out.push([x0, b1, x1, z1]);
    const c0 = Math.max(z0, b0), c1 = Math.min(z1, b1);
    if (a0 > x0) out.push([x0, c0, a0, c1]);
    if (a1 < x1) out.push([a1, c0, x1, c1]);
    return out.filter(q => (q[2] - q[0]) > 0.05 && (q[3] - q[1]) > 0.05);
  };
  for (const r of plan.rooms) {
    if (r.kind === 'void') continue;
    let pieces = [r.rect];
    for (const h of holes) pieces = pieces.flatMap(q => subtract(q, h));
    const mat = FLOOR[r.floor] || M.woodFloor;
    for (const [x0, z0, x1, z1] of pieces) {
      const w = x1 - x0, d = z1 - z0;
      B.floor(w, d, (x0 + x1) / 2, 0, (z0 + z1) / 2, mat, FLOOR_UNIT[r.floor] || 6, w > d);
      B.box(w, 0.65, d, (x0 + x1) / 2, -0.36, (z0 + z1) / 2, M.concrete);
    }
  }
  // slab edge around the stair voids
  for (const r of plan.rooms) {
    if (r.kind !== 'void') continue;
    const [x0, z0, x1, z1] = r.rect;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    B.box(x1 - x0 + 0.1, 0.7, 0.12, cx, -0.36, z0, M.concrete);
    B.box(x1 - x0 + 0.1, 0.7, 0.12, cx, -0.36, z1, M.concrete);
    B.box(0.12, 0.7, z1 - z0 + 0.1, x0, -0.36, cz, M.concrete);
    B.box(0.12, 0.7, z1 - z0 + 0.1, x1, -0.36, cz, M.concrete);
  }

  /* ----------------------------------------------------------- ceilings --- */
  const SOFFIT = plan.soffits || [];
  for (const r of plan.rooms) {
    if (r.kind === 'void') continue;
    const [x0, z0, x1, z1] = r.rect;
    const y = r.ceil;
    B.box(x1 - x0 + 1.4, 0.32, z1 - z0 + 1.4, (x0 + x1) / 2, y + 0.16, (z0 + z1) / 2,
      r.kind === 'out' ? M.roof : M.ceiling);
    // vertical fascia where a tall ceiling meets a 9 ft one
    if (r.ceil > 9 && r.kind === 'in') {
      const t = 0.44, hh = r.ceil - 9;
      B.box(x1 - x0 + 0.5, hh, t, (x0 + x1) / 2, 9 + hh / 2, z0, M.ceiling);
      B.box(x1 - x0 + 0.5, hh, t, (x0 + x1) / 2, 9 + hh / 2, z1, M.ceiling);
      B.box(t, hh, z1 - z0 + 0.5, x0, 9 + hh / 2, (z0 + z1) / 2, M.ceiling);
      B.box(t, hh, z1 - z0 + 0.5, x1, 9 + hh / 2, (z0 + z1) / 2, M.ceiling);
    }
  }

  /* -------------------------------------------------------------- walls --- */
  for (const w of plan.walls) {
    const len = w.b - w.a;
    if (len <= 0.01) continue;
    let h = w.y1 - w.y0;
    // exterior walls run up to the roof line so the shell reads as one mass
    if (w.ext) h = Math.max(h, 11.0 - w.y0);
    const mat = M.wall[hashTint(w.axis + w.c.toFixed(1) + w.a.toFixed(1)) % M.wall.length];
    const cyl = w.c, mid = (w.a + w.b) / 2, y = (w.y0 + w.y1) / 2;
    if (w.axis === 'x') B.box(len, h, w.t, mid, y, cyl, mat);
    else B.box(w.t, h, len, cyl, y, mid, mat);
    wallSeg(w, B);
    // baseboard on each side that faces a room
    for (const s of [-1, 1]) {
      const off = w.t / 2 + 0.035;
      const px = w.axis === 'x' ? mid : cyl + s * off;
      const pz = w.axis === 'x' ? cyl + s * off : mid;
      const rm = roomAt(plan, px, pz, ['in']);
      if (!rm) continue;
      if (w.axis === 'x') trim.box(len, 0.44, 0.07, mid, 0.22, cyl + s * off, M.trim);
      else trim.box(0.07, 0.44, len, cyl + s * off, 0.22, mid, M.trim);
    }
  }

  /* ----------------------------------------------------------- openings --- */
  const wallFace = (o) => {
    // world rect of the opening in plan
    const half = o.w / 2;
    return o.axis === 'x'
      ? { x0: o.at - half, x1: o.at + half, z0: o.line, z1: o.line }
      : { x0: o.line, x1: o.line, z0: o.at - half, z1: o.at + half };
  };

  for (const o of plan.openings) {
    const { x0, x1, z0, z1 } = wallFace(o);
    const horiz = o.axis === 'x';
    const len = o.w;
    const wallT = o.axis === 'x' ? 0.5 : 0.5;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const head = o.head ?? plan.head, sill = o.sill ?? plan.sill;
    const hgt = o.kind === 'win' ? head - sill : (o.h ?? plan.doorH);

    if (o.kind === 'win') {
      const yC = sill + hgt / 2;
      // frame
      const fw = 0.16, fd = wallT + 0.16;
      for (const s of [-1, 1]) {
        const a = s < 0 ? -len / 2 + fw / 2 : len / 2 - fw / 2;
        if (horiz) trim.box(fw, hgt, fd, cx + a, yC, cz, M.trim);
        else trim.box(fd, hgt, fw, cx, yC, cz + a, M.trim);
      }
      if (horiz) {
        trim.box(len, fw, fd, cx, sill + fw / 2, cz, M.trim);
        trim.box(len, fw, fd, cx, head - fw / 2, cz, M.trim);
      } else {
        trim.box(fd, fw, len, cx, sill + fw / 2, cz, M.trim);
        trim.box(fd, fw, len, cx, head - fw / 2, cz, M.trim);
      }
      // glass + mullion
      const gw = len - fw * 2, gh = hgt - fw * 2;
      if (horiz) {
        glassB.box(gw, gh, 0.06, cx, yC, cz, M.glass);
        if (len > 3.2) trim.box(0.1, gh, 0.16, cx, yC, cz, M.trim);
      } else {
        glassB.box(0.06, gh, gw, cx, yC, cz, M.glass);
        if (len > 3.2) trim.box(0.16, gh, 0.1, cx, yC, cz, M.trim);
      }
      // exterior sill board
      if (horiz) B.box(len + 0.3, 0.12, 0.5, cx, sill - 0.1, cz + Math.sign(cz - 20) * 0.1, M.trim);
      else B.box(0.5, 0.12, len + 0.3, cx + Math.sign(cx - 17) * 0.1, sill - 0.1, cz, M.trim);
    }

    if (o.kind === 'door' || o.kind === 'pocket') {
      const fw = 0.14, fd = wallT + 0.14;
      // jambs + head casing on both faces
      for (const s of [-1, 1]) {
        const a = s < 0 ? -len / 2 - fw / 2 : len / 2 + fw / 2;
        if (horiz) trim.box(fw, hgt + 0.1, fd, cx + a, (hgt + 0.1) / 2, cz, M.trim);
        else trim.box(fd, hgt + 0.1, fw, cx, (hgt + 0.1) / 2, cz + a, M.trim);
      }
      if (horiz) trim.box(len + fw * 2, fw, fd, cx, hgt + 0.07, cz, M.trim);
      else trim.box(fd, fw, len + fw * 2, cx, hgt + 0.07, cz, M.trim);

      const leafT = 0.14;
      if (o.kind === 'pocket') {
        const inner = new Bag();
        const lw = len - 0.1;
        if (horiz) inner.box(lw, hgt - 0.12, leafT, 0, 0, 0, M.doorWood);
        else inner.box(leafT, hgt - 0.12, lw, 0, 0, 0, M.doorWood);
        const mesh = inner.build(scene)[0];
        mesh.position.set(horiz ? cx + lw * 0.62 : cx, (hgt - 0.12) / 2, horiz ? cz : cz + lw * 0.62);
        doors.push({ mesh, pivot: mesh.position.clone(), len: lw, axis: horiz ? 'x' : 'z' });
      } else {
        // swinging leaf: geometry offset inside the group so the hinge is the pivot
        const lw = len - 0.12, lh = hgt - 0.12;
        const hw = o.hinge === 'low' ? 1 : -1;
        const g = new THREE.Group();
        const leaf = new Bag();
        const lm = o.glass ? M.glass : M.doorWood;
        if (horiz) leaf.box(lw, lh, leafT, hw * lw / 2, 0, 0, lm);
        else leaf.box(leafT, lh, lw, 0, 0, hw * lw / 2, lm);
        const panel = new Bag();                 // recessed panel detail
        if (horiz) panel.box(lw - 0.55, lh - 1.1, leafT + 0.05, hw * lw / 2, 0, 0, lm);
        else panel.box(leafT + 0.05, lh - 1.1, lw - 0.55, 0, 0, hw * lw / 2, lm);
        panel.build(g);
        leaf.build(g);
        const hb = new Bag();                    // lever handle
        const hx = hw * (lw - 0.42);
        if (horiz) {
          hb.cyl(0.08, 0.08, 0.5, 10, hx, 0.02, leafT / 2 + 0.16, M.chrome, Math.PI / 2, 0, 0);
        } else {
          hb.cyl(0.08, 0.08, 0.5, 10, leafT / 2 + 0.16, 0.02, hx, M.chrome, 0, 0, Math.PI / 2);
        }
        hb.build(g);
        // hinge position in world space
        const hingePos = o.hinge === 'low' ? -len / 2 + 0.06 : len / 2 - 0.06;
        if (horiz) g.position.set(cx + hingePos, lh / 2 + 0.06, cz);
        else g.position.set(cx, lh / 2 + 0.06, cz + hingePos);
        // +swing opens toward +z for east-west walls, toward +x for north-south
        const rot = (horiz ? -hw : hw) * (o.swing ?? 1) * 1.35;
        g.rotation.y = 0;
        scene.add(g);
        doors.push({ group: g, pos: g.position.clone(), open: rot, cur: rot * 0.0 });
      }
      // threshold
      if (o.id === 'pat_d') B.box(len + 0.2, 0.16, wallT + 0.4, cx, 0.05, cz, M.trim);
    }

    if (o.kind === 'slider') {
      const fw = 0.16, fd = 0.6;
      const n = o.panels || 3, pw = len / n;
      for (let i = 0; i < n; i++) {
        const a = -len / 2 + pw * (i + 0.5);
        const off = (i % 2 ? 0.09 : -0.09);
        glassB.box(horiz ? pw - 0.06 : 0.06, hgt - 0.5, horiz ? 0.06 : pw - 0.06,
          cx + (horiz ? a : 0), hgt / 2 + 0.1, cz + (horiz ? 0 : a) + (horiz ? off : 0), M.glass);
        if (!horiz) { }
        // aluminium frame around each panel
        const fmat = M.black;
        if (horiz) {
          trim.box(pw - 0.04, 0.14, 0.22, cx + a, hgt + 0.02, cz + off, fmat);
          trim.box(pw - 0.04, 0.14, 0.22, cx + a, 0.12, cz + off, fmat);
          trim.box(0.12, hgt, 0.22, cx + a - pw / 2, hgt / 2, cz + off, fmat);
          trim.box(0.12, hgt, 0.22, cx + a + pw / 2, hgt / 2, cz + off, fmat);
        } else {
          trim.box(0.22, 0.14, pw - 0.04, cx + off, hgt + 0.02, cz + a, fmat);
          trim.box(0.22, 0.14, pw - 0.04, cx + off, 0.12, cz + a, fmat);
          trim.box(0.22, hgt, 0.12, cx + off, hgt / 2, cz + a - pw / 2, fmat);
          trim.box(0.22, hgt, 0.12, cx + off, hgt / 2, cz + a + pw / 2, fmat);
        }
      }
    }
  }

  /* -------------------------------------------------- bay window seat ----- */
  const bay = plan.bay;
  if (bay) {
    const bw = bay.x1 - bay.x0, bd = bay.z1 - bay.z0;
    const bx = (bay.x0 + bay.x1) / 2, bz = (bay.z0 + bay.z1) / 2;
    B.floor(bw, bd, bx, 0.02, bz, M.woodFloor, 8, false);
    B.box(bw + 0.5, 0.5, bd + 0.5, bx, -0.3, bz, M.concrete);
    B.box(bw + 0.5, 0.32, bd + 0.5, bx, bay.h + 0.16, bz, M.roof);
    // side walls
    B.box(0.35, bay.h, bd, bay.x0 + 0.17, bay.h / 2, bz, M.wall[1]);
    B.box(0.35, bay.h, bd, bay.x1 - 0.17, bay.h / 2, bz, M.wall[1]);
    push(bay.x0, bay.z0, bay.x0 + 0.4, bay.z1);
    push(bay.x1 - 0.4, bay.z0, bay.x1, bay.z1);
    // glazed front
    const fy = 2.9, gh = 6.4;
    for (let i = 0; i < 4; i++) {
      const a = bay.x0 + bw * (i + 0.5) / 4;
      glassB.box(bw / 4 - 0.22, gh, 0.07, a, fy + gh / 2, bay.z1 - 0.2, M.glass);
      trim.box(0.16, gh + 0.2, 0.34, a - bw / 8, fy + gh / 2, bay.z1 - 0.2, M.trim);
    }
    trim.box(0.16, gh + 0.2, 0.34, bay.x1 - 0.1, fy + gh / 2, bay.z1 - 0.2, M.trim);
    trim.box(bw, 0.2, 0.4, bx, fy - 0.1, bay.z1 - 0.2, M.trim);
    trim.box(bw, 0.35, 0.6, bx, bay.h - 0.2, bay.z1 - 0.2, M.trim);
    B.box(bw + 0.4, 0.35, 0.4, bx, bay.h - 0.35, bay.z1 - 0.2, M.roof);
    push(bay.x0, bay.z1 - 0.4, bay.x1, bay.z1);
    // window seat
    trim.box(bw - 0.6, 1.5, 1.7, bx, 0.75, bay.z1 - 1.1, M.cabLight);
    B.box(bw - 0.9, 0.34, 1.45, bx, 1.62, bay.z1 - 1.15, M.sofa);
  }

  /* ------------------------------------------------------------ railings --- */
  const RAIL_H = 3.05;
  for (const r of plan.railings) {
    const ax = r.a[0], az = r.a[1], bx = r.b[0], bz = r.b[1];
    const horiz = Math.abs(bx - ax) > Math.abs(bz - az);
    const len = horiz ? Math.abs(bx - ax) : Math.abs(bz - az);
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    const dirX = bx - ax, dirZ = bz - az;
    const n = Math.max(2, Math.round(len / 4.6));
    const base = r.y ?? 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + dirX * t, z = az + dirZ * t;
      const postH = RAIL_H + 0.25;
      trim.box(0.28, postH, 0.28, x, base + postH / 2, z, M.blackMatte);
      // shoe
      if (i < n) {
        const tm = (i + 0.5) / n;
        const mx = ax + dirX * tm, mz = az + dirZ * tm;
        glassB.box(horiz ? len / n - 0.3 : 0.05, RAIL_H - 0.35, horiz ? 0.05 : len / n - 0.3,
          mx, base + RAIL_H / 2 - 0.1, mz, M.glassRail);
      }
    }
    // top rail + shoe
    if (horiz) {
      B.box(len + 0.1, 0.18, 0.34, cx, base + RAIL_H + 0.09, cz, M.blackMatte);
      B.box(len + 0.1, 0.16, 0.3, cx, base + 0.08, cz, M.blackMatte);
    } else {
      B.box(0.34, 0.18, len + 0.1, cx, base + RAIL_H + 0.09, cz, M.blackMatte);
      B.box(0.3, 0.16, len + 0.1, cx, base + 0.08, cz, M.blackMatte);
    }
    push(cx - (horiz ? len / 2 : 0.25), cz - (horiz ? 0.25 : len / 2),
      cx + (horiz ? len / 2 : 0.25), cz + (horiz ? 0.25 : len / 2), RAIL_H);
  }

  /* -------------------------------------------------------------- stair --- */
  const S = plan.stair, H = plan.void;
  const rise = 10 / S.risers, tread = S.tread;
  for (let i = 0; i < S.risers - 1; i++) {
    const y = -rise * (i + 1);
    const z = S.z_top + tread * i;
    B.box(S.x1 - S.x0 - 0.1, 0.42, tread, (S.x0 + S.x1) / 2, y - 0.21, z + tread / 2, M.woodFloor);
    // riser face
    B.box(S.x1 - S.x0 - 0.1, rise, 0.08, (S.x0 + S.x1) / 2, y + rise / 2, z + 0.04, M.trim);
    // glass guard each side, following the flight
    for (const [gx, side] of [[S.x0 + 0.09, -1], [S.x1 - 0.09, 1]]) {
      glassB.box(0.05, 3.0, tread - 0.05, gx, y + 1.5, z + tread / 2, M.glassRail);
      B.box(0.14, 0.12, tread, gx, y + 3.05, z + tread / 2, M.blackMatte);
    }
  }
  // first floor landing pad at the foot of the stair
  B.floor(S.x1 - S.x0, 3.2, (S.x0 + S.x1) / 2, LOW + 0.03, S.z_top + tread * (S.risers - 1) + 1.6, M.tileFloor, 4, false);

  /* ----------------------------------------------------- roofs + posts --- */
  const roofB = new Bag();
  for (const rf of plan.roofs) {
    const [x0, z0, x1, z1] = rf.rect;
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    roofB.box(w, rf.t, d, cx, rf.y + rf.t / 2, cz, M.roof);
    if (rf.parapet) {
      const p = rf.parapet, t = 0.45;
      roofB.box(w, p, t, cx, rf.y + rf.t + p / 2, z0, M.concrete);
      roofB.box(w, p, t, cx, rf.y + rf.t + p / 2, z1, M.concrete);
      roofB.box(t, p, d, x0, rf.y + rf.t + p / 2, cz, M.concrete);
      roofB.box(t, p, d, x1, rf.y + rf.t + p / 2, cz, M.concrete);
    }
  }
  for (const c of plan.columns) {
    B.box(c.s, c.y1 - c.y0, c.s, c.x, (c.y0 + c.y1) / 2, c.z, M.trim);
    push(c.x - c.s / 2 - 0.05, c.z - c.s / 2 - 0.05, c.x + c.s / 2 + 0.05, c.z + c.s / 2 + 0.05, c.y1);
  }
  // balcony rim + patio rim (fascia)
  const bal = plan.rooms.find(r => r.id === 'balcony').rect;
  B.box(bal[2] - bal[0] + 0.6, 0.9, bal[3] - bal[1] + 0.6, (bal[0] + bal[2]) / 2, -0.5,
    (bal[1] + bal[3]) / 2, M.roof, 0, 0, 0);
  const pat = plan.rooms.find(r => r.id === 'patio').rect;
  B.box(pat[2] - pat[0] + 0.6, 0.9, pat[3] - pat[1] + 0.6, (pat[0] + pat[2]) / 2, -0.5,
    (pat[1] + pat[3]) / 2, M.roof, 0, 0, 0);

  B.build(scene);
  trim.build(scene);
  glassB.build(scene, { shadow: false });
  const roofMeshes = roofB.build(scene);

  return { colliders, doors, lights, roofMeshes };
}
