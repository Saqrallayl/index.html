// Parametric furniture + fixtures. Every item is a footprint rect plus the
// direction its front faces; builders work in local (u = along the width,
// v = depth from the back) coordinates which resolve to world space.
import * as THREE from '../vendor/three.module.js';
import { Bag } from './builder.js';

const FRONT = { 0: [0, -1], 90: [1, 0], 180: [0, 1], 270: [-1, 0] };   // N E S W

function frame(f) {
  const [x0, z0, x1, z1] = f.rect;
  const fx = FRONT[f.face] || [0, -1];
  const cxw = (x0 + x1) / 2, czw = (z0 + z1) / 2;
  const alongX = Math.abs(fx[1]) > 0.5;          // faces N/S -> width runs along x
  const W = alongX ? x1 - x0 : z1 - z0;          // width
  const D = alongX ? z1 - z0 : x1 - x0;          // depth, back -> front
  const at = (u, v) => {
    if (alongX) return fx[1] > 0 ? [cxw + u, z0 + v] : [cxw + u, z1 - v];
    return fx[0] > 0 ? [x0 + v, czw + u] : [x1 - v, czw + u];
  };
  return { at, W, D, fx, alongX };
}

// helpers ---------------------------------------------------------------
const putF = (B, F) => (w, h, d, u, v, y, mat, ry = 0) => {
  const [x, z] = F.at(u, v); B.box(w, h, d, x, y, z, mat, ry);
};
const cylF = (B, F) => (r0, r1, h, seg, u, v, y, mat, rx = 0, ry = 0, rz = 0) => {
  const [x, z] = F.at(u, v); B.cyl(r0, r1, h, seg, x, y, z, mat, rx, ry, rz);
};
const rectOf = (F, w, d) => { const [x, z] = F.at(0, d / 2); return [x, z, w, d]; };

/* ------------------------------------------------------------- builders -- */
const builders = {
  bed(B, f, M, o, size) {
    const [bw, bd] = size;
    const F = frame(f), put = putF(B, F);
    const u = -F.W / 2 + 0.25 + bw / 2;
    put(bw + 0.35, 0.8, bd + 0.3, u, bd / 2 + 0.15, 0.4, M.cabWood);      // platform
    put(bw + 0.5, 3.8, 0.3, u, 0.15, 1.9, M.sofaDk);                     // headboard
    put(bw + 0.2, 0.6, bd - 0.1, u, bd / 2 + 0.3, 1.15, M.bedLinen);      // mattress
    put(bw + 0.24, 0.22, bd * 0.7, u, bd * 0.68 + 0.3, 1.55, M.duvet);    // duvet
    put(bw + 0.24, 0.16, bd * 0.22, u, bd * 0.92, 1.66, M.duvet);
    for (const s of [-1, 1]) {
      put(bw * 0.45, 0.38, 1.05, u + s * bw * 0.24, 0.95, 1.62, M.bedLinen, s * 0.06);
      put(bw * 0.38, 0.3, 0.75, u + s * bw * 0.23, 1.35, 1.76, M.duvet, s * 0.12);
    }
    put(bw + 0.28, 0.14, 1.0, u, bd - 0.85, 1.64, M.accent);             // throw
    return null;
  },
  bed_queen(B, f, M, o) { return builders.bed(B, f, M, o, [5.0, 6.67]); },
  bed_king(B, f, M, o) { return builders.bed(B, f, M, o, [6.33, 6.67]); },

  nightstand(B, f, M) {
    const F = frame(f), put = putF(B, F), cyl = cylF(B, F);
    const w = F.W - 0.12, d = F.D - 0.12;
    const [x, z] = F.at(0, d / 2);
    B.box(w, 2.0, d, x, 1.3, z, M.cabWood);
    B.box(w + 0.12, 0.14, d + 0.12, x, 2.36, z, M.quartz);
    B.box(w - 0.2, 0.05, 0.05, x, 1.55, z + (F.alongX ? d / 2 : 0), M.chrome);
    cyl(0.12, 0.18, 0.85, 12, 0, F.D / 2, 2.85, M.chrome);
    cyl(0.5, 0.38, 0.95, 18, 0, F.D / 2, 3.75, M.sofa);
    return { light: [x, 3.7, z, 0xffe6bd, 0.3, 12] };
  },

  dresser(B, f, M) {
    const F = frame(f), put = putF(B, F);
    const w = F.W - 0.12, d = F.D - 0.12;
    const [x, z] = F.at(0, d / 2);
    B.box(w, 2.85, d, x, 1.43, z, M.cabWood);
    B.box(w + 0.1, 0.14, d + 0.06, x, 2.9, z, M.quartz);
    for (let i = 0; i < 3; i++) put(w - 0.2, 0.05, 0.04, 0, d + 0.01, 2.3 - i * 0.85, M.blackMatte);
    return null;
  },

  closet_double(B, f, M) {
    const F = frame(f), put = putF(B, F), cyl = cylF(B, F);
    const w = F.W, d = F.D - 0.04, h = f.h || 7.5;
    const [x, z] = F.at(0, d / 2);
    B.box(w, h, d, x, h / 2, z, M.trim);
    for (const s of [-1, 1]) {
      put(w / 2 - 0.05, h - 0.2, 0.05, s * w / 4, d + 0.02, h / 2, M.trim);
      cyl(0.04, 0.04, 0.8, 8, s * 0.1, d + 0.1, h * 0.52, M.chrome);
    }
    B.box(w + 0.06, 0.16, d + 0.06, x, h + 0.05, z, M.trim);
    return null;
  },

  sofa(B, f, M, o, seats, opts = {}) {
    const F = frame(f), put = putF(B, F);
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
    const F = frame(f), put = putF(B, F);
    const W = Math.min(F.W, F.D), D = Math.max(F.W, F.D) * 0.9;
    const mat = opts.mat || M.sofa;
    put(W, 0.45, D, 0, D / 2, 0.42, mat);
    put(W, 2.4, 0.45, 0, 0.28, 1.4, mat);
    for (const s of [-1, 1]) put(0.4, 1.6, D - 0.28, s * (W / 2 - 0.2), D / 2, 1.2, mat);
    put(W - 0.9, 0.34, D - 0.95, 0, D / 2 + 0.22, 1.3, opts.cushion || mat);
    put(W - 0.95, 0.95, 0.35, 0, 0.7, 1.78, opts.cushion || mat, 0.1);
    return null;
  },

  coffee_table(B, f, M) {
    const F = frame(f), put = putF(B, F);
    const w = F.W, d = F.D;
    const [x, z] = F.at(0, d / 2);
    B.box(w, 0.16, d, x, 1.32, z, M.cabWood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      B.box(0.2, 1.26, 0.2, x + sx * (w / 2 - 0.22), 0.66, z + sz * (d / 2 - 0.22), M.blackMatte);
    B.box(w - 0.6, 0.1, d - 0.6, x, 0.52, z, M.cabWood);
    B.cyl(0.32, 0.26, 0.5, 12, x - w * 0.18, 1.62, z, M.pot);
    return null;
  },

  side_table(B, f, M) {
    const F = frame(f);
    const w = Math.min(F.W, 1.6);
    const [x, z] = F.at(0, F.D / 2);
    B.cyl(w / 2, w / 2, 0.15, 16, x, 1.85, z, M.marble);
    B.cyl(0.08, 0.08, 1.8, 10, x, 0.9, z, M.chrome);
    B.cyl(w / 2.4, w / 2.6, 0.1, 16, x, 0.05, z, M.chrome);
    return null;
  },

  dining_table(B, f, M, o, opts = {}) {
    const F = frame(f), put = putF(B, F);
    const w = F.W, d = F.D, top = 2.5;
    const [x, z] = F.at(0, d / 2);
    B.box(w, 0.2, d, x, top, z, M.cabWood);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const lx = x + sx * (w / 2 - 0.45), lz = z + sz * (d / 2 - 0.45);
      B.box(0.26, top - 0.1, 0.26, lx, (top - 0.1) / 2, lz, M.blackMatte);
      B.box(0.32, 0.1, 0.32, lx, 0.05, lz, M.blackMatte);
    }
    const n = opts.seats || 6, per = Math.round(n / 2);
    for (let side = 0; side < 2; side++) {
      const sign = side ? 1 : -1;
      for (let i = 0; i < per; i++) {
        const u = (i - (per - 1) / 2) * (w / per) * 0.92;
        const [cxr, czr] = F.at(u, d / 2 + sign * (d / 2 + 1.05));
        chairAt(B, M, cxr, czr, sign > 0 ? Math.PI : 0, M.sofa, 1.45);
      }
    }
    return null;
  },

  counter_run(B, f, M) {
    const F = frame(f), put = putF(B, F);
    const w = F.W, d = F.D, h = 2.95;
    const [x, z] = F.at(0, d / 2);
    B.box(w, h - 0.35, d - 0.15, x, (h - 0.35) / 2 + 0.35, z, M.cabLight);
    B.box(w - 0.4, 0.36, d - 0.6, x, 0.18, z, M.blackMatte);
    B.box(w + 0.1, 0.2, d + 0.12, x, h + 0.1, z, M.quartz);
    put(w, 0.32, 0.1, 0, 0.02, h + 0.35, M.quartz);
    const n = Math.max(2, Math.round(w / 2.4));
    for (let i = 0; i < n; i++) put(1.1, 0.05, 0.05, -w / 2 + w * (i + 0.5) / n, d + 0.02, h - 0.5, M.chrome);
    return null;
  },

  upper_cab(B, f, M) {
    const F = frame(f), put = putF(B, F);
    const w = F.W, d = F.D, y0 = 4.9, y1 = f.h || 7.6;
    const [x, z] = F.at(0, d / 2);
    B.box(w, y1 - y0, d, x, (y0 + y1) / 2, z, M.cabLight);
    const n = Math.max(2, Math.round(w / 2.2));
    for (let i = 0; i < n; i++) put(1.0, 0.05, 0.04, -w / 2 + w * (i + 0.5) / n, d + 0.02, y0 + 0.2, M.chrome);
    return null;
  },

  fridge(B, f, M) {
    const F = frame(f), put = putF(B, F), cyl = cylF(B, F);
    const w = Math.min(F.W, 3.0), d = F.D, h = f.h || 5.9;
    const [x, z] = F.at(0, d / 2);
    B.box(w, h, d, x, h / 2, z, M.steel);
    put(w - 0.1, 0.05, 0.05, 0, d + 0.03, h * 0.62, M.blackMatte);
    put(w - 0.1, 0.05, 0.05, 0, d + 0.03, h * 0.34, M.blackMatte);
    cyl(0.05, 0.05, 1.6, 8, -w * 0.3, d + 0.12, h * 0.52, M.chrome);
    cyl(0.05, 0.05, 1.6, 8, w * 0.3, d + 0.12, h * 0.52, M.chrome);
    return null;
  },

  range(B, f, M) {
    const F = frame(f), put = putF(B, F);
    const w = Math.min(F.W, 2.6), d = F.D;
    const [x, z] = F.at(0, d / 2);
    B.box(w, 2.95, d, x, 1.47, z, M.steel);
    put(w - 0.12, 1.45, 0.06, 0, d + 0.02, 1.4, M.black);
    put(w - 0.2, 0.75, 0.05, 0, d + 0.04, 2.5, M.blackMatte);
    B.box(w + 0.08, 0.1, d + 0.06, x, 3.0, z, M.black);
    for (const s of [-1, 1]) for (const t of [-1, 1])
      B.cyl(0.26, 0.26, 0.04, 14, x + s * w * 0.24, 3.07, z + t * d * 0.22, M.blackMatte);
    for (let i = 0; i < 4; i++) put(0.09, 0.09, 0.14, -w / 2 + 0.28 + i * 0.28, d + 0.04, 2.72, M.chrome, 0);
    return null;
  },

  hood(B, f, M) {
    const F = frame(f), put = putF(B, F);
    const w = Math.min(F.W, 2.7), d = Math.min(F.D, 1.9);
    const [x, z] = F.at(0, d / 2);
    B.box(w, 0.8, d, x, 5.55, z, M.steel);
    B.box(w * 0.5, 4.4, d * 0.62, x, 7.9, z - (F.alongX ? 0 : d * 0.18), M.steel);
    for (const s of [-1, 1]) put(w * 0.12, 0.5, 0.05, s * w * 0.4, d * 0.3, 5.5, M.blackMatte);
    return null;
  },

  island(B, f, M, o, opts = {}) {
    const F = frame(f), put = putF(B, F), cyl = cylF(B, F);
    const w = F.W, d = F.D, h = 3.0;
    const [x, z] = F.at(0, d / 2);
    B.box(w, h - 0.3, d, x, (h - 0.3) / 2 + 0.3, z, M.cabDark);
    B.box(w - 0.4, 0.32, d - 0.5, x, 0.16, z, M.blackMatte);
    B.box(w + 0.35, 0.22, d + 0.45, x, h + 0.11, z, M.quartz);
    // undermount double sink
    put(2.6, 0.26, 1.5, -w / 4, d / 2, h + 0.03, M.steel);
    put(1.15, 0.18, 1.2, -w / 4 - 0.62, d / 2, h - 0.06, M.blackMatte);
    put(1.15, 0.18, 1.2, -w / 4 + 0.62, d / 2, h - 0.06, M.blackMatte);
    cyl(0.06, 0.06, 1.0, 10, -w / 4, d * 0.3, h + 0.5, M.chrome);
    put(0.9, 0.06, 0.06, -w / 4, d * 0.3, h + 1.0, M.chrome);
    // dishwasher
    put(2.35, 2.4, 0.05, w / 4, d + 0.01, 1.5, M.steel);
    put(2.0, 0.05, 0.06, w / 4, d + 0.05, 2.5, M.chrome);
    const n = opts.stools || 4;
    for (let i = 0; i < n; i++) {
      const u = -w / 2 + w * (i + 0.5) / n;
      const [bx, bz] = F.at(u, d + 0.85);
      stoolAt(B, M, bx, bz);
    }
    return null;
  },

  pantry(B, f, M) {
    const F = frame(f), put = putF(B, F), cyl = cylF(B, F);
    const w = F.W, d = F.D, h = f.h || 7.8;
    const [x, z] = F.at(0, d / 2);
    B.box(w, h, d, x, h / 2, z, M.cabLight);
    for (let i = 0; i < 3; i++) {
      put(w - 0.1, 0.04, 0.04, 0, d + 0.02, 2.2 + i * 2.5, M.blackMatte);
      cyl(0.04, 0.04, 1.0, 8, w * 0.2, d + 0.12, 3.2 + i * 2.5, M.chrome);
    }
    return null;
  },
  broom_closet(B, f, M) { return builders.pantry(B, f, M); },

  washer_dryer(B, f, M) {
    const F = frame(f), put = putF(B, F), cyl = cylF(B, F);
    const w = F.W, d = F.D;
    const [x, z] = F.at(0, d / 2);
    for (const s of [-1, 1]) {
      put(w / 2 - 0.14, 3.05, d - 0.15, s * w * 0.25, d / 2, 1.55, M.appliance);
      put(w / 2 - 0.14, 0.05, 0.04, s * w * 0.25, d + 0.02, 3.0, M.blackMatte);
      cyl(0.8, 0.8, 0.12, 18, s * w * 0.25, d + 0.02, 1.65, M.steel, Math.PI / 2, 0, 0);
      cyl(0.58, 0.58, 0.16, 18, s * w * 0.25, d + 0.05, 1.65, M.black, Math.PI / 2, 0, 0);
    }
    put(w + 0.1, 0.2, d + 0.3, 0, d / 2, 3.2, M.quartz);
    put(1.9, 0.3, 1.3, -w * 0.3, d * 0.55, 3.05, M.steel);
    put(1.65, 0.22, 1.05, -w * 0.3, d * 0.55, 2.96, M.blackMatte);
    cyl(0.06, 0.06, 0.9, 10, -w * 0.3, d * 0.2, 3.55, M.chrome);
    return null;
  },

  vanity(B, f, M, o, opts = {}) {
    const F = frame(f), put = putF(B, F), cyl = cylF(B, F);
    const w = F.W, d = F.D, h = 2.9;
    const [x, z] = F.at(0, d / 2);
    B.box(w, h - 0.3, d, x, (h - 0.3) / 2 + 0.3, z, M.cabLight);
    B.box(w - 0.35, 0.3, d - 0.45, x, 0.15, z, M.blackMatte);
    B.box(w + 0.08, 0.2, d + 0.08, x, h + 0.1, z, M.marble);
    put(w, 0.3, 0.1, 0, 0.02, h + 0.35, M.marble);
    const n = opts.sinks || 1;
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : (i - (n - 1) / 2) * (w / n) * 0.9;
      put(1.6, 0.3, 1.2, u, d / 2, h + 0.1, M.porcelain);
      put(1.35, 0.2, 0.95, u, d / 2, h + 0.01, M.porcelain);
      cyl(0.05, 0.05, 0.8, 10, u, d * 0.15, h + 0.5, M.chrome);
      put(0.7, 0.06, 0.06, u, d * 0.15, h + 0.9, M.chrome);
      put(1.0, 0.05, 0.04, u, d + 0.01, h * 0.62, M.chrome);
    }
    return null;
  },

  mirror(B, f, M) {
    const F = frame(f), put = putF(B, F);
    const w = F.W, d = Math.max(F.D, 0.05), h = f.h || 6.9;
    const [x, z] = F.at(0, d / 2);
    B.box(w + 0.14, h - 2.95, d + 0.03, x, (h + 2.95) / 2, z, M.trim);
    B.box(w, h - 2.95, d + 0.06, x, (h + 2.95) / 2, z + 0.0, M.mirror);
    return null;
  },

  wc_toilet(B, f, M) {
    const F = frame(f), put = putF(B, F);
    const [x, z] = F.at(0, F.D / 2);
    const t = F.at(0, 0.35);
    B.box(F.alongX ? 1.6 : 0.62, 1.55, F.alongX ? 0.62 : 1.6, t[0], 2.25, t[1], M.porcelain);
    B.box(F.alongX ? 1.05 : 1.25, 0.55, F.alongX ? 1.25 : 1.05, x, 1.15, z, M.porcelain);
    B.cyl(0.6, 0.5, 0.5, 18, x, 1.5, z, M.porcelain);
    B.box(F.alongX ? 1.2 : 1.0, 0.1, F.alongX ? 1.0 : 1.2, x, 1.76, z, M.porcelain);
    B.box(F.alongX ? 1.05 : 0.85, 0.08, F.alongX ? 0.85 : 1.05, x, 1.7, z, M.porcelain);
    return null;
  },

  tub_freestanding(B, f, M) {
    const F = frame(f), cyl = cylF(B, F);
    const [x0, z0, x1, z1] = f.rect;
    const spanX = x1 - x0, spanZ = z1 - z0;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const rot = spanZ > spanX ? Math.PI / 2 : 0;       // long axis follows the rect
    const L = Math.max(spanX, spanZ), Wd = Math.min(spanX, spanZ);
    const m = (y) => new THREE.Matrix4()
      .multiply(new THREE.Matrix4().makeRotationY(rot))
      .multiply(new THREE.Matrix4().makeTranslation(0, y, 0))
      .premultiply(new THREE.Matrix4().makeTranslation(cx, 0, cz));
    const shell = new THREE.CylinderGeometry(1, 0.88, 1, 30);
    shell.scale(L / 2, 1.6, Wd / 2);
    B.add(M.porcelain, shell, m(0.8));
    const inner = new THREE.CylinderGeometry(0.95, 0.84, 1, 30);
    inner.scale(L / 2 - 0.28, 1.42, Wd / 2 - 0.28);
    B.add(M.water, inner, m(0.95));
    const [fx, fz] = F.at(0, F.D / 2);
    B.cyl(0.055, 0.055, 3.0, 10, fx + (spanZ > spanX ? Wd / 2 + 0.55 : 0), 1.5, fz + (spanZ > spanX ? 0 : Wd / 2 + 0.55), M.chrome);
    return null;
  },

  shower(B, f, M) {
    const F = frame(f), put = putF(B, F), cyl = cylF(B, F);
    const w = F.W, d = F.D;
    const [x, z] = F.at(0, d / 2);
    B.box(w, 0.22, d, x, 0.11, z, M.tileWarm);
    put(w, 7.6, 0.12, 0, 0.06, 3.8, M.tileWarm);
    for (const s of [-1, 1]) put(0.12, 7.6, d, s * w / 2, d / 2, 3.8, M.tileWarm);
    put(w * 0.62, 7.0, 0.05, -w * 0.19, 0.03, 3.6, M.glass);
    put(0.09, 7.0, 0.09, -w * 0.5, 0.03, 3.6, M.chrome);
    put(0.09, 7.0, 0.09, w * 0.12, 0.03, 3.6, M.chrome);
    put(2.4, 1.4, 0.28, 0, 0.15, 4.4, M.tileWarm);
    put(2.5, 0.08, 0.3, 0, 0.15, 3.75, M.chrome);
    cyl(0.45, 0.45, 0.06, 20, 0, d * 0.45, 7.2, M.chrome);
    cyl(0.05, 0.05, 1.1, 8, 0, d * 0.45, 7.6, M.chrome);
    cyl(0.14, 0.14, 0.12, 12, w * 0.28, 0.12, 4.2, M.chrome, Math.PI / 2, 0, 0);
    return null;
  },

  wic_run(B, f, M) {
    const F = frame(f), put = putF(B, F), cyl = cylF(B, F);
    const w = F.W, d = F.D, h = f.h || 7.0;
    const [x, z] = F.at(0, d / 2);
    B.box(w, h, d - 0.06, x, h / 2, z, M.cabLight);
    for (const yy of [2.3, 4.5, 6.7]) put(w - 0.1, 0.1, d, 0, d / 2, yy, M.cabLight);
    cyl(0.05, 0.05, w - 0.2, 10, 0, d * 0.65, 5.1, M.chrome, 0, 0, Math.PI / 2);
    return null;
  },

  towel_bar(B, f, M) {
    const F = frame(f), cyl = cylF(B, F);
    cyl(0.04, 0.04, Math.max(F.W, F.D) * 0.9, 8, 0, F.D / 2, f.h || 4.4, M.chrome, F.alongX ? 0 : Math.PI / 2, 0, F.alongX ? Math.PI / 2 : 0);
    const [x, z] = F.at(0, F.D / 2);
    B.box(F.alongX ? 0.85 : 0.16, 1.6, F.alongX ? 0.16 : 0.85, x, (f.h || 4.4) - 0.8, z, M.bedLinen);
    return null;
  },

  tv_console(B, f, M, o, opts = {}) {
    const F = frame(f), put = putF(B, F);
    const w = F.W, d = F.D;
    const [x, z] = F.at(0, d / 2);
    B.box(w, 1.55, d, x, 0.88, z, M.cabWood);
    put(w - 0.1, 0.06, 0.04, 0, d + 0.02, 1.3, M.blackMatte);
    for (const s of [-1, 1]) put(w * 0.4, 0.05, 0.04, s * w * 0.22, d + 0.02, 0.6, M.chrome);
    if (opts.tv) {
      put(w * 0.8, 3.0, 0.1, 0, d * 0.35, 4.3, M.tv);
      put(w * 0.84, 0.1, 0.05, 0, d * 0.32, 2.78, M.blackMatte);
    } else {
      put(w - 0.7, 1.1, 0.06, 0, d + 0.02, 3.4, M.mirror);
    }
    return null;
  },

  fireplace(B, f, M) {
    const F = frame(f), put = putF(B, F);
    const w = F.W, d = F.D, h = f.h || 8.6;
    const [x, z] = F.at(0, d / 2);
    B.box(w, h, d + 0.4, x, h / 2, z, M.cabDark);
    put(w * 0.94, 1.35, 0.14, 0, d + 0.25, 2.55, M.blackMatte);
    put(w * 0.9, 0.35, 0.2, 0, d + 0.24, 1.85, M.black);
    put(w + 0.3, 0.32, 0.85, 0, d + 0.75, 0.5, M.cabWood);
    const flames = [];
    const n = Math.max(6, Math.round(w / 0.5));
    for (let i = 0; i < n; i++) {
      const u = -w / 2 + w * (i + 0.5) / n;
      const [px, pz] = F.at(u, d + 0.28);
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.8, 6), M.fire);
      m.position.set(px, 2.15, pz);
      flames.push({ mesh: m, seed: Math.random() * 6.3 });
    }
    return { flames, light: [x, 3.4, z, 0xff9a3c, 0.8, 9] };
  },

  pendant(B, f, M, o, opts = {}) {
    const F = frame(f), cyl = cylF(B, F);
    const n = opts.count || 1, lights = [];
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : (i - (n - 1) / 2) * (F.W / n);
      const [x, z] = F.at(u, F.D / 2);
      const y = f.h || 6.6;
      B.cyl(0.03, 0.03, 9.4 - y, 6, x, (9.4 + y) / 2, z, M.blackMatte);
      B.cyl(0.6, 0.6, 0.7, 20, x, y + 0.28, z, M.blackMatte);
      B.cyl(0.56, 0.56, 0.06, 20, x, y - 0.1, z, M.lightDisc);
      lights.push([x, y - 0.35, z, 0xffdcae, 0.45, 17]);
    }
    return { lights };
  },

  ceiling_light(B, f, M) {
    const F = frame(f);
    const [x, z] = F.at(0, F.D / 2);
    const y = f.h || 8.6;
    B.cyl(0.72, 0.72, 0.1, 22, x, y, z, M.lightDisc);
    B.cyl(0.82, 0.82, 0.07, 22, x, y + 0.09, z, M.blackMatte);
    return { lights: [[x, y - 0.45, z, 0xffe8c8, 0.5, 16]] };
  },

  floor_lamp(B, f, M) {
    const F = frame(f);
    const [x, z] = F.at(0, F.D / 2);
    const h = f.h || 5.6;
    B.cyl(0.5, 0.55, 0.08, 20, x, 0.04, z, M.blackMatte);
    B.cyl(0.05, 0.05, h, 10, x, h / 2, z, M.blackMatte);
    B.cyl(0.8, 0.6, 1.0, 20, x, h, z, M.sofa);
    B.cyl(0.76, 0.76, 0.05, 20, x, h - 0.52, z, M.lightDisc);
    return { light: [x, h - 0.3, z, 0xffd9a8, 0.55, 13] };
  },

  rug(B, f, M) {
    const F = frame(f);
    const [x, z] = F.at(0, F.D / 2);
    B.box(F.W, 0.06, F.D, x, 0.04, z, M.rug);
    return null;
  },

  plant(B, f, M) {
    const F = frame(f);
    const [x, z] = F.at(0, F.D / 2);
    const w = Math.min(F.W, F.D);
    B.cyl(w * 0.4, w * 0.3, 1.5, 18, x, 0.75, z, M.pot);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * 6.3 + 0.4, r = w * (0.18 + 0.2 * ((i * 37) % 10) / 10);
      const hh = 1.8 + ((i * 53) % 10) / 10 * 1.7;
      B.cyl(0.09, 0.11, hh, 6, x + Math.cos(a) * r * 0.5, 1.5 + hh / 2, z + Math.sin(a) * r * 0.5,
        Math.abs(Math.cos(a)) > 0.5 ? M.leaf : M.leaf2, 0, 0, Math.cos(a) * 0.2);
      B.add(Math.abs(Math.sin(a)) > 0.5 ? M.leaf : M.leaf2, new THREE.IcosahedronGeometry(0.4 + ((i * 29) % 7) / 24, 0),
        new THREE.Matrix4().makeTranslation(x + Math.cos(a) * r, 1.7 + hh, z + Math.sin(a) * r));
    }
    return null;
  },

  planter(B, f, M) {
    const F = frame(f);
    const [x, z] = F.at(0, F.D / 2);
    const w = Math.min(F.W, F.D), h = f.h || 2.4;
    B.box(w, h, w, x, h / 2, z, M.pot);
    B.box(w + 0.08, 0.12, w + 0.08, x, h, z, M.concrete);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      B.add(i % 2 ? M.leaf : M.leaf2, new THREE.IcosahedronGeometry(0.48 + (i % 3) * 0.13, 0),
        new THREE.Matrix4().makeTranslation(x + Math.cos(a) * 0.42, h + 0.32, z + Math.sin(a) * 0.42));
    }
    return null;
  },

  outdoor_sofa(B, f, M) {
    const F = frame(f), put = putF(B, F);
    const w = F.W, d = F.D;
    put(w, 0.45, d, 0, d / 2, 0.45, M.teak);
    put(w, 1.5, 0.35, 0, 0.22, 1.25, M.teak);
    for (const s of [-1, 1]) put(0.3, 1.0, d - 0.15, s * (w / 2 - 0.15), d / 2, 1.05, M.teak);
    for (let i = 0; i < 3; i++)
      put(w / 3 - 0.1, 0.32, d - 0.9, -w / 2 + w * (i + 0.5) / 3, d / 2 + 0.25, 1.28, M.sofa);
    return null;
  },

  outdoor_chair(B, f, M) {
    const F = frame(f), put = putF(B, F);
    const w = Math.min(F.W, F.D);
    put(w, 0.42, w, 0, w / 2, 0.45, M.teak);
    put(w, 1.6, 0.3, 0, 0.2, 1.3, M.teak);
    for (const s of [-1, 1]) put(0.25, 0.7, w - 0.15, s * (w / 2 - 0.12), w / 2, 0.9, M.teak);
    put(w - 0.55, 0.28, w - 0.7, 0, w / 2 + 0.12, 1.25, M.sofa);
    return null;
  },

  outdoor_table(B, f, M, o, opts = {}) {
    const F = frame(f), put = putF(B, F);
    const w = F.W, d = F.D;
    const [x, z] = F.at(0, d / 2);
    B.box(w, 0.16, d, x, 2.42, z, M.teak);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      B.box(0.28, 2.34, 0.28, x + sx * (w / 2 - 0.28), 1.17, z + sz * (d / 2 - 0.28), M.teak);
    const n = opts.seats || 4, per = Math.round(n / 2);
    for (let side = 0; side < 2; side++) {
      const sign = side ? 1 : -1;
      for (let i = 0; i < per; i++) {
        const u = (i - (per - 1) / 2) * (w / per) * 0.8;
        const [cxr, czr] = F.at(u, d / 2 + sign * (d / 2 + 1.0));
        chairAt(B, M, cxr, czr, sign > 0 ? Math.PI : 0, M.teak, 1.35);
      }
    }
    return null;
  },

  console(B, f, M) {
    const F = frame(f), put = putF(B, F);
    const w = F.W, d = F.D;
    const [x, z] = F.at(0, d / 2);
    B.box(w, 0.18, d, x, 2.6, z, M.cabWood);
    for (const s of [-1, 1]) B.box(0.15, 2.5, d - 0.15, x + s * (w / 2 - 0.18), 1.3, z, M.blackMatte);
    B.cyl(0.32, 0.28, 0.6, 14, x + w * 0.25, 3.0, z, M.pot);
    return null;
  },
};

/* ------------------------------------------------------------- bits ----- */
function chairAt(B, M, x, z, ry, mat, h = 1.45) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const put = (w, hh, d, ox, yy, oz, m) => {
    B.box(w, hh, d, x + ox * c + oz * s, yy, z - ox * s + oz * c, m, ry);
  };
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
export function buildFurniture(plan, M, scene) {
  const B = new Bag();
  const colliders = [], lights = [], flames = [];
  for (const f of plan.furniture) {
    const fn = builders[f.kind];
    if (!fn) { console.warn('furniture: no builder for', f.kind); continue; }
    let res = null;
    try { res = fn(B, f, M, {}, f); } catch (e) { console.warn('furniture failed', f.kind, e); }
    if (res) {
      if (res.lights) for (const L of res.lights) lights.push({ pos: [L[0], L[1], L[2]], color: L[3], intensity: L[4], dist: L[5] });
      if (res.light) lights.push({ pos: [res.light[0], res.light[1], res.light[2]], color: res.light[3], intensity: res.light[4], dist: res.light[5] || 12 });
      if (res.flames) for (const fl of res.flames) { scene.add(fl.mesh); flames.push(fl); }
    }
    if (f.solid) {
      const [x0, z0, x1, z1] = f.rect;
      colliders.push({
        x0, z0, x1, z1, tag: f.kind, low: ['rug'].includes(f.kind),
        h: f.h || (f.kind.startsWith('bed') ? 3.8 : 3.0),
      });
    }
  }
  B.build(scene);
  return { colliders, lights, flames };
}
