import * as THREE from '../vendor/three.module.js';
import { PLAN } from './plandata.js';
import { materials, textures } from './materials.js';
import { buildArchitecture } from './builder.js';
import { buildFurniture } from './furniture.js';
import { Player } from './player.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#app');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  const card = document.querySelector('#start .card');
  const note = document.createElement('p');
  note.className = 'lead';
  note.innerHTML = '<b>This browser can\'t open a WebGL canvas</b>, so the 3D walkthrough can\'t start. ' +
    'Everything is here though: the top-down plan is on the <a href="assets/plan.png">assets/plan.png</a> page, ' +
    'and the original travel page is still at <a href="site.html">site.html</a>.';
  card.appendChild(note);
  document.querySelector('#jumps').innerHTML = '';
  document.querySelector('#boot').textContent = String(e && e.message || e).slice(0, 90);
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, 1, 0.08, 1200);
const M = materials();

/* ------------------------------------------------------------------ sky --- */
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: {
    top: { value: new THREE.Color(0x2f6ba8) },
    mid: { value: new THREE.Color(0xa8c7dd) },
    bot: { value: new THREE.Color(0xe8dfd2) },
    sun: { value: new THREE.Vector3(-0.35, 0.52, 0.78).normalize() },
    glow: { value: new THREE.Color(0xffe6bd) },
    night: { value: 0 },
  },
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 top, mid, bot, glow, sun; uniform float night; varying vec3 vP;
    void main(){
      float h = clamp(vP.y*0.5+0.5, 0.0, 1.0);
      vec3 c = mix(bot, mid, smoothstep(0.42,0.52,h));
      c = mix(c, top, smoothstep(0.5,0.9,h));
      float d = max(dot(normalize(vP), normalize(sun)), 0.0);
      c += glow * pow(d, 22.0) * 0.9 * (1.0-night);
      c += glow * pow(d, 3.0) * 0.12 * (1.0-night);
      c = mix(c*vec3(0.16,0.19,0.3), c, 1.0-night*0.92);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 20), skyMat);
sky.frustumCulled = false;
scene.add(sky);

const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 24, 16), skyMat.clone()));
const envRT = pmrem.fromScene(envScene, 0.02);
scene.environment = envRT.texture;

/* ---------------------------------------------------------------- lights -- */
const hemi = new THREE.HemisphereLight(0xcfe2ff, 0xa4937c, 0.9);
const ambient = new THREE.AmbientLight(0xffffff, 0.14);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.7);
const SUN_DIR = new THREE.Vector3(-0.30, 0.42, 0.86).normalize();
const SUN_TARGET = new THREE.Vector3(17, 0, 22);
sun.position.copy(SUN_TARGET).addScaledVector(SUN_DIR, 150);
sun.target.position.copy(SUN_TARGET);
scene.add(sun, sun.target);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 40; sc.far = 320;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(ambient);
// bounce light so ceilings and soffits read warm instead of black
const bounce = new THREE.DirectionalLight(0xffe9cf, 0.42);
bounce.position.set(0, -1, 0.2);
scene.add(bounce);

/* ------------------------------------------------------------- geometry --- */
const t0 = performance.now();
const arch = buildArchitecture(PLAN, M, scene);
const furn = buildFurniture(PLAN, M, scene);
const player = new Player(PLAN, camera);
player.colliders = [];
player.addColliders(arch.colliders);
player.addColliders(furn.colliders);
const buildMs = Math.round(performance.now() - t0);

// interior point lights (kept off during the day)
const interior = [];
for (const L of furn.lights) {
  const p = new THREE.PointLight(L.color, 0, L.dist || 18, 1.7);
  p.position.set(L.pos[0], L.pos[1], L.pos[2]);
  p.userData.base = L.intensity * 170;
  scene.add(p);
  interior.push(p);
}

/* ------------------------------------------------------------------ HUD --- */
const hud = {
  room: $('#room'), coords: $('#coords'), compass: $('#compass'), fps: $('#fps'),
  minimap: $('#minimap'), ctx: null, base: null,
};

function drawMinimapBase() {
  const S = 4.6, pad = 8;
  const xs = PLAN.rooms.map(r => r.rect[0]).concat(PLAN.rooms.map(r => r.rect[2]));
  const zs = PLAN.rooms.map(r => r.rect[1]).concat(PLAN.rooms.map(r => r.rect[3]));
  const x0 = Math.min(...xs) - 3, x1 = Math.max(...xs) + 3;
  const z0 = Math.min(...zs) - 3, z1 = Math.max(...zs) + 3;
  const w = (x1 - x0) * S, h = (z1 - z0) * S;
  const c = document.createElement('canvas');
  c.width = w + pad * 2; c.height = h + pad * 2;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(18,20,24,0.82)'; g.fillRect(0, 0, c.width, c.height);
  const P = (x, z) => [pad + (x - x0) * S, pad + (z - z0) * S];
  for (const r of PLAN.rooms) {
    const [a, b, cc, d] = r.rect;
    const p0 = P(a, b), p1 = P(cc, d);
    g.fillStyle = r.kind === 'out' ? 'rgba(120,140,120,0.5)'
      : r.kind === 'void' ? 'rgba(40,60,80,0.85)'
        : r.floor === 'tile' ? 'rgba(206,214,212,0.55)'
          : r.floor === 'carpet' ? 'rgba(196,186,168,0.5)' : 'rgba(214,186,142,0.5)';
    g.fillRect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]);
  }
  g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1;
  for (const wl of PLAN.walls) {
    if (wl.axis === 'x') { const p0 = P(wl.a, wl.c), p1 = P(wl.b, wl.c); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); }
    else { const p0 = P(wl.c, wl.a), p1 = P(wl.c, wl.b); g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); }
  }
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2;
  for (const o of PLAN.openings) {
    if (o.kind !== 'win' && o.kind !== 'slider') continue;
    const a0 = o.at - o.w / 2, a1 = o.at + o.w / 2;
    const p0 = o.axis === 'x' ? P(a0, o.line) : P(o.line, a0);
    const p1 = o.axis === 'x' ? P(a1, o.line) : P(o.line, a1);
    g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke();
  }
  return { canvas: c, P, S, x0, z0 };
}

function initMinimap() {
  const c = hud.minimap;
  if (!c) return;
  const b = drawMinimapBase();
  hud.base = b;
  c.width = b.canvas.width;
  c.height = b.canvas.height;
  hud.ctx = c.getContext('2d');
  c.style.width = Math.round(c.width / 2) + 'px';
}
function drawMinimap() {
  const c = hud.minimap;
  if (!c || !hud.ctx) return;
  const g = hud.ctx, b = hud.base;
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(b.canvas, 0, 0);
  const [px, pz] = b.P(player.pos.x, player.pos.z);
  g.save();
  g.translate(px, pz); g.rotate(-player.yaw);
  g.fillStyle = '#ffd479';
  g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = '11px system-ui, sans-serif';
  g.fillText('N', c.width - 16, 15);
  g.beginPath(); g.moveTo(c.width - 14, 20); g.lineTo(c.width - 11, 30); g.lineTo(c.width - 17, 30); g.closePath(); g.fill();
}

/* ------------------------------------------------------------ view modes -- */
const state = { mode: 'day', roofs: true };
function setMode(mode) {
  state.mode = mode;
  const day = mode === 'day';
  skyMat.uniforms.night.value = day ? 0 : 1;
  hemi.intensity = day ? 0.9 : 0.3;
  hemi.color.set(day ? 0xcfe2ff : 0x3d4a66);
  ambient.intensity = day ? 0.14 : 0.09;
  sun.intensity = day ? 2.7 : 0.22;
  sun.color.set(day ? 0xfff0d8 : 0xffd0a0);
  renderer.toneMappingExposure = day ? 1.02 : 1.25;
  for (const p of interior) p.intensity = day ? 0 : p.userData.base;
  document.body.dataset.mode = mode;
  for (const el of document.querySelectorAll('[data-mode-btn]')) {
    el.classList.toggle('on', el.dataset.modeBtn === mode);
  }
}
function toggleRoofs(on) {
  state.roofs = on;
  scene.traverse((o) => { if (o.userData.roof) o.visible = on; });
  for (const m of arch.roofMeshes || []) m.visible = on;
}

/* ------------------------------------------------------------- controls --- */
function lockPointer() {
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
}
canvas.addEventListener('click', lockPointer);
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  document.body.dataset.locked = locked ? '1' : '0';
  if (!locked) toast('Click anywhere to look around again');
});
function toggleFurnished() {
  const f = scene.getObjectByName('furniture');
  if (!f) return;
  f.visible = !f.visible;
  document.body.dataset.furnished = f.visible ? '1' : '0';
  $('#furn-btn').classList.toggle('on', !f.visible);
  toast(f.visible ? 'Furnished' : 'Empty shell — just the architecture');
}
$('#furn-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleFurnished();
});
window.__toggleFurnished = toggleFurnished;
$('#roof-btn').addEventListener('click', (e) => { e.stopPropagation(); toggleRoofs(!state.roofs); toast(state.roofs ? 'Roof on' : 'Roof off — look down into the plan'); });
$('#plan-btn').addEventListener('click', (e) => { e.stopPropagation(); $('#planov').classList.toggle('on'); });
$('#reset-btn').addEventListener('click', (e) => { e.stopPropagation(); player.goto(23.0, 20.4, Math.PI); toast('Back to the top of the stairs'); });
$('#plan-close').addEventListener('click', (e) => { e.stopPropagation(); $('#planov').classList.remove('on'); });
for (const el of document.querySelectorAll('[data-mode-btn]')) {
  el.addEventListener('click', (e) => { e.stopPropagation(); setMode(el.dataset.modeBtn); toast(el.dataset.modeBtn === 'day' ? 'Daylight' : 'Evening — interior lights on'); });
}
$('#start').addEventListener('click', () => { $('#start').classList.add('hidden'); lockPointer(); });
$('#start-go').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#start').classList.add('hidden');
  lockPointer();
});
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  player.keys.add(k);
  if (k === 'f') { player.fly = !player.fly; toast(player.fly ? 'Fly mode on — E up / Q down' : 'Walking'); }
  if (k === 'r') { player.goto(21.5, 21.0, Math.PI); toast('Back to the top of the stairs'); }
  if (k === 'm') { hud.minimap.classList.toggle('hidden'); }
  if (k === 'g') { $('#furn-btn').dispatchEvent(new MouseEvent('click')); }
  if (k === 'p') { $('#planov').classList.toggle('on'); }
  if (k === 'h') { $('#help').classList.toggle('hidden'); }
  if (k === 'n') { setMode(state.mode === 'day' ? 'dusk' : 'day'); }
  if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup', (e) => player.keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => player.keys.clear());
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) player.look(e.movementX, e.movementY);
});
addEventListener('wheel', (e) => { if (!$('#planov').classList.contains('on')) player.eye = Math.max(4.2, Math.min(7.6, player.eye + e.deltaY * 0.002)); }, { passive: true });

// touch: left half drags to walk, right half looks
const touches = new Map();
canvas.addEventListener('touchstart', (e) => {
  for (const t of e.changedTouches) touches.set(t.identifier, { x: t.clientX, y: t.clientY, side: t.clientX < innerWidth / 2, ox: t.clientX, oy: t.clientY });
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    const s = touches.get(t.identifier); if (!s) continue;
    if (s.side) player.touch.move = { x: (t.clientX - s.ox) / 90, y: (t.clientY - s.oy) / 90 };
    else player.look((t.clientX - s.x) * 1.6, (t.clientY - s.y) * 1.6);
    s.x = t.clientX; s.y = t.clientY;
  }
  e.preventDefault();
}, { passive: false });
const endTouch = (e) => { for (const t of e.changedTouches) { const s = touches.get(t.identifier); if (s && s.side) player.touch.move = null; touches.delete(t.identifier); } };
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);

/* --------------------------------------------------------------- toast ---- */
let toastT;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200);
}

/* --------------------------------------------------------- quick jumps ---- */
const jumpBox = $('#jumps');
for (const L of PLAN.labels) {
  const b = document.createElement('button');
  b.textContent = L.name;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    const yaw = (L.id === 'balcony' || L.id === 'patio') ? Math.PI : (L.id === 'master' ? Math.PI / 2 : Math.PI);
    player.goto(L.jump[0], L.jump[1], yaw);
    $('#start').classList.add('hidden');
    lockPointer();
    toast(L.name);
  });
  jumpBox.appendChild(b);
}

/* ----------------------------------------------------------- door swing --- */
function updateDoors(dt) {
  for (const d of arch.doors) {
    if (d.group) {
      const dx = d.group.position.x - player.pos.x, dz = d.group.position.z - player.pos.z;
      const near = Math.hypot(dx, dz) < 7.5;
      const target = near ? d.open : 0;
      d.cur = d.cur === undefined ? d.open * 0.55 : d.cur;
      d.cur += (target - d.cur) * Math.min(1, dt * 3.2);
      d.group.rotation.y = d.cur;
    } else if (d.mesh) {
      const dx = d.mesh.position.x - player.pos.x, dz = d.mesh.position.z - player.pos.z;
      d.mesh.position.copy(d.pivot).addScaledVector(new THREE.Vector3(d.axis === 'x' ? 1 : 0, 0, d.axis === 'z' ? 1 : 0), (Math.hypot(dx, dz) < 7 ? 0.85 : 0) * d.len);
    }
  }
}

/* ----------------------------------------------------------------- loop --- */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let last = performance.now(), fpsT = 0, frames = 0, quality = 2;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  player.update(dt, camera);
  updateDoors(dt);
  // fire flicker
  const t = now * 0.001;
  for (const f of furn.flames) {
    const s = 1 + Math.sin(t * 7 + f.seed) * 0.16 + Math.sin(t * 13.3 + f.seed * 2) * 0.09;
    f.mesh.scale.set(0.85 + s * 0.15, s, 0.85 + s * 0.15);
    f.mesh.rotation.y = t * 1.7 + f.seed;
  }
  const r = player.currentRoom();
  hud.room.textContent = r.name || 'Outside';
  hud.coords.textContent = `${player.pos.x.toFixed(1)}′ , ${player.pos.z.toFixed(1)}′  ·  ${
    player.pos.y < -0.3 ? 'lower level' : 'upper floor'}`;
  const deg = ((-player.yaw * 180 / Math.PI) % 360 + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  hud.compass.textContent = `${dirs[Math.round(deg / 45) % 8]}  ${deg.toFixed(0)}°`;
  drawMinimap();
  frames++;
  if (now - fpsT > 500) {
    const fps = frames * 1000 / (now - fpsT);
    hud.fps.textContent = `${Math.round(fps)} fps`;
    frames = 0; fpsT = now;
    // adaptive resolution: keep the walk smooth on modest GPUs
    if (fps < 28 && renderer.getPixelRatio() > 0.75 && quality > 0) quality = Math.max(0, quality - 1);
    else if (fps > 55 && quality < 2) quality = Math.min(2, quality + 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 2 ? 2 : quality === 1 ? 1.35 : 0.9));
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ boot -- */
initMinimap();
setMode('day');
player.goto(23.6, 21.2, Math.PI + 0.35);
player.update(0.016, camera);
camera.position.set(player.pos.x, player.eyeY, player.pos.z);
renderer.shadowMap.needsUpdate = true;
$('#start-go').focus();
$('#boot').textContent = `built in ${buildMs} ms · ${PLAN.furniture.length} furniture groups · ${
  PLAN.stats.area_union.toLocaleString()} sq ft`;
requestAnimationFrame(frame);

// expose for debugging / tooling
window.ELSEWHERE = { scene, camera, renderer, PLAN, player, arch, furn };
document.body.dataset.ready = '1';
