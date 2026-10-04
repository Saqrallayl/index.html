// Parametric furniture + fixtures.
//
// Each item is a footprint rect plus the direction its front faces. Builders
// work in LOCAL coordinates: u runs along the item's width, v runs from the
// back toward the front, y is up. mk() maps (u, v) to world x/z and swaps the
// box extents when the item faces east or west, so a builder never has to know
// which wall it is standing against.
import * as THREE from '../vendor/three.module.js';
import { Bag } from './builder.js';

const FRONT = { 0: [0, -1], 90: [1, 0], 180: [0, 1], 270: [-1, 0] };   // N E S W

function frame(f) {
  const [x0, z0, x1, z1] = f.rect;
  const fx = FRONT[f.face] || [0, -1];
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const alongX = Math.abs(fx[1]) > 0.5;              // faces N/S -> width runs on x
  const W = alongX ? x1 - x0 : z1 - z0;              // width  (u)
  const D = alongX ? z1 - z0 : x1 - x0;              // depth  (v)
  const at = (u, v) => {
    if (alongX) return fx[1] > 0 ? [cx + u, z0 + v] : [cx + u, z1 - v];
    return fx[0] > 0 ? [x0 + v, cz + u] : [x1 - v, cz + u];
  };
  return { at, W, D, fx, alongX, rect: [x0, z0, x1, z1] };
}

/** local-space placement helpers */
function mk(B, F) {
  const swap = !F.alongX;
  return {
    at: F.at,
    put(w, h, d, u, v, y, mat, ry = 0) {
      const [x, z] = F.at(u, v);
      if (swap) B.box(d, h, w, x, y, z, mat, -ry);
      else B.box(w, h, d, x, y, z, mat, ry);
    },
    cyl(r0, r1, h, seg, u, v, y, mat, rx = 0, ry = 0, rz = 0) {
      const [x, z] = F.at(u, v);
      B.cyl(r0, r1, h, seg, x, y, z, mat, rx, ry, rz);
    },
    /** rod lying along the item's width (u) */
    cylW(r0, r1, h, seg, u, v, y, mat) {
      const [x, z] = F.at(u, v);
      if (swap) B.cyl(r0, r1, h, seg, x, y, z, mat, Math.PI / 2, 0, 0);
      else B.cyl(r0, r1, h, seg, x, y, z, mat, 0, 0, Math.PI / 2);
    },
    /** rod lying along the item's depth (v), i.e. poking out the front */
    cylD(r0, r1, h, seg, u, v, y, mat) {
      const [x, z] = F.at(u, v);
      if (swap) B.cyl(r0, r1, h, seg, x, y, z, mat, 0, 0, Math.PI / 2);
      else B.cyl(r0, r1, h, seg, x, y, z, mat, Math.PI / 2, 0, 0);
    },
    /** world-space add, for blobs / custom geometry */
    add(mat, geo, u, v, y, dx = 0, dy = 0, dz = 0) {
      const [x, z] = F.at(u, v);
      return B.add(mat, geo, new THREE.Matrix4().makeTranslation(x + (swap ? dz : dx), y + dy, z + (swap ? dx : dz)));
    },
    span: F.W, depth: F.D, alongX: F.alongX,
  };
}

/* ------------------------------------------------------------- builders -- */
const builders = {
  /* ------------------------------------------------------------- beds ---- */
  bed(B, f, M, o, size) {
    const F = frame(f), { put } = mk(B, F);
    const [bw, bd] = size;
    const u = -F.W / 2 + 0.25 + bw / 2;
    put(bw + 0.35, 0.8, bd + 0.3, u, bd / 2 + 0.15, 0.4, M.cabWood);
    put(bw + 0.5, 3.8, 0.3, u, 0.15, 1.9, M.sofaDk);                 // upholstered headboard
    put(bw + 0.2, 0.6, bd - 0.1, u, bd / 2 + 0.3, 1.15, M.bedLinen);  // mattress
    put(bw + 0.24, 0.22, bd * 0.7, u, bd * 0.68 + 0.3, 1.55, M.duvet);
    put(bw + 0.24, 0.16, bd * 0.22, u, bd * 0.92, 1.66, M.duvet);
    for (const s of [-1, 1]) {
      put(bw * 0.45, 0.38, 1.05, u + s * bw * 0.24, 0.95, 1.62, M.bedLinen, s * 0.06);
      put(bw * 0.38, 0.3, 0.75, u + s * bw * 0.23, 1.35, 1.76, M.duvet, s * 0.12);
    }
    put(bw + 0.28, 0.14, 1.0, u, bd - 0.85, 1.64, M.accent);          // folded throw
    return null;
  },
  bed_queen(B, f, M, o) { return builders.bed(B, f, M, o, [5.0, 6.67]); },
  bed_king(B, f, M, o) { return builders.bed(B, f, M, o, [6.33, 6.67]); },

  nightstand(B, f, M) {
    const F = frame(f), { put, cyl, at } = mk(B, F);
    const w = F.W - 0.12, d = F.D - 0.12;
    put(w, 2.0, d, 0, d / 2, 1.3, M.cabWood);
    put(w + 0.12, 0.14, d + 0.12, 0, d / 2, 2.36, M.quartz);
    put(w - 0.2, 0.05, 0.05, 0, d + 0.01, 1.55, M.chrome);
    cyl(0.12, 0.18, 0.85, 12, 0, F.D / 2, 2.85, M.chrome);
    cyl(0.5, 0.38, 0.95, 18, 0, F.D / 2, 3.75, M.sofa);
    const [x, z] = at(0, F.D / 2);
    return { light: [x, 3.7, z, 0xffe6bd, 0.3, 11] };
  },

  dresser(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const w = F.W - 0.12, d = F.D - 0.12;
    put(w, 2.85, d, 0, d / 2, 1.43, M.cabWood);
    put(w + 0.1, 0.14, d + 0.06, 0, d / 2, 2.9, M.quartz);
    for (let i = 0; i < 3; i++) put(w - 0.2, 0.05, 0.04, 0, d + 0.01, 2.3 - i * 0.85, M.blackMatte);
    put(0.5, 0.9, 0.35, -w * 0.3, 0.4, 3.4, M.pot);                   // decor bowl
    return null;
  },

  bookshelf(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const w = F.W, d = Math.max(F.D, 0.9), h = f.h || 6.6;
    const n = 5;
    put(w, 0.14, d, 0, d / 2, 0.1, M.cabWood);
    for (const s of [-1, 1]) put(0.14, h, d, s * (w / 2 - 0.07), d / 2, h / 2, M.cabWood);
    for (let i = 1; i <= n; i++) put(w - 0.28, 0.1, d - 0.1, 0, d / 2, i * (h / (n + 1)), M.cabWood);
    put(w, 0.12, d, 0, d / 2, h - 0.06, M.cabWood);
    // spines
    const cols = [M.accent, M.sofaDk, M.sofa, M.leaf, M.cabLight, M.blackMatte, M.bedLinen];
    let seed = 7;
    for (let i = 1; i <= n; i++) {
      const y = i * (h / (n + 1)) + 0.05;
      let u = -w / 2 + 0.3;
      while (u < w / 2 - 0.4) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const bw = 0.18 + (seed % 7) / 40;
        const bh = 0.9 + (seed % 5) / 8;
        put(bw, bh, 0.7, u + bw / 2, d / 2, y + bh / 2, cols[seed % cols.length]);
        u += bw + 0.04;
      }
    }
    return null;
  },

  closet_double(B, f, M) {
    const F = frame(f), { put, cyl } = mk(B, F);
    const w = F.W, d = F.D - 0.04, h = f.h || 7.5;
    put(w, h, d, 0, d / 2, h / 2, M.trim);
    for (const s of [-1, 1]) {
      put(w / 2 - 0.05, h - 0.2, 0.05, s * w / 4, d + 0.02, h / 2, M.trim);
      cyl(0.04, 0.04, 0.8, 8, s * 0.12, d + 0.1, h * 0.52, M.chrome);
    }
    put(w + 0.06, 0.16, d + 0.06, 0, d / 2, h + 0.05, M.trim);
    return null;
  },

  /* ---------------------------------------------------------- seating ---- */
  sofa(B, f, M, o, seats, opts = {}) {
    const F = frame(f), { put } = mk(B, F);
    const W = F.W, D = F.D, armW = opts.arm ?? 0.5, mat = opts.mat || M.sofa;
    put(W, 0.55, D, 0, D / 2, 0.38, mat);
    put(W, 2.6, 0.5, 0, 0.26, 1.5, mat);
    for (const s of [-1, 1]) put(armW, 1.85, D - 0.15, s * (W / 2 - armW / 2), D / 2, 1.12, mat);
    const inner = W - armW * 2;
    for (let i = 0; i < seats; i++) {
      const u = -inner / 2 + inner * (i + 0.5) / seats;
      put(inner / seats - 0.07, 0.4, D - 1.1, u, D / 2 + 0.28, 1.36, opts.cushion || mat);
      put(inner / seats - 0.09, 1.25, 0.4, u, 0.72, 1.95, opts.cushion || mat, 0.13);
    }
    for (const s of [-1, 1]) put(0.8, 0.8, 0.28, s * (inner / 2 - 0.55), 0.9, 1.85, opts.pillow || M.accent, s * 0.28);
    return null;
  },
  sofa3(B, f, M, o) { return builders.sofa(B, f, M, o, 3); },
  sofa2(B, f, M, o) { return builders.sofa(B, f, M, o, 2); },

  armchair(B, f, M, o, opts = {}) {
    const F = frame(f), { put } = mk(B, F);
    const W = Math.min(F.W, F.D), D = Math.max(F.W, F.D) * 0.9;
    const mat = opts.mat || M.sofa;
    put(W, 0.45, D, 0, D / 2, 0.42, mat);
    put(W, 2.4, 0.45, 0, 0.28, 1.4, mat);
    for (const s of [-1, 1]) put(0.4, 1.6, D - 0.28, s * (W / 2 - 0.2), D / 2, 1.2, mat);
    put(W - 0.9, 0.34, D - 0.95, 0, D / 2 + 0.22, 1.3, opts.cushion || mat);
    put(W - 0.95, 0.95, 0.35, 0, 0.7, 1.78, opts.cushion || mat, 0.1);
    put(0.7, 0.7, 0.25, 0, 0.75, 1.8, opts.pillow || M.sofaDk, 0.3);
    return null;
  },

  coffee_table(B, f, M) {
    const F = frame(f), { put, cyl } = mk(B, F);
    const w = F.W, d = F.D;
    put(w, 0.16, d, 0, d / 2, 1.32, M.cabWood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      put(0.2, 1.26, 0.2, sx * (w / 2 - 0.22), d / 2 + sz * (d / 2 - 0.22), 0.66, M.blackMatte);
    put(w - 0.6, 0.1, d - 0.6, 0, d / 2, 0.52, M.cabWood);
    cyl(0.32, 0.26, 0.5, 12, -w * 0.18, d / 2, 1.62, M.pot);
    put(1.0, 0.06, 0.7, w * 0.16, d / 2, 1.42, M.bedLinen);
    put(0.8, 0.05, 0.55, w * 0.14, d / 2, 1.46, M.accent);
    return null;
  },

  side_table(B, f, M) {
    const F = frame(f), { cyl, at } = mk(B, F);
    const w = Math.min(F.W, 1.6);
    const [x, z] = at(0, F.D / 2);
    cyl(w / 2, w / 2, 0.15, 16, 0, F.D / 2, 1.85, M.marble);
    cyl(0.08, 0.08, 1.8, 10, 0, F.D / 2, 0.9, M.chrome);
    cyl(w / 2.4, w / 2.6, 0.1, 16, 0, F.D / 2, 0.05, M.chrome);
    return { light: [x, 2.3, z, 0xffe6bd, 0.18, 8] };
  },

  dining_table(B, f, M, o, opts = {}) {
    const F = frame(f), { put } = mk(B, F);
    const w = F.W, d = F.D, top = 2.5;
    put(w, 0.2, d, 0, d / 2, top, M.cabWood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const lx = sx * (w / 2 - 0.45), lz = d / 2 + sz * (d / 2 - 0.45);
      put(0.26, top - 0.1, 0.26, lx, lz, (top - 0.1) / 2, M.blackMatte);
      put(0.32, 0.1, 0.32, lx, lz, 0.05, M.blackMatte);
    }
    // a bowl of something in the middle
    put(1.1, 0.22, 1.1, 0, d / 2, top + 0.2, M.pot);
    put(0.9, 0.16, 0.9, 0, d / 2, top + 0.34, M.leaf2);
    const n = opts.seats || 6, per = Math.round(n / 2);
    for (let side = 0; side < 2; side++) {
      const sign = side ? 1 : -1;
      for (let i = 0; i < per; i++) {
        const u = (i - (per - 1) / 2) * (w / per) * 0.92;
        const [cx, cz] = F.at(u, d / 2 + sign * (d / 2 + 1.05));
        const ry = F.alongX ? (sign > 0 ? Math.PI : 0) : (sign > 0 ? -Math.PI / 2 : Math.PI / 2);
        chairAt(B, M, cx, cz, ry, M.sofa, 1.45);
      }
    }
    return { light: [F.at(0, d / 2)[0], 3.0, F.at(0, d / 2)[1], 0xffdcae, 0.2, 10] };
  },

  /* --------------------------------------------------------- kitchen ----- */
  counter_run(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const w = F.W, d = F.D, h = 2.95;
    put(w, h - 0.35, d - 0.15, 0, d / 2, (h - 0.35) / 2 + 0.35, M.cabLight);
    put(w - 0.4, 0.36, d - 0.6, 0, d / 2, 0.18, M.blackMatte);
    put(w + 0.1, 0.2, d + 0.12, 0, d / 2, h + 0.1, M.quartz);
    put(w, 0.32, 0.08, 0, d + 0.06, h + 0.35, M.quartz);            // upstand
    // splashback in a warm tile to the underside of the uppers
    put(w, 2.0, 0.06, 0, d - 0.02, 3.9, M.tileWarm);
    const n = Math.max(2, Math.round(w / 2.4));
    for (let i = 0; i < n; i++) put(1.1, 0.05, 0.05, -w / 2 + w * (i + 0.5) / n, d + 0.02, h - 0.5, M.chrome);
    return null;
  },

  upper_cab(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const w = F.W, d = F.D, y0 = 4.9, y1 = f.h || 7.6;
    put(w, y1 - y0, d, 0, d / 2, (y0 + y1) / 2, M.cabLight);
    const n = Math.max(2, Math.round(w / 2.2));
    for (let i = 0; i < n; i++) put(1.0, 0.05, 0.04, -w / 2 + w * (i + 0.5) / n, d + 0.02, y0 + 0.2, M.chrome);
    return null;
  },

  fridge(B, f, M) {
    const F = frame(f), { put, cyl } = mk(B, F);
    const w = Math.min(F.W, 3.0), d = F.D, h = f.h || 5.9;
    put(w, h, d, 0, d / 2, h / 2, M.steel);
    put(w - 0.1, 0.05, 0.05, 0, d + 0.03, h * 0.62, M.blackMatte);
    put(w - 0.1, 0.05, 0.05, 0, d + 0.03, h * 0.34, M.blackMatte);
    cyl(0.05, 0.05, 1.6, 8, -w * 0.3, d + 0.12, h * 0.52, M.chrome);
    cyl(0.05, 0.05, 1.6, 8, w * 0.3, d + 0.12, h * 0.52, M.chrome);
    return null;
  },

  range(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const w = Math.min(F.W, 2.6), d = F.D;
    put(w, 2.95, d, 0, d / 2, 1.47, M.steel);
    put(w - 0.12, 1.45, 0.06, 0, d + 0.02, 1.4, M.black);
    put(w - 0.2, 0.75, 0.05, 0, d + 0.04, 2.5, M.blackMatte);
    put(w + 0.08, 0.1, d + 0.06, 0, d / 2, 3.0, M.black);
    for (const s of [-1, 1]) for (const t of [-1, 1])
      put(0.26, 0.04, 0.26, s * w * 0.24, d / 2 + t * d * 0.22, 3.07, M.blackMatte);
    for (let i = 0; i < 4; i++) put(0.09, 0.09, 0.12, -w / 2 + 0.3 + i * 0.3, d + 0.03, 2.72, M.chrome);
    return null;
  },

  hood(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const w = Math.min(F.W, 2.7), d = Math.min(F.D, 1.9);
    put(w, 0.8, d, 0, d / 2, 5.55, M.steel);
    put(w * 0.5, 4.2, d * 0.62, 0, d * 0.4, 7.9, M.steel);
    for (const s of [-1, 1]) put(w * 0.12, 0.5, 0.05, s * w * 0.4, d * 0.3, 5.5, M.blackMatte);
    return null;
  },

  island(B, f, M, o, opts = {}) {
    const F = frame(f), { put, cyl } = mk(B, F);
    const w = F.W, d = F.D, h = 3.0;
    put(w, h - 0.3, d, 0, d / 2, (h - 0.3) / 2 + 0.3, M.cabDark);
    put(w - 0.4, 0.32, d - 0.5, 0, d / 2, 0.16, M.blackMatte);
    put(w + 0.35, 0.22, d + 0.45, 0, d / 2, h + 0.11, M.quartz);
    put(2.6, 0.26, 1.5, -w / 4, d / 2, h + 0.03, M.steel);                    // sink rim
    put(1.15, 0.18, 1.2, -w / 4 - 0.62, d / 2, h - 0.06, M.blackMatte);
    put(1.15, 0.18, 1.2, -w / 4 + 0.62, d / 2, h - 0.06, M.blackMatte);
    cyl(0.06, 0.06, 1.0, 10, -w / 4, d * 0.3, h + 0.5, M.chrome);
    put(0.9, 0.06, 0.06, -w / 4, d * 0.3, h + 1.0, M.chrome);
    put(2.35, 2.4, 0.05, w / 4, d + 0.01, 1.5, M.steel);                      // dishwasher
    put(2.0, 0.05, 0.06, w / 4, d + 0.05, 2.5, M.chrome);
    // seating side overhang + stools
    const n = opts.stools || 4;
    for (let i = 0; i < n; i++) {
      const u = -w / 2 + w * (i + 0.5) / n;
      const [bx, bz] = F.at(u, d + 0.85);
      stoolAt(B, M, bx, bz);
    }
    return null;
  },

  pantry(B, f, M) {
    const F = frame(f), { put, cyl } = mk(B, F);
    const w = F.W, d = F.D, h = f.h || 7.8;
    put(w, h, d, 0, d / 2, h / 2, M.cabLight);
    for (let i = 0; i < 3; i++) {
      put(w - 0.1, 0.04, 0.04, 0, d + 0.02, 2.2 + i * 2.5, M.blackMatte);
      cyl(0.04, 0.04, 1.0, 8, w * 0.2, d + 0.12, 3.2 + i * 2.5, M.chrome);
    }
    return null;
  },
  broom_closet(B, f, M) { return builders.pantry(B, f, M); },

  washer_dryer(B, f, M) {
    const F = frame(f), { put, cylD, cyl } = mk(B, F);
    const w = F.W, d = F.D;
    for (const s of [-1, 1]) {
      put(w / 2 - 0.14, 3.05, d - 0.15, s * w * 0.25, d / 2, 1.55, M.appliance);
      put(w / 2 - 0.14, 0.05, 0.04, s * w * 0.25, d + 0.02, 3.0, M.blackMatte);
      cylD(0.8, 0.8, 0.12, 18, s * w * 0.25, d + 0.02, 1.65, M.steel);
      cylD(0.58, 0.58, 0.16, 18, s * w * 0.25, d + 0.05, 1.65, M.black);
    }
    put(w + 0.1, 0.2, d + 0.3, 0, d / 2, 3.2, M.quartz);
    put(1.9, 0.3, 1.3, -w * 0.3, d * 0.55, 3.05, M.steel);
    put(1.65, 0.22, 1.05, -w * 0.3, d * 0.55, 2.96, M.blackMatte);
    cyl(0.06, 0.06, 0.9, 10, -w * 0.3, d * 0.2, 3.55, M.chrome);
    put(1.0, 0.9, 0.12, w * 0.3, d - 0.05, 4.0, M.tileWarm);          // splash
    return null;
  },

  /* -------------------------------------------------------- bathrooms --- */
  vanity(B, f, M, o, opts = {}) {
    const F = frame(f), { put, cyl } = mk(B, F);
    const w = F.W, d = F.D, h = 2.9;
    put(w, h - 0.3, d, 0, d / 2, (h - 0.3) / 2 + 0.3, M.cabLight);
    put(w - 0.35, 0.3, d - 0.45, 0, d / 2, 0.15, M.blackMatte);
    put(w + 0.08, 0.2, d + 0.08, 0, d / 2, h + 0.1, M.marble);
    put(w, 0.3, 0.08, 0, d + 0.05, h + 0.3, M.marble);
    put(w, 2.2, 0.06, 0, d - 0.02, h + 1.5, M.tileWarm);              // tiled splash
    const n = opts.sinks || 1;
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : (i - (n - 1) / 2) * (w / n) * 0.9;
      put(1.6, 0.3, 1.2, u, d / 2, h + 0.1, M.porcelain);
      put(1.35, 0.2, 0.95, u, d / 2, h + 0.01, M.porcelain);
      cyl(0.05, 0.05, 0.8, 10, u, d * 0.15, h + 0.5, M.chrome);
      put(0.7, 0.06, 0.06, u, d * 0.15, h + 0.9, M.chrome);
      put(1.0, 0.05, 0.04, u, d + 0.01, h * 0.62, M.chrome);
    }
    // folded towels + a tray
    put(0.5, 0.28, 0.4, -w / 2 + 0.6, d * 0.7, h + 0.3, M.bedLinen);
    put(0.5, 0.28, 0.4, -w / 2 + 0.6, d * 0.7, h + 0.58, M.duvet);
    return null;
  },

  mirror(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const w = F.W, d = Math.max(F.D, 0.05), h = f.h || 6.9;
    put(w + 0.14, h - 2.95, d + 0.03, 0, d / 2, (h + 2.95) / 2, M.trim);
    put(w, h - 2.95, d + 0.06, 0, d / 2, (h + 2.95) / 2, M.mirror);
    return null;
  },

  wc_toilet(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const d = F.D;
    put(1.6, 1.55, 0.62, 0, 0.35, 2.25, M.porcelain);                 // tank
    put(1.05, 0.55, 1.25, 0, d / 2, 1.15, M.porcelain);                // bowl body
    put(1.2, 0.1, 0.85, 0, d / 2 + 0.1, 1.76, M.porcelain);            // seat
    put(1.05, 0.08, 0.75, 0, d / 2 + 0.1, 1.7, M.porcelain);
    put(0.18, 0.5, 0.1, F.W / 2 - 0.05, d / 2, 2.0, M.chrome);         // flush plate
    return null;
  },

  tub_freestanding(B, f, M) {
    const F = frame(f), { cyl, at } = mk(B, F);
    const [x0, z0, x1, z1] = f.rect;
    const spanX = x1 - x0, spanZ = z1 - z0;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const rot = spanZ > spanX ? Math.PI / 2 : 0;
    const L = Math.max(spanX, spanZ), Wd = Math.min(spanX, spanZ);
    const place = (y) => new THREE.Matrix4().makeTranslation(cx, y, cz)
      .multiply(new THREE.Matrix4().makeRotationY(rot));
    const shell = new THREE.CylinderGeometry(1, 0.88, 1, 30);
    shell.scale(L / 2, 1.6, Wd / 2);
    B.add(M.porcelain, shell, place(0.8));
    const inner = new THREE.CylinderGeometry(0.95, 0.84, 1, 30);
    inner.scale(L / 2 - 0.28, 1.42, Wd / 2 - 0.28);
    B.add(M.water, inner, place(0.95));
    // floor-mounted filler + a tray of towels on the edge
    const fx = cx + (spanZ > spanX ? Wd / 2 + 0.5 : 0);
    const fz = cz + (spanZ > spanX ? 0 : Wd / 2 + 0.5);
    B.cyl(0.055, 0.055, 3.1, 10, fx, 1.55, fz, M.chrome);
    B.cyl(0.05, 0.05, 0.7, 8, fx, 3.0, fz + (spanZ > spanX ? 0 : -0.35), M.chrome, Math.PI / 2, 0, 0);
    return null;
  },

  shower(B, f, M) {
    const F = frame(f), { put, cyl, cylD } = mk(B, F);
    const w = F.W, d = F.D;
    put(w, 0.22, d, 0, d / 2, 0.11, M.tileWarm);
    put(w, 7.6, 0.12, 0, 0.06, 3.8, M.tileWarm);                       // back wall
    for (const s of [-1, 1]) put(0.12, 7.6, d, s * w / 2, d / 2, 3.8, M.tileWarm);
    put(w * 0.62, 7.0, 0.05, -w * 0.19, 0.03, 3.6, M.glass);           // glass front
    put(0.09, 7.0, 0.09, -w * 0.5, 0.03, 3.6, M.chrome);
    put(0.09, 7.0, 0.09, w * 0.12, 0.03, 3.6, M.chrome);
    put(2.4, 1.4, 0.28, 0, 0.15, 4.4, M.tileWarm);                     // niche
    put(2.5, 0.08, 0.3, 0, 0.15, 3.75, M.chrome);
    put(0.5, 0.35, 0.15, -0.8, 0.2, 3.95, M.bedLinen);
    put(0.5, 0.35, 0.15, 0.8, 0.2, 3.95, M.duvet);
    cyl(0.45, 0.45, 0.06, 20, 0, d * 0.45, 7.2, M.chrome);
    cyl(0.05, 0.05, 1.1, 8, 0, d * 0.45, 7.6, M.chrome);
    cylD(0.14, 0.14, 0.12, 12, w * 0.28, 0.12, 4.2, M.chrome);
    put(0.35, 0.9, 0.1, w * 0.4, 0.1, 2.2, M.chrome);                  // grab bar
    return null;
  },

  wic_run(B, f, M) {
    const F = frame(f), { put, cylW } = mk(B, F);
    const w = F.W, d = F.D, h = f.h || 7.0;
    put(w, h, d - 0.06, 0, d / 2, h / 2, M.cabLight);
    for (const yy of [2.3, 4.5, 6.7]) put(w - 0.1, 0.1, d, 0, d / 2, yy, M.cabLight);
    cylW(0.05, 0.05, w - 0.2, 10, 0, d * 0.65, 5.05, M.chrome);
    // a few folded stacks + shoes
    let seed = 11;
    for (let i = 0; i < 6; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const u = -w / 2 + 0.6 + (seed % 100) / 100 * (w - 1.2);
      const y = [2.3, 4.5, 6.7][seed % 3] + 0.28;
      put(0.85, 0.42, d * 0.7, u, d * 0.55, y, seed % 2 ? M.bedLinen : M.duvet);
    }
    return null;
  },

  towel_bar(B, f, M) {
    const F = frame(f), { put, cylW } = mk(B, F);
    cylW(0.04, 0.04, F.W * 0.9, 8, 0, F.D / 2, f.h || 4.4, M.chrome);
    put(0.85, 1.6, 0.16, 0, F.D / 2, (f.h || 4.4) - 0.8, M.bedLinen);
    return null;
  },

  /* ---------------------------------------------------------- living ----- */
  console(B, f, M) {
    const F = frame(f), { put, cyl } = mk(B, F);
    const w = F.W, d = F.D;
    put(w, 0.18, d, 0, d / 2, 2.6, M.cabWood);
    for (const s of [-1, 1]) put(0.15, 2.5, d - 0.15, s * (w / 2 - 0.18), d / 2, 1.3, M.blackMatte);
    put(w - 0.4, 0.12, d - 0.3, 0, d / 2, 1.1, M.cabWood);
    cyl(0.32, 0.28, 0.6, 14, w * 0.25, d / 2, 3.0, M.pot);
    put(0.9, 0.5, 0.12, -w * 0.2, d / 2, 3.0, M.mirror);
    return null;
  },

  tv_console(B, f, M, o, opts = {}) {
    const F = frame(f), { put } = mk(B, F);
    const w = F.W, d = F.D;
    put(w, 1.55, d, 0, d / 2, 0.88, M.cabWood);
    put(w - 0.1, 0.06, 0.04, 0, d + 0.02, 1.3, M.blackMatte);
    for (const s of [-1, 1]) put(w * 0.4, 0.05, 0.04, s * w * 0.22, d + 0.02, 0.6, M.chrome);
    if (opts.tv) {
      put(w * 0.8, 3.0, 0.1, 0, d * 0.35, 4.3, M.tv);
      put(w * 0.84, 0.1, 0.05, 0, d * 0.32, 2.78, M.blackMatte);
    }
    return null;
  },

  fireplace(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const w = F.W, d = F.D, h = f.h || 8.6;
    put(w, h, d + 0.4, 0, d / 2, h / 2, M.cabDark);                    // chimney mass
    put(w * 0.94, 1.35, 0.14, 0, d + 0.25, 2.55, M.blackMatte);        // linear firebox
    put(w * 0.9, 0.35, 0.2, 0, d + 0.24, 1.85, M.black);
    put(w + 0.35, 0.32, 0.9, 0, d + 0.55, 0.5, M.cabWood);             // hearth bench
    const flames = [];
    const n = Math.max(6, Math.round(w / 0.5));
    for (let i = 0; i < n; i++) {
      const u = -w / 2 + w * (i + 0.5) / n;
      const [px, pz] = F.at(u, d + 0.28);
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 6), M.fire);
      m.position.set(px, 2.15, pz);
      flames.push({ mesh: m, seed: Math.random() * 6.3 });
    }
    return { flames, light: [F.at(0, d / 2)[0], 3.4, F.at(0, d / 2)[1], 0xff9a3c, 0.8, 9] };
  },

  rug(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    put(F.W, 0.06, F.D, 0, F.D / 2, 0.04, M.rug);
    return null;
  },

  floor_lamp(B, f, M) {
    const F = frame(f), { cyl, at } = mk(B, F);
    const h = f.h || 5.6;
    cyl(0.5, 0.55, 0.08, 20, 0, F.D / 2, 0.04, M.blackMatte);
    cyl(0.05, 0.05, h, 10, 0, F.D / 2, h / 2, M.blackMatte);
    cyl(0.8, 0.6, 1.0, 20, 0, F.D / 2, h, M.sofa);
    cyl(0.76, 0.76, 0.05, 20, 0, F.D / 2, h - 0.52, M.lightDisc);
    const [x, z] = at(0, F.D / 2);
    return { light: [x, h - 0.3, z, 0xffd9a8, 0.5, 13] };
  },

  plant(B, f, M) {
    const F = frame(f), { cyl, at, add } = mk(B, F);
    const w = Math.min(F.W, F.D);
    const [x, z] = at(0, F.D / 2);
    const h0 = f.planter_h || 1.5;
    cyl(w * 0.4, w * 0.3, h0, 18, 0, F.D / 2, h0 / 2, M.pot);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * 6.3 + 0.4, r = w * (0.18 + 0.2 * ((i * 37) % 10) / 10);
      const hh = 1.8 + ((i * 53) % 10) / 10 * 1.7;
      cyl(0.09, 0.11, hh, 6, Math.cos(a) * r * 0.5, F.D / 2 + Math.sin(a) * r * 0.5,
        h0 + hh / 2, Math.abs(Math.cos(a)) > 0.5 ? M.leaf : M.leaf2, 0, 0, Math.cos(a) * 0.2);
      add(Math.abs(Math.sin(a)) > 0.5 ? M.leaf : M.leaf2,
        new THREE.IcosahedronGeometry(0.4 + ((i * 29) % 7) / 24, 0),
        Math.cos(a) * r, F.D / 2 + Math.sin(a) * r, h0 + 0.2 + hh);
    }
    return null;
  },

  /* ---------------------------------------------------------- lighting --- */
  pendant(B, f, M, o, opts = {}) {
    const F = frame(f), { cyl } = mk(B, F);
    const n = opts.count || 1, lights = [];
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : (i - (n - 1) / 2) * (F.W / n);
      const [x, z] = F.at(u, F.D / 2);
      const y = f.h || 6.6;
      B.cyl(0.03, 0.03, 9.4 - y, 6, x, (9.4 + y) / 2, z, M.blackMatte);
      B.cyl(0.6, 0.6, 0.7, 20, x, y + 0.28, z, M.blackMatte);
      B.cyl(0.56, 0.56, 0.06, 20, x, y - 0.1, z, M.lightDisc);
      lights.push([x, y - 0.35, z, 0xffdcae, 0.42, 17]);
    }
    return { lights };
  },

  ceiling_light(B, f, M) {
    const F = frame(f), { at } = mk(B, F);
    const [x, z] = at(0, F.D / 2);
    const y = f.h || 8.6;
    B.cyl(0.72, 0.72, 0.1, 22, x, y, z, M.lightDisc);
    B.cyl(0.82, 0.82, 0.07, 22, x, y + 0.09, z, M.blackMatte);
    return { lights: [[x, y - 0.45, z, 0xffe8c8, 0.45, 16]] };
  },

  downlight(B, f, M) {
    const F = frame(f), { at } = mk(B, F);
    const [x, z] = at(0, F.D / 2);
    const y = f.h || 8.75;
    B.cyl(0.42, 0.42, 0.05, 16, x, y + 0.04, z, M.trim);
    B.cyl(0.33, 0.33, 0.03, 16, x, y - 0.01, z, M.lightDisc);
    return null;
  },

  art(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const w = Math.max(F.W, 1.2), h = Math.max(F.D, 1.6);
    const y = f.h || 5.4;
    put(w + 0.16, h + 0.16, 0.08, 0, 0.04, y, M.blackMatte);
    put(w, h, 0.12, 0, 0.06, y, f.motif === 'photo' ? M.rug : M.marble);
    put(w * 0.92, h * 0.92, 0.14, 0, 0.07, y, f.motif === 'photo' ? M.leaf : M.grass);
    return null;
  },

  bench(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const w = F.W, d = F.D;
    put(w, 0.5, d, 0, d / 2, 1.0, M.sofa);
    put(w, 0.14, d, 0, d / 2, 1.32, M.duvet);
    for (const s of [-1, 1]) put(0.16, 0.75, 0.16, s * (w / 2 - 0.2), d / 2, 0.38, M.blackMatte);
    put(w * 0.6, 0.3, d * 0.6, 0, d / 2, 1.55, M.accent);
    return null;
  },

  counter_items(B, f, M) {
    const F = frame(f), { put, cyl } = mk(B, F);
    const w = F.W, d = F.D;
    put(1.1, 0.9, 0.9, -w * 0.32, d * 0.5, 3.45, M.black);            // coffee machine
    put(0.5, 0.25, 0.4, -w * 0.32, d * 0.5, 3.98, M.steel);
    cyl(0.34, 0.26, 0.62, 14, -w * 0.32 + 0.05, d * 0.9, 3.32, M.steel); // kettle
    cyl(0.42, 0.42, 0.05, 14, w * 0.1, d * 0.55, 3.28, M.cabWood);       // board
    cyl(0.36, 0.3, 0.28, 14, w * 0.3, d * 0.55, 3.4, M.pot);
    return null;
  },

  basket(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const w = Math.min(F.W, F.D);
    put(w, 1.6, w, 0, w / 2, 0.8, M.wicker);
    put(w - 0.12, 0.1, w - 0.12, 0, w / 2, 1.64, M.bedLinen);
    return null;
  },

  /* --------------------------------------------------------- outdoors ---- */
  outdoor_sofa(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const w = F.W, d = F.D;
    put(w, 0.45, d, 0, d / 2, 0.45, M.teak);
    put(w, 1.5, 0.35, 0, 0.22, 1.25, M.teak);
    for (const s of [-1, 1]) put(0.3, 1.0, d - 0.15, s * (w / 2 - 0.15), d / 2, 1.05, M.teak);
    for (let i = 0; i < 3; i++)
      put(w / 3 - 0.1, 0.32, d - 0.9, -w / 2 + w * (i + 0.5) / 3, d / 2 + 0.25, 1.28, M.sofa);
    for (const s of [-1, 1]) put(0.6, 0.6, 0.2, s * (w / 3), d * 0.75, 1.5, M.sofaDk, s * 0.4);
    return null;
  },

  outdoor_chair(B, f, M) {
    const F = frame(f), { put } = mk(B, F);
    const w = Math.min(F.W, F.D);
    put(w, 0.42, w, 0, w / 2, 0.45, M.teak);
    put(w, 1.6, 0.3, 0, 0.2, 1.3, M.teak);
    for (const s of [-1, 1]) put(0.25, 0.7, w - 0.15, s * (w / 2 - 0.12), w / 2, 0.9, M.teak);
    put(w - 0.55, 0.28, w - 0.7, 0, w / 2 + 0.12, 1.25, M.sofa);
    return null;
  },

  outdoor_table(B, f, M, o, opts = {}) {
    const F = frame(f), { put } = mk(B, F);
    const w = F.W, d = F.D;
    put(w, 0.16, d, 0, d / 2, 2.42, M.teak);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      put(0.28, 2.34, 0.28, sx * (w / 2 - 0.28), d / 2 + sz * (d / 2 - 0.28), 1.17, M.teak);
    const n = opts.seats || 4, per = Math.round(n / 2);
    for (let side = 0; side < 2; side++) {
      const sign = side ? 1 : -1;
      for (let i = 0; i < per; i++) {
        const u = (i - (per - 1) / 2) * (w / per) * 0.8;
        const [cx, cz] = F.at(u, d / 2 + sign * (d / 2 + 1.0));
        chairAt(B, M, cx, cz, sign > 0 ? Math.PI : 0, M.teak, 1.35);
      }
    }
    return null;
  },

  planter(B, f, M) {
    const F = frame(f), { put, add } = mk(B, F);
    const w = Math.min(F.W, F.D), h = f.h || 2.4;
    put(w, h, w, 0, w / 2, h / 2, M.pot);
    put(w + 0.08, 0.12, w + 0.08, 0, w / 2, h, M.concrete);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      add(i % 2 ? M.leaf : M.leaf2, new THREE.IcosahedronGeometry(0.48 + (i % 3) * 0.13, 0),
        Math.cos(a) * 0.42, w / 2 + Math.sin(a) * 0.42, h + 0.32);
    }
    return null;
  },
};

/* ------------------------------------------------------------- bits ----- */
function chairAt(B, M, x, z, ry, mat, h = 1.45) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const put = (w, hh, d, ox, yy, oz, m) => B.box(w, hh, d, x + ox * c + oz * s, yy, z - ox * s + oz * c, m, ry);
  put(1.6, 0.16, 1.6, 0, h, 0, mat);
  put(1.55, 1.65, 0.15, 0, h + 0.85, -0.72, mat);
  put(1.4, 0.16, 1.4, 0, h + 0.14, 0.06, M.sofa);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    put(0.11, h, 0.11, sx * 0.68, h / 2, sz * 0.68, M.blackMatte);
}

function stoolAt(B, M, x, z) {
  B.cyl(0.72, 0.72, 0.15, 18, x, 2.32, z, M.cabWood);
  B.cyl(0.6, 0.6, 0.11, 18, x, 2.25, z, M.sofa);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.57 + 0.78;
    B.cyl(0.05, 0.05, 2.28, 8, x + Math.cos(a) * 0.43, 1.14, z + Math.sin(a) * 0.43, M.blackMatte);
  }
  B.cyl(0.48, 0.48, 0.05, 12, x, 0.82, z, M.blackMatte);
}

/* --------------------------------------------------------------- main ---- */
export function buildFurniture(plan, M, scene, opts = {}) {
  const colliders = [], lights = [], flames = [], boxes = [];
  const group = new THREE.Group();
  group.name = 'furniture';
  scene.add(group);
  // one shared bag for the browser (a mesh per material), per-item bags when
  // the harness needs to measure each piece
  const shared = opts.perItem ? null : new Bag();
  for (const f of plan.furniture) {
    const fn = builders[f.kind];
    if (!fn) { console.warn('furniture: no builder for', f.kind); continue; }
    const B = shared || new Bag();
    let res = null;
    try { res = fn(B, f, M, {}, f); } catch (e) { console.warn('furniture failed', f.kind, e.message); }
    if (opts.perItem) {
      const meshes = B.build(scene);
      const bbox = new THREE.Box3();
      for (const m of meshes) { m.geometry.computeBoundingBox(); bbox.union(m.geometry.boundingBox); }
      boxes.push({ kind: f.kind, rect: f.rect, face: f.face, box: bbox.isEmpty() ? null : bbox.clone() });
    }
    if (res) {
      if (res.lights) for (const L of res.lights) lights.push({ pos: [L[0], L[1], L[2]], color: L[3], intensity: L[4], dist: L[5] });
      if (res.light) lights.push({ pos: [res.light[0], res.light[1], res.light[2]], color: res.light[3], intensity: res.light[4], dist: res.light[5] || 12 });
      if (res.flames) for (const fl of res.flames) { group.add(fl.mesh); flames.push(fl); }
    }
    if (f.solid) {
      const [x0, z0, x1, z1] = f.rect;
      colliders.push({
        x0, z0, x1, z1, tag: f.kind, low: f.kind === 'rug',
        h: f.h || (f.kind.startsWith('bed') ? 3.8 : 3.0),
      });
    }
  }
  if (shared) shared.build(group);
  return { colliders, lights, flames, boxes, group };
}
