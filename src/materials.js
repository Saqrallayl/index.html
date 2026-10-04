// Procedural textures + material library. Everything is generated on a canvas
// so the walkthrough has no external asset dependencies.
import * as THREE from '../vendor/three.module.js';

let seed = 20261004;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function finish(c, rx = 1, ry = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ wood ---
function woodTex(w = 1024, h = 1024, tone = [168, 122, 78], planks = 7) {
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = `rgb(${tone[0]},${tone[1]},${tone[2]})`; g.fillRect(0, 0, w, h);
  const pw = w / planks;
  for (let i = 0; i < planks; i++) {
    const t = 0.82 + rnd() * 0.34;
    g.fillStyle = `rgb(${tone[0] * t | 0},${tone[1] * t | 0},${tone[2] * t | 0})`;
    g.fillRect(i * pw, 0, pw, h);
    // grain streaks
    for (let s = 0; s < 150; s++) {
      const x = i * pw + rnd() * pw, y0 = rnd() * h, len = 40 + rnd() * 320;
      g.strokeStyle = `rgba(${tone[0] * 0.55 | 0},${tone[1] * 0.55 | 0},${tone[2] * 0.55 | 0},${0.05 + rnd() * 0.12})`;
      g.lineWidth = 0.6 + rnd() * 2.1;
      g.beginPath(); g.moveTo(x, y0);
      g.bezierCurveTo(x + (rnd() - 0.5) * 8, y0 + len * 0.4, x + (rnd() - 0.5) * 8, y0 + len * 0.7, x + (rnd() - 0.5) * 5, y0 + len);
      g.stroke();
    }
    // knots
    if (rnd() > 0.55) {
      const kx = i * pw + pw * (0.25 + rnd() * 0.5), ky = rnd() * h, r = 5 + rnd() * 9;
      for (let k = 5; k > 0; k--) {
        g.strokeStyle = `rgba(70,44,26,${0.05 + k * 0.02})`; g.lineWidth = 1.4;
        g.beginPath(); g.ellipse(kx, ky, r * k / 5, r * k / 5 * 0.6, 0, 0, 6.3); g.stroke();
      }
    }
    // plank seams
    g.fillStyle = 'rgba(38,24,14,0.5)'; g.fillRect(i * pw, 0, 1.8, h);
    const ends = 1 + (rnd() * 2 | 0);
    for (let e = 0; e < ends; e++) g.fillRect(i * pw, (h * (e + 0.5) / (ends + 1)) | 0, pw, 2);
  }
  return c;
}

// ------------------------------------------------------------------ tile ---
function tileTex(size = 1024, n = 2, grout = [176, 172, 166], body = [238, 238, 234], warm = 0) {
  const c = canvas(size, size), g = c.getContext('2d');
  g.fillStyle = `rgb(${grout[0]},${grout[1]},${grout[2]})`; g.fillRect(0, 0, size, size);
  const s = size / n, gap = Math.max(2, size / 340);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const t = 0.94 + rnd() * 0.1;
    g.fillStyle = `rgb(${Math.min(255, body[0] * t + warm) | 0},${body[1] * t | 0},${body[2] * t | 0})`;
    g.fillRect(i * s + gap, j * s + gap, s - gap * 2, s - gap * 2);
    for (let k = 0; k < 60; k++) {   // faint stone mottling
      const x = i * s + gap + rnd() * (s - gap * 2), y = j * s + gap + rnd() * (s - gap * 2);
      g.fillStyle = `rgba(150,150,146,${rnd() * 0.05})`;
      g.beginPath(); g.arc(x, y, 4 + rnd() * 30, 0, 6.3); g.fill();
    }
  }
  return c;
}

// --------------------------------------------------------------- carpet ---
function noiseTex(size = 512, base = [214, 208, 196], amp = 26) {
  const c = canvas(size, size), g = c.getContext('2d');
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, size, size);
  const img = g.getImageData(0, 0, size, size), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (rnd() - 0.5) * amp;
    d[i] += v; d[i + 1] += v; d[i + 2] += v;
  }
  g.putImageData(img, 0, 0);
  for (let k = 0; k < 2600; k++) {
    g.strokeStyle = `rgba(255,255,255,${rnd() * 0.06})`;
    const x = rnd() * size, y = rnd() * size;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 5, y + (rnd() - 0.5) * 5); g.stroke();
  }
  return c;
}

// --------------------------------------------------------------- marble ---
function marbleTex(size = 1024, base = [245, 245, 243], vein = [150, 152, 158]) {
  const c = canvas(size, size), g = c.getContext('2d');
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, size, size);
  for (let v = 0; v < 26; v++) {
    let x = rnd() * size, y = rnd() * size;
    g.strokeStyle = `rgba(${vein[0]},${vein[1]},${vein[2]},${0.06 + rnd() * 0.22})`;
    g.lineWidth = 0.5 + rnd() * 2.6; g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 22; s++) {
      x += (rnd() - 0.35) * 60; y += (rnd() - 0.5) * 70;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let k = 0; k < 1200; k++) {
    g.fillStyle = `rgba(210,212,214,${rnd() * 0.12})`;
    g.beginPath(); g.arc(rnd() * size, rnd() * size, 1 + rnd() * 3, 0, 6.3); g.fill();
  }
  return c;
}

// ------------------------------------------------------------ quartz ------
function quartzTex(size = 512, base = [242, 240, 236]) {
  const c = canvas(size, size), g = c.getContext('2d');
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, size, size);
  for (let k = 0; k < 5200; k++) {
    const a = rnd();
    g.fillStyle = a > 0.6 ? `rgba(255,255,255,${rnd() * 0.5})` : `rgba(150,150,148,${rnd() * 0.3})`;
    g.beginPath(); g.arc(rnd() * size, rnd() * size, 0.5 + rnd() * 2.4, 0, 6.3); g.fill();
  }
  return c;
}

// ------------------------------------------------------------ grass -------
function grassTex(size = 512, dry = 0.0) {
  const c = canvas(size, size), g = c.getContext('2d');
  g.fillStyle = `rgb(${86 - dry * 20},${112 - dry * 26},${58 - dry * 12})`; g.fillRect(0, 0, size, size);
  for (let k = 0; k < 26000; k++) {
    const v = rnd();
    g.strokeStyle = `rgba(${60 + v * 80},${96 + v * 70},${40 + v * 50},${0.25 + rnd() * 0.5})`;
    g.lineWidth = 0.8 + rnd();
    const x = rnd() * size, y = rnd() * size;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 4, y - 3 - rnd() * 7); g.stroke();
  }
  return c;
}

// ---------------------------------------------------------------- rug -----
function rugTex(size = 512, base = [206, 197, 182], accent = [150, 138, 122]) {
  const c = canvas(size, size), g = c.getContext('2d');
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 9; i++) {   // woven bands
    g.fillStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},${0.12 + (i % 2) * 0.16})`;
    g.fillRect(0, i * size / 9, size, size / 26);
  }
  for (let k = 0; k < 9000; k++) {
    g.fillStyle = `rgba(255,255,255,${rnd() * 0.07})`;
    g.fillRect(rnd() * size, rnd() * size, 2, 1);
  }
  // border
  g.strokeStyle = `rgba(${accent[0]},${accent[1]},${accent[2]},0.55)`;
  g.lineWidth = size / 34; g.strokeRect(size / 22, size / 22, size - size / 11, size - size / 11);
  return c;
}

function fabricTex(size = 256, base = [216, 209, 196], weave = 10) {
  const c = canvas(size, size), g = c.getContext('2d');
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += weave) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, 0, 1.6, size); }
  for (let y = 0; y < size; y += weave) { g.fillStyle = 'rgba(0,0,0,0.045)'; g.fillRect(0, y, size, 1.6); }
  for (let k = 0; k < 3000; k++) {
    g.fillStyle = `rgba(255,255,255,${rnd() * 0.05})`;
    g.fillRect(rnd() * size, rnd() * size, 1, 1);
  }
  return c;
}

let TEX = null;
export function textures() {
  if (TEX) return TEX;
  TEX = {
    oak:      finish(woodTex(1024, 1024, [186, 145, 100], 7)),
    walnut:   finish(woodTex(512, 512, [116, 80, 52], 5)),
    tileMain: finish(tileTex(1024, 2, [174, 170, 164], [240, 240, 236])),
    tileWarm: finish(tileTex(1024, 2, [186, 178, 168], [243, 236, 226], 4)),
    carpet:   finish(noiseTex(512, [212, 206, 194], 30)),
    marble:   finish(marbleTex(1024)),
    quartz:   finish(quartzTex(512)),
    grass:    finish(grassTex(512)),
    rug:      finish(rugTex(512)),
    fabric:   finish(fabricTex(256, [214, 207, 193])),
    fabricDk: finish(fabricTex(256, [124, 128, 130])),
    deck:     finish(tileTex(1024, 4, [148, 144, 138], [196, 190, 180], -6)),
  };
  return TEX;
}

export function materials() {
  const t = textures();
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const paint = (c) => std({ color: c, roughness: 0.94, metalness: 0.0 });
  return {
    // surfaces
    woodFloor: std({ map: t.oak, roughness: 0.55, metalness: 0.02, color: 0xffffff }),
    tileFloor: std({ map: t.tileMain, roughness: 0.28, metalness: 0.03, color: 0xffffff }),
    tileWarm:  std({ map: t.tileWarm, roughness: 0.3, metalness: 0.03 }),
    carpet:    std({ map: t.carpet, roughness: 1.0 }),
    deck:      std({ map: t.deck, roughness: 0.75 }),
    concrete:  std({ color: 0xb4b1ab, roughness: 0.92 }),
    grass:     std({ map: t.grass, roughness: 1.0 }),
    asphalt:   std({ color: 0x53504c, roughness: 0.95 }),
    // walls & ceilings (a few near-white tints so flat walls read as painted)
    wall:  [paint(0xf1ede6), paint(0xefeae1), paint(0xeeece7), paint(0xf3f0ea), paint(0xeae7e1)],
    ceiling: std({ color: 0xf8f7f4, roughness: 1.0 }),
    trim:    std({ color: 0xfcfbf9, roughness: 0.42, metalness: 0.0 }),
    doorWood: std({ map: t.walnut, color: 0xe8dccb, roughness: 0.5 }),
    steel:   std({ color: 0xb7babd, roughness: 0.34, metalness: 0.86 }),
    chrome:  std({ color: 0xd8dade, roughness: 0.12, metalness: 1.0 }),
    black:   std({ color: 0x303032, roughness: 0.45, metalness: 0.25 }),
    blackMatte: std({ color: 0x26262a, roughness: 0.8, metalness: 0.1 }),
    appliance: std({ color: 0xf2f3f3, roughness: 0.35, metalness: 0.35 }),
    // cabinetry / counters
    cabLight: std({ color: 0xe7e2d8, roughness: 0.55 }),
    cabDark:  std({ color: 0x36393c, roughness: 0.48 }),
    cabWood:  std({ map: t.walnut, color: 0xd9c3a6, roughness: 0.55 }),
    quartz:   std({ map: t.quartz, roughness: 0.18, metalness: 0.04 }),
    marble:   std({ map: t.marble, roughness: 0.16, metalness: 0.02 }),
    // soft goods
    sofa:     std({ map: t.fabric, color: 0xe6e0d4, roughness: 0.95 }),
    sofaDk:   std({ map: t.fabricDk, color: 0x6f7a78, roughness: 0.95 }),
    accent:   std({ color: 0xb26a4a, roughness: 0.9 }),
    bedLinen: std({ color: 0xf6f4ef, roughness: 0.95 }),
    duvet:    std({ color: 0xe4e7e6, roughness: 0.95 }),
    rug:      std({ map: t.rug, roughness: 1.0 }),
    // glass & light
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xdfe9ee, transparent: true, opacity: 0.16, roughness: 0.03,
      metalness: 0.0, transmission: 0.0, side: THREE.DoubleSide, depthWrite: false,
    }),
    glassRail: new THREE.MeshPhysicalMaterial({
      color: 0xcfe0e6, transparent: true, opacity: 0.22, roughness: 0.05,
      metalness: 0.0, side: THREE.DoubleSide, depthWrite: false,
    }),
    mirror: std({ color: 0xd7dee3, roughness: 0.06, metalness: 0.95 }),
    lightDisc: std({ color: 0xfff6e2, emissive: 0xffe9c4, emissiveIntensity: 1.5, roughness: 0.6 }),
    fire: std({ color: 0xffb15a, emissive: 0xff7a1e, emissiveIntensity: 2.6, roughness: 0.7 }),
    tv: std({ color: 0x0d0f12, roughness: 0.22, metalness: 0.3 }),
    // outdoors
    roof:    std({ color: 0x8f8c87, roughness: 0.92 }),
    teak:    std({ color: 0xa9835a, roughness: 0.72 }),
    wicker:  std({ color: 0x8d8375, roughness: 0.9 }),
    leaf:    std({ color: 0x3f6b3c, roughness: 0.9 }),
    leaf2:   std({ color: 0x557f43, roughness: 0.9 }),
    pot:     std({ color: 0x9c7563, roughness: 0.85 }),
    bark:    std({ color: 0x6a5544, roughness: 0.95 }),
    porcelain: std({ color: 0xfbfbfa, roughness: 0.12, metalness: 0.02 }),
    water: std({ color: 0xbfd8dd, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.75 }),
  };
}
