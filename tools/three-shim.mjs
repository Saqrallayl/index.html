
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
