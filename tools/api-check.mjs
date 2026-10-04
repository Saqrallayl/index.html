// Verifies every THREE.* symbol used by the app exists in the bundled three
// build, and that the material/geometry constructors we call are exported.
import fs from 'node:fs';
import * as THREE from '../vendor/three.module.js';

const files = ['src/main.js', 'src/materials.js', 'src/builder.js', 'src/furniture.js', 'src/player.js'];
const used = new Map();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/THREE\.([A-Za-z_$][\w$]*)/g)) {
    if (!used.has(m[1])) used.set(m[1], new Set());
    used.get(m[1]).add(f.replace('src/', ''));
  }
}
let bad = 0;
for (const [name, where] of [...used].sort()) {
  const ok = name in THREE;
  if (!ok) { bad++; console.log(`  MISSING  THREE.${name}  (used in ${[...where].join(', ')})`); }
}
console.log(`${used.size} THREE.* symbols used, ${bad} missing from three r${THREE.REVISION}`);

// check constructor parameter names we rely on
const checks = [
  ['MeshStandardMaterial', ['color', 'roughness', 'metalness', 'map', 'emissive', 'emissiveIntensity', 'side']],
  ['MeshPhysicalMaterial', ['color', 'transparent', 'opacity', 'roughness', 'metalness', 'side', 'depthWrite']],
  ['CanvasTexture', ['wrapS', 'wrapT', 'repeat', 'anisotropy', 'colorSpace']],
  ['PerspectiveCamera', ['aspect', 'updateProjectionMatrix']],
  ['DirectionalLight', ['shadow', 'castShadow', 'intensity']],
  ['PointLight', ['distance', 'decay', 'intensity']],
  ['HemisphereLight', ['color', 'groundColor', 'intensity']],
];
for (const [cls, props] of checks) {
  const inst = new THREE[cls]();
  const missing = props.filter(p => !(p in inst));
  console.log(`  ${cls}: ${missing.length ? 'MISSING ' + missing.join(', ') : 'all props present'}`);
  bad += missing.length;
}

// geometry sanity: the constructors and methods we call
for (const [cls, args] of [['BoxGeometry', [1, 1, 1]], ['CylinderGeometry', [1, 1, 1, 8]],
  ['PlaneGeometry', [1, 1]], ['ConeGeometry', [1, 1, 6]], ['IcosahedronGeometry', [1, 0]],
  ['SphereGeometry', [1, 8, 6]], ['BufferGeometry', []], ['BufferAttribute', [new Float32Array(3), 3]],
  ['Matrix4', []], ['Vector3', [0, 0, 0]], ['Box3', []], ['Group', []], ['Texture', []]]) {
  try { new THREE[cls](...args); } catch (e) { console.log(`  ${cls} threw: ${e.message}`); bad++; }
}
const geo = new THREE.BoxGeometry(1, 1, 1);
for (const m of ['toNonIndexed', 'applyMatrix4', 'computeBoundingBox', 'computeBoundingSphere', 'dispose', 'rotateX', 'scale']) {
  if (typeof geo[m] !== 'function') { console.log(`  BufferGeometry.${m} missing`); bad++; }
}
// matrix helpers used in furniture.js
const m4 = new THREE.Matrix4();
for (const m of ['makeTranslation', 'makeRotationY', 'multiply', 'premultiply', 'compose']) {
  if (typeof m4[m] !== 'function') { console.log(`  Matrix4.${m} missing`); bad++; }
}
if (!('SRGBColorSpace' in THREE)) { console.log('  SRGBColorSpace missing'); bad++; }
if (!('ACESFilmicToneMapping' in THREE)) { console.log('  ACESFilmicToneMapping missing'); bad++; }
if (!('PCFSoftShadowMap' in THREE)) { console.log('  PCFSoftShadowMap missing'); bad++; }
console.log(bad ? `\n${bad} problems` : '\nthree.js API surface OK');
process.exit(bad ? 1 : 0);
