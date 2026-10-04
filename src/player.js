// First-person walk controller: gravity-free walking on the floor / stairs,
// circle-vs-AABB collision, pointer-lock look and touch support.
import * as THREE from '../vendor/three.module.js';

const EYE = 5.6;                       // eye height above the floor
const WALK = 9.5, RUN = 17.0;          // ft/s
const ACC = 9.0, DAMP = 11.0;
const RADIUS = 0.8;

export class Player {
  constructor(plan, camera) {
    this.plan = plan;
    this.camera = camera;
    this.pos = new THREE.Vector3(21.5, 0, 21.0);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;                // looking south down the stairs
    this.pitch = -0.05;
    this.eye = EYE;
    this.fly = false;
    this.eyeY = EYE;
    this.bob = 0;
    this.keys = new Set();
    this.touch = { move: null, look: null };
    this.onStair = false;
    this.buildGrid();
  }

  /* ---------------------------------------------------------- internals -- */
  addColliders(list) {
    for (const c of list) {
      if (c.low) continue;
      this.colliders.push(c);
    }
    this.buildGrid();
  }

  buildGrid() {
    this.cell = 8;
    this.grid = new Map();
    this.colliders = this.colliders || [];
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      const x0 = Math.floor(c.x0 / this.cell), x1 = Math.floor(c.x1 / this.cell);
      const z0 = Math.floor(c.z0 / this.cell), z1 = Math.floor(c.z1 / this.cell);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
        const k = x + ':' + z;
        let a = this.grid.get(k); if (!a) { a = []; this.grid.set(k, a); }
        if (!a.includes(c)) a.push(c);
      }
    }
  }

  nearby(x, z, pad = 0) {
    const out = [];
    const x0 = Math.floor((x - pad) / this.cell), x1 = Math.floor((x + pad) / this.cell);
    const z0 = Math.floor((z - pad) / this.cell), z1 = Math.floor((z + pad) / this.cell);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const a = this.grid.get(i + ':' + j);
      if (a) for (const c of a) if (!out.includes(c)) out.push(c);
    }
    return out;
  }

  ceilAt(x, z) {
    let h = 9.0;
    for (const r of this.plan.rooms) {
      if (r.kind === 'void') continue;
      const [a, b, c, d] = r.rect;
      if (x >= a - 0.3 && x <= c + 0.3 && z >= b - 0.3 && z <= d + 0.3) h = Math.max(h, r.ceil);
    }
    return h;
  }

  /** floor height under (x,z): upper floor 0, stair treads, or the ground */
  groundAt(x, z) {
    const S = this.plan.stair, V = this.plan.void, e = this.plan.bounds;
    if (x > S.x0 - 0.4 && x < S.x1 + 0.4 && z > S.z_top - 0.5 && z < S.z_top + S.tread * (S.risers - 1) + 0.5) {
      const i = Math.floor((z - S.z_top) / S.tread);
      const rise = 10 / S.risers;
      return -rise * Math.min(S.risers - 1, Math.max(0, i + 1));
    }
    if (z > S.z_top + S.tread * (S.risers - 1) && x > S.x0 - 2 && x < S.x1 + 2 && z < 40.5) return this.plan.lower.y + 0.02;
    if (x > V[0] - 0.3 && x < V[2] + 0.3 && z > V[1] - 0.3 && z < V[3] + 0.3) return this.plan.lower.y + 0.02;
    // inside the upper envelope or a deck?
    for (const r of this.plan.rooms) {
      if (r.kind === 'void') continue;
      const [a, b, c, d] = r.rect;
      if (x >= a - 0.6 && x <= c + 0.6 && z >= b - 0.6 && z <= d + 0.6) return 0;
    }
    return this.plan.lower.y - 0.35;
  }

  /* ------------------------------------------------------------- update -- */
  update(dt, cam) {
    const k = this.keys;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    let ax = 0, az = 0;
    if (k.has('w') || k.has('arrowup')) az += 1;
    if (k.has('s') || k.has('arrowdown')) az -= 1;
    if (k.has('d') || k.has('arrowright')) ax += 1;
    if (k.has('a') || k.has('arrowleft')) ax -= 1;
    if (this.touch.move && (Math.abs(this.touch.move.x) > 0.08 || Math.abs(this.touch.move.y) > 0.08)) {
      ax += this.touch.move.x; az -= this.touch.move.y;
    }
    const mag = Math.hypot(ax, az);
    if (mag > 1) { ax /= mag; az /= mag; }
    const speed = (k.has('shift') ? RUN : WALK) * (this.fly ? 1.7 : 1);
    const wish = new THREE.Vector3()
      .addScaledVector(fwd, az).addScaledVector(right, ax);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    // vertical: fly mode rises with e/q, otherwise follow the floor
    if (this.fly) {
      let vy = 0;
      if (k.has('e') || k.has(' ')) vy += 1;
      if (k.has('q')) vy -= 1;
      this.vel.y = vy * speed * 0.7;
      this.vel.x += (wish.x - this.vel.x) * Math.min(1, ACC * dt);
      this.vel.z += (wish.z - this.vel.z) * Math.min(1, ACC * dt);
      this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
      this.pos.y += this.vel.y * dt;
      this.eyeY = this.pos.y + this.eye;
    } else {
      this.vel.x += (wish.x - this.vel.x) * Math.min(1, ACC * dt);
      this.vel.z += (wish.z - this.vel.z) * Math.min(1, ACC * dt);
      this.vel.x *= Math.max(0, 1 - DAMP * dt * 0.06);
      this.vel.z *= Math.max(0, 1 - DAMP * dt * 0.06);
      this.move(this.vel.x * dt, this.vel.z * dt);
      const g = this.groundAt(this.pos.x, this.pos.z);
      this.pos.y += (g - this.pos.y) * Math.min(1, 12 * dt);
      // walking bob
      const sp = Math.hypot(this.vel.x, this.vel.z);
      this.bob += dt * sp * 1.9;
      const bobY = Math.sin(this.bob) * Math.min(0.075, sp * 0.008);
      this.eyeY = this.pos.y + this.eye + bobY;
      this.onStair = Math.abs(g) > 0.2;
    }

    const target = new THREE.Vector3(this.pos.x, this.eyeY, this.pos.z);
    cam.position.lerp(target, Math.min(1, 18 * dt));
    if (cam.position.distanceTo(target) < 0.001) cam.position.copy(target);
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  /** circle vs AABB resolution, a few relaxation passes */
  move(dx, dz) {
    this.pos.x += dx; this.pos.z += dz;
    for (let pass = 0; pass < 3; pass++) {
      let hit = false;
      const near = this.nearby(this.pos.x, this.pos.z, RADIUS + 0.2);
      for (const c of near) {
        if (c.maxY !== undefined && this.pos.y > c.maxY) continue;
        if (c.h !== undefined && this.pos.y + 1.6 > c.h) continue;
        const cx = Math.max(c.x0, Math.min(this.pos.x, c.x1));
        const cz = Math.max(c.z0, Math.min(this.pos.z, c.z1));
        let nx = this.pos.x - cx, nz = this.pos.z - cz;
        let d = Math.hypot(nx, nz);
        if (d > RADIUS) continue;
        if (d < 1e-5) {                         // deep inside: push out the short way
          const left = this.pos.x - c.x0, right = c.x1 - this.pos.x;
          const up = this.pos.z - c.z0, down = c.z1 - this.pos.z;
          const m = Math.min(left, right, up, down);
          if (m === left) this.pos.x = c.x0 - RADIUS;
          else if (m === right) this.pos.x = c.x1 + RADIUS;
          else if (m === up) this.pos.z = c.z0 - RADIUS;
          else this.pos.z = c.z1 + RADIUS;
          hit = true; continue;
        }
        const push = (RADIUS - d) + 0.001;
        nx /= d; nz /= d;
        this.pos.x += nx * push; this.pos.z += nz * push;
        if (Math.abs(nx) > Math.abs(nz)) this.vel.x *= 0.2; else this.vel.z *= 0.2;
        hit = true;
      }
      if (!hit) break;
    }
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch -= dy * 0.0022;
    const lim = this.fly ? 1.5 : 1.35;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  goto(x, z, yaw) {
    this.pos.set(x, this.fly ? 5.6 : this.groundAt(x, z), z);
    this.eyeY = this.pos.y + this.eye;
    this.camera.position.set(x, this.eyeY, z);
    if (yaw !== undefined) this.yaw = yaw;
    this.vel.set(0, 0, 0);
  }

  currentRoom() {
    const { x, z } = this.pos;
    let best = null;
    for (const r of this.plan.rooms) {
      const [a, b, c, d] = r.rect;
      if (x >= a && x <= c && z >= b && z <= d) {
        if (!best || r.kind !== 'void') best = r;
        if (r.kind === 'in' || r.kind === 'out') return best;
      }
    }
    return best || { name: '' };
  }
}
