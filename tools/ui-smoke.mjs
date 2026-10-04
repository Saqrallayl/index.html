// UI smoke test: runs src/main.js against a DOM shim and a stubbed
// WebGLRenderer, then drives keyboard / mouse / button input for a few
// seconds. Catches wiring mistakes in the entry point that the headless
// geometry harness cannot see (missing element ids, typos, undefined calls).
//
//   node --experimental-default-type=module tools/ui-smoke.mjs

/* ------------------------------------------------------------- 2d canvas -- */
class Ctx2D {
  constructor(c) { this.canvas = c; this.ops = 0; this._t = ''; }
  _c(...a) { this.ops++; return this; }
  set fillStyle(v) { this._f = v; } get fillStyle() { return this._f; }
  set strokeStyle(v) { this._s = v; } get strokeStyle() { return this._s; }
  getImageData(x, y, w, h) {
    return { data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h };
  }
  putImageData() { this.ops++; }
  measureText(t) { return { width: (t || '').length * 6 }; }
  createLinearGradient() { return { addColorStop: () => {} }; }
  createRadialGradient() { return { addColorStop: () => {} }; }
  createPattern() { return {}; }
  drawImage() { this.ops++; }
  getContextAttributes() { return {}; }
}
for (const m of ['fillRect', 'strokeRect', 'clearRect', 'beginPath', 'closePath', 'moveTo', 'lineTo',
  'arc', 'arcTo', 'ellipse', 'rect', 'fill', 'stroke', 'save', 'restore', 'translate', 'rotate',
  'scale', 'transform', 'setTransform', 'clip', 'fillText', 'strokeText', 'strokeText', 'roundRect',
  'bezierCurveTo', 'quadraticCurveTo', 'setLineDash', 'drawFocusIfNeeded']) {
  Ctx2D.prototype[m] = function () { this.ops++; return this; };
}
Ctx2D.prototype.getTransform = function () { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; };

/* ------------------------------------------------------------------ DOM -- */
const registry = new Map();
class ClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(...c) { c.forEach(x => this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  toggle(c, f) { const on = f === undefined ? !this.set.has(c) : f; on ? this.set.add(c) : this.set.delete(c); return on; }
  contains(c) { return this.set.has(c); }
}
class El {
  constructor(tag, id = '') {
    this.tagName = tag.toUpperCase(); this.id = id; this.dataset = {}; this.style = {};
    this.children = []; this._h = new Map(); this.classList = new ClassList(this);
    this.width = 320; this.height = 240; this.textContent = ''; this._html = '';
    this._ctx = null; this.focused = false; this.value = '';
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = v; }
  addEventListener(t, f) { if (!this._h.has(t)) this._h.set(t, []); this._h.get(t).push(f); }
  removeEventListener() {}
  dispatch(t, ev = {}) {
    const e = Object.assign({ type: t, target: this, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} }, ev);
    for (const f of this._h.get(t) || []) f(e);
    return e;
  }
  getContext(kind) { if (kind !== '2d') return null; return (this._ctx = this._ctx || new Ctx2D(this)); }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter(x => x !== c); }
  setAttribute(k, v) { this[k] = v; }
  removeAttribute() {}
  getAttribute(k) { return this[k] ?? null; }
  hasAttribute(k) { return k in this; }
  focus() { this.focused = true; }
  blur() {}
  closest() { return null; }
  getBoundingClientRect() { return { left: 0, top: 0, right: 1280, bottom: 800, width: 1280, height: 800 }; }
  requestPointerLock() { this._lockTried = true; return Promise.reject(new Error('pointer lock blocked in shim')); }
  releasePointerLock() { return Promise.resolve(); }
  get clientWidth() { return 1280; }
  get clientHeight() { return 800; }
}
function get(sel) {
  const key = String(sel);
  if (!registry.has(key)) {
    const id = key.startsWith('#') ? key.slice(1) : '';
    registry.set(key, new El(id === 'app' || key.includes('minimap') ? 'canvas' : 'div', id));
  }
  return registry.get(key);
}
for (const [sel, mk] of [
  ['#jumps', () => new El('div')], ['#planov', () => new El('div')], ['#roof-btn', () => new El('button')],
  ['#plan-btn', () => new El('button')], ['#reset-btn', () => new El('button')], ['#plan-close', () => new El('button')],
  ['#start', () => new El('div')], ['#start-go', () => new El('button')], ['#boot', () => new El('div')],
  ['#toast', () => new El('div')], ['#help', () => new El('div')], ['#minimap', () => new El('canvas')],
  ['#app', () => new El('canvas')], ['#room', () => new El('div')], ['#coords', () => new El('div')],
  ['#compass', () => new El('div')], ['#fps', () => new El('div')], ['#toast', () => new El('div')],
]) registry.set(sel, mk());
const modeBtns = [new El('button'), new El('button')];
modeBtns[0].dataset.modeBtn = 'day'; modeBtns[1].dataset.modeBtn = 'dusk';

globalThis.document = {
  createElement: (t) => new El(t),
  createElementNS: () => new El('div'),
  getElementById: (id) => get('#' + id),
  querySelector: (s) => get(s),
  querySelectorAll: (s) => (s === '[data-mode-btn]' ? modeBtns : []),
  addEventListener: () => {},
  body: new El('body'),
  pointerLockElement: null,
  exitPointerLock() {},
};
globalThis.devicePixelRatio = 1;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 800;

/* ------------------------------------------------------- window + events -- */
const win = new Map();
globalThis.addEventListener = (t, f) => { if (!win.has(t)) win.set(t, []); win.get(t).push(f); };
globalThis.removeEventListener = () => {};
globalThis.dispatch = (t, ev = {}) => {
  const e = Object.assign({ type: t, preventDefault() {}, stopPropagation() {} }, ev);
  for (const f of win.get(t) || []) f(e);
  return e;
};
globalThis.window = globalThis;
globalThis.self = globalThis;
let rafCbs = [];
globalThis.requestAnimationFrame = (cb) => { rafCbs.push(cb); return rafCbs.length; };
globalThis.cancelAnimationFrame = () => {};
let clock = 0;
globalThis.performance = { now: () => clock };

/* -------------------------------------------- stub three's GPU renderer -- */
const THREE = await import('../vendor/three.module.js');
const shim = { ...THREE };
shim.WebGLRenderer = class {
  constructor(opts = {}) {
    this.domElement = opts.canvas || new El('canvas');
    this.shadowMap = { enabled: true, type: 0, needsUpdate: false };
    this.info = { render: { triangles: 0, calls: 0 }, programs: [], memory: {} };
    this.capabilities = { isWebGL2: true, getMaxAnisotropy: () => 16 };
    this._ratio = 1;
  }
  setPixelRatio(r) { this._ratio = r; }
  getPixelRatio() { return this._ratio; }
  setSize(w, h) { this._w = w; this._h = h; }
  render(scene, cam) {
    let tris = 0, calls = 0;
    scene.traverse((o) => {
      if (o.isMesh && o.visible !== false) {
        calls++;
        if (o.geometry?.attributes?.position) tris += o.geometry.attributes.position.count / 3;
      }
    });
    this.info.render.triangles = tris; this.info.render.calls = calls;
    this.lastScene = scene; this.lastCamera = cam;
    this.frames = (this.frames || 0) + 1;
  }
  setAnimationLoop() {}
  compile() {}
  dispose() {}
  getRenderTarget() { return null; }
  setRenderTarget() {}
  clear() {}
  get outputColorSpace() { return this._ocs; }
  set outputColorSpace(v) { this._ocs = v; }
};
shim.PMREMGenerator = class {
  constructor() {}
  fromScene() { return { texture: new THREE.Texture(), dispose() {} }; }
  dispose() {}
  compileEquirectangularShader() {}
};
shim.ShaderMaterial = THREE.ShaderMaterial;

// main.js imports the real module path; mirror the shim over it via a loader.
const path = new URL('../src/main.js', import.meta.url);
const source = (await import('node:fs')).readFileSync(path, 'utf8')
  .replace("from '../vendor/three.module.js'", "from '__SHIM__'")
  .replace(/from '\.\//g, "from '../src/")
  .replace("'__SHIM__'", "'./three-shim.mjs'");
(await import('node:fs')).writeFileSync(new URL('./_main_shim.mjs', import.meta.url), source);
(await import('node:fs')).writeFileSync(new URL('./three-shim.mjs', import.meta.url), `
import * as THREE from '../vendor/three.module.js';
export * from '../vendor/three.module.js';
export class WebGLRenderer {
  constructor(opts = {}) {
    this.domElement = opts.canvas;
    this.shadowMap = { enabled: true, needsUpdate: false };
    this.info = { render: { triangles: 0, calls: 0 }, programs: [] };
    this.capabilities = { getMaxAnisotropy: () => 16 };
    this._ratio = 1;
    this.frames = 0;
    globalThis.__renderer = this;
  }
  setPixelRatio(r) { this._ratio = r; }
  getPixelRatio() { return this._ratio; }
  setSize(w, h) { this._w = w; this._h = h; }
  render(scene, cam) {
    let tris = 0, calls = 0;
    scene.traverse((o) => {
      if (o.isMesh && o.visible !== false) {
        calls++;
        if (o.geometry && o.geometry.attributes && o.geometry.attributes.position)
          tris += o.geometry.attributes.position.count / 3;
      }
    });
    this.info.render.triangles = tris; this.info.render.calls = calls;
    this.frames++;
    globalThis.__lastRender = { tris, calls, frames: this.frames };
  }
  setAnimationLoop() {} compile() {} dispose() {} clear() {}
  setRenderTarget() {} getRenderTarget() { return null; }
}
export class PMREMGenerator {
  constructor() {}
  fromScene() { return { texture: new THREE.Texture(), dispose() {} }; }
  dispose() {}
}
`);

/* -------------------------------------------------------------- run it --- */
const errors = [];
process.on('uncaughtException', (e) => {
  errors.push('uncaught: ' + e.message);
  console.log('THREW during frame loop:\n  ' + (e.stack || e.message).split('\n').slice(0, 8).join('\n  '));
  summarize();
  process.exit(1);
});
process.on('unhandledRejection', (e) => {
  const m = e && e.message || e;
  if (String(m).includes('pointer lock')) return;         // expected in the shim
  errors.push('unhandled: ' + m);
  console.log('unhandled rejection:', m);
});
function summarize() {
  const r = globalThis.__lastRender || { tris: 0, calls: 0, frames: 0 };
  console.log('\n--- summary ---');
  console.log(`renderer: ${r.tris} triangles, ${r.calls} draw calls, ${r.frames} frames`);
  if (globalThis.ELSEWHERE) {
    const P = globalThis.ELSEWHERE.player;
    console.log(`player:   ${P.pos.x.toFixed(1)}, ${P.pos.y.toFixed(1)}, ${P.pos.z.toFixed(1)}`);
  }
  if (errors.length) { console.log('FAILURES:'); errors.forEach(e => console.log('  - ' + e)); }
}

let mod;
try {
  mod = await import(new URL('./_main_shim.mjs', import.meta.url).href + '?v=' + Date.now());
} catch (e) {
  console.log('FAIL  main.js threw while loading:\n  ' + (e.stack || e.message).split('\n').slice(0, 6).join('\n  '));
  process.exit(1);
}
console.log('ok    main.js loaded');
console.log(`ok    scene booted: ${globalThis.ELSEWHERE.scene.children.length} top-level objects, ready=`,
  document.body.dataset.ready);

const run = (seconds, t0) => {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) {
    clock += 1000 / 60;
    const cbs = rafCbs; rafCbs = [];
    for (const cb of cbs) cb(clock);
  }
};
run(0.5);
console.log(`ok    first frames rendered: tris=${globalThis.__lastRender.tris} calls=${globalThis.__lastRender.calls}`);

/* input: walk forward */
const P = globalThis.ELSEWHERE.player;
const start = P.pos.clone();
globalThis.dispatch('keydown', { key: 'w' });
run(2.0);
globalThis.dispatch('keyup', { key: 'w' });
const moved = P.pos.distanceTo(start);
console.log(`${moved > 2 ? 'ok   ' : 'FAIL '} walked ${moved.toFixed(2)} ft with W held`);
if (moved <= 2) errors.push('player did not move');

/* input: turn and strafe */
globalThis.dispatch('mousemove', { movementX: 240, movementY: 40 });
run(0.2);
console.log(`ok    look: yaw=${P.yaw.toFixed(2)} pitch=${P.pitch.toFixed(2)}`);

/* input: fly + reset + eye height */
globalThis.dispatch('keydown', { key: 'f' });
globalThis.dispatch('keydown', { key: 'e' });
run(0.6);
globalThis.dispatch('keyup', { key: 'e' });
const flew = P.pos.y > 0.6;
globalThis.dispatch('keydown', { key: 'f' });
globalThis.dispatch('keydown', { key: 'r' });
run(0.4);
console.log(`${flew ? 'ok   ' : 'FAIL '} fly mode climbed to y=${P.pos.y.toFixed(2)}`);
if (!flew) errors.push('fly mode did not climb');

globalThis.dispatch('wheel', { deltaY: 120 });
run(0.2);
console.log(`ok    eye height ${P.eye.toFixed(2)} ft after wheel`);

/* buttons */
for (const btn of ['#roof-btn', '#furn-btn', '#plan-btn', '#plan-close', '#reset-btn', '#start-go']) {
  try { get(btn).dispatch('click'); } catch (e) { errors.push(`${btn}: ${e.message}`); }
}
for (const b of modeBtns) { try { b.dispatch('click'); } catch (e) { errors.push('mode btn: ' + e.message); } }
console.log('ok    tool buttons + mode toggles dispatched');

/* furniture toggle actually hides geometry */
{
  const f = globalThis.ELSEWHERE.scene.getObjectByName('furniture');
  const before = f.visible;
  get('#furn-btn').dispatch('click');
  run(0.2);
  const after = f.visible;
  console.log(`${after !== before ? 'ok   ' : 'FAIL '} furnished toggle: ${before} -> ${after} (${f.children.length} meshes)`);
  if (after === before) errors.push('furniture toggle did nothing');
  get('#furn-btn').dispatch('click');
  run(0.1);
}

/* jump to every labelled spot, walk a moment, and check for a valid floor */
const bad = [];
for (const L of globalThis.ELSEWHERE.PLAN.labels) {
  P.goto(L.jump[0], L.jump[1], Math.PI);
  run(0.4);
  const y = P.pos.y;
  if (!isFinite(y) || y < -10.5 || y > 12) bad.push(`${L.id} y=${y}`);
}
console.log(`${bad.length ? 'FAIL ' : 'ok   '} every quick-jump lands on a floor${bad.length ? ': ' + bad.join(', ') : ''}`);
if (bad.length) errors.push('bad jumps ' + bad.join(','));

/* stair descent end to end */
P.goto(23.0, 20.4, Math.PI);
globalThis.dispatch('keydown', { key: 'w' });
globalThis.dispatch('keydown', { key: 'shift' });
run(7.0);
globalThis.dispatch('keyup', { key: 'w' });
globalThis.dispatch('keyup', { key: 'shift' });
const descended = P.pos.y < -8;
console.log(`${descended ? 'ok   ' : 'FAIL '} walked down the stair to y=${P.pos.y.toFixed(2)} (z=${P.pos.z.toFixed(1)})`);
if (!descended) errors.push('stair descent failed');

/* touch controls */
globalThis.dispatch('touchstart', { changedTouches: [{ identifier: 1, clientX: 200, clientY: 400 }] });
globalThis.dispatch('touchmove', { changedTouches: [{ identifier: 1, clientX: 200, clientY: 330 }] });
run(1.0);
globalThis.dispatch('touchend', { changedTouches: [{ identifier: 1, clientX: 200, clientY: 330 }] });
console.log('ok    touch move + look handled');

/* long run for stability */
run(3.0);
console.log(`ok    ${globalThis.__lastRender.frames} frames rendered without throwing`);

/* summary */
const r = globalThis.__lastRender;
console.log('\n--- summary ---');
console.log(`renderer: ${r.tris} triangles, ${r.calls} draw calls per frame`);
console.log(`player:   ${P.pos.x.toFixed(1)}, ${P.pos.y.toFixed(1)}, ${P.pos.z.toFixed(1)} in "${get('#room').textContent}"`);
console.log(`hud:      compass="${get('#compass').textContent}" coords="${get('#coords').textContent}"`);
if (errors.length) {
  console.log('\nFAILURES:');
  for (const e of errors) console.log('  - ' + e);
  process.exit(1);
}
console.log('\nall UI smoke checks passed');
