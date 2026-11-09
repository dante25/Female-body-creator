// Prikaz: "3d" (rotacija, koža) i "sheet" (character sheet: sprijeda / profil / otpozadi).
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';

const OUTLINE = 0x7a7a7a;

function outlineMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { thickness: { value: 0.05 }, color: { value: new THREE.Color(OUTLINE) } },
    vertexShader: `
      uniform float thickness;
      void main() {
        vec3 p = position + normalize(normal) * thickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 color;
      void main() { gl_FragColor = vec4(color, 1.0); }`,
  });
}

export class Viewer {
  constructor(container, body) {
    this.container = container;
    this.body = body;
    this.mode = '3d';

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.autoClear = false;
    container.appendChild(r.domElement);

    this.overlay = document.createElement('canvas');
    this.overlay.className = 'overlay-canvas';
    container.appendChild(this.overlay);

    // geometrija dijeli isti niz pozicija s modelom
    const posAttr = this.posAttr = new THREE.BufferAttribute(body.positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', posAttr);
    g.setIndex(new THREE.BufferAttribute(body.bodyIdx, 1));
    const ge = this.eyeGeo = new THREE.BufferGeometry();
    ge.setAttribute('position', posAttr);
    ge.setIndex(new THREE.BufferAttribute(body.eyeIdx, 1));

    // ---- 3D scena ----
    const s3 = this.scene3d = new THREE.Scene();
    s3.background = new THREE.Color(0xeef0f3);
    this.skin = new THREE.MeshStandardMaterial({ color: 0xe2b49a, roughness: 0.6 });
    const mesh = new THREE.Mesh(g, this.skin);
    mesh.castShadow = true;
    s3.add(mesh);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.3 });
    s3.add(new THREE.Mesh(ge, eyeMat));
    s3.add(new THREE.HemisphereLight(0xffffff, 0x8d949c, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(8, 20, 14);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 22, bottom: -2, near: 1, far: 60 });
    s3.add(key);
    const rim = new THREE.DirectionalLight(0xdde6ff, 0.8);
    rim.position.set(-12, 12, -14);
    s3.add(rim);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(8, 48), new THREE.ShadowMaterial({ opacity: 0.18 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s3.add(ground);

    this.cam3d = new THREE.PerspectiveCamera(30, 1, 0.5, 300);
    this.controls = new OrbitControls(this.cam3d, r.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 80;
    this.controls.addEventListener('change', () => this.requestRender());

    // ---- character sheet scena ----
    const ss = this.sceneSheet = new THREE.Scene();
    this.outline = outlineMaterial();
    ss.add(new THREE.Mesh(g, this.outline));
    ss.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff })));
    this.camSheet = new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 50);

    this.guides = true;
    new ResizeObserver(() => this.resize()).observe(container);
    const loop = () => {
      requestAnimationFrame(loop);
      if (this.mode === '3d' && this.controls.update()) this.dirty = true;
      if (this.dirty) { this.dirty = false; this.draw(); }
    };
    loop();
  }

  requestRender() { this.dirty = true; }

  update() {
    this.posAttr.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingBox();
    this.eyeGeo.computeVertexNormals();
    this.requestRender();
  }

  setMode(m) {
    this.mode = m;
    this.controls.enabled = m === '3d';
    this.overlay.style.display = m === 'sheet' ? 'block' : 'none';
    this.requestRender();
  }

  setSkin(hex) { this.skin.color.set(hex); this.requestRender(); }
  setGuides(on) { this.guides = on; this.requestRender(); }

  view(name) {
    const h = this.body.height || 16.5;
    const t = new THREE.Vector3(0, h * 0.53, 0);
    const d = h * 2.6;
    const dir = { front: [0, 0, 1], side: [1, 0, 0], back: [0, 0, -1], q: [0.65, 0.1, 0.75] }[name];
    this.controls.target.copy(t);
    this.cam3d.position.set(dir[0] * d, t.y + dir[1] * d, dir[2] * d);
    this.controls.update();
    this.requestRender();
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.overlay.width = w * pr; this.overlay.height = h * pr;
    this.overlay.style.width = w + 'px'; this.overlay.style.height = h + 'px';
    this.cam3d.aspect = w / h;
    this.cam3d.updateProjectionMatrix();
    this.requestRender();
  }

  draw() {
    const r = this.renderer;
    const size = r.getSize(new THREE.Vector2());
    if (this.mode === '3d') {
      r.setViewport(0, 0, size.x, size.y);
      r.setScissorTest(false);
      r.clear();
      r.render(this.scene3d, this.cam3d);
    } else {
      this.drawSheet(size.x, size.y, this.overlay.getContext('2d'), this.renderer.getPixelRatio());
    }
  }

  // Raspored tri panela; vraća podatke potrebne i za overlay.
  sheetLayout(W, H) {
    const bb = this.geo.boundingBox;
    const bh = bb.max.y - bb.min.y;
    const spanX = (bb.max.x - bb.min.x), spanZ = (bb.max.z - bb.min.z);
    const pw = W / 3;
    const top = H * 0.08, bottom = H * 0.05;            // prostor za naslove / mjere
    const ph = H - top - bottom;
    const aspect = pw / ph;
    const span = Math.max(spanX, spanZ) * 1.08;
    const fh = Math.max(bh * 1.04, span / aspect);      // visina vidljivog prostora (dm)
    return { bh, pw, top, ph, fh, fw: fh * aspect, cy: bh * 0.5 };
  }

  drawSheet(W, H, ctx, pr = 1) {
    const r = this.renderer;
    const L = this.sheetLayout(W, H);
    r.setScissorTest(true);
    r.setClearColor(0xffffff, 1);
    r.setViewport(0, 0, W, H); r.setScissor(0, 0, W, H); r.clear();
    this.outline.uniforms.thickness.value = L.fh * 0.0038;
    const cam = this.camSheet;
    cam.left = -L.fw / 2; cam.right = L.fw / 2;
    cam.top = L.fh / 2; cam.bottom = -L.fh / 2;
    cam.updateProjectionMatrix();
    const views = [[0, 0, 10], [10, 0, 0], [0, 0, -10]];  // sprijeda, profil (lice lijevo), otpozadi
    views.forEach((p, i) => {
      cam.position.set(p[0], L.cy + p[1], p[2]);
      cam.lookAt(0, L.cy, 0);
      const x = i * L.pw, y = H * 0.05;                  // viewport ide odozdo
      r.setViewport(x, y, L.pw, L.ph); r.setScissor(x, y, L.pw, L.ph);
      r.render(this.sceneSheet, cam);
    });
    r.setScissorTest(false);
    r.setClearColor(0x000000, 0);
    this.drawOverlay(ctx, W, H, L, pr);
  }

  drawOverlay(ctx, W, H, L, pr) {
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const yToPx = y => L.top + L.ph / 2 - (y - L.cy) / L.fh * L.ph;
    if (this.guides) {
      const unit = L.bh / 8;
      ctx.strokeStyle = 'rgba(120,150,190,.35)';
      ctx.fillStyle = 'rgba(110,135,170,.9)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.font = `${Math.max(9, H * 0.022)}px sans-serif`;
      ctx.textAlign = 'left';
      for (let i = 0; i <= 8; i++) {
        const py = yToPx(L.bh - i * unit);
        ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
        if (i < 8) ctx.fillText(String(i + 1), 4, yToPx(L.bh - (i + 0.5) * unit) + 4);
      }
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#555';
    ctx.textAlign = 'center';
    ctx.font = `600 ${Math.max(10, H * 0.03)}px sans-serif`;
    ['SPRIJEDA', 'PROFIL', 'OTPOZADI'].forEach((t, i) => ctx.fillText(t, L.pw * (i + 0.5), L.top * 0.62));
    ctx.font = `${Math.max(9, H * 0.024)}px sans-serif`;
    ctx.fillStyle = '#777';
    ctx.fillText(`Visina ${(L.bh * 10).toFixed(0)} cm  ·  1 jedinica = ${(L.bh / 8 * 10).toFixed(1)} cm`, W / 2, H - H * 0.015);
  }

  // PNG trenutnog prikaza ili cijelog lista u visokoj rezoluciji
  snapshot(sheet) {
    const r = this.renderer;
    if (!sheet) { this.draw(); return r.domElement.toDataURL('image/png'); }
    const W = 2400, H = 1500;
    const oldSize = r.getSize(new THREE.Vector2()), oldPr = r.getPixelRatio();
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const mode = this.mode; this.mode = 'sheet';
    this.drawSheet(W, H, ctx, 1);
    const ov = document.createElement('canvas'); ov.width = W; ov.height = H;
    ov.getContext('2d').drawImage(c, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(r.domElement, 0, 0, W, H);
    ctx.drawImage(ov, 0, 0);
    this.mode = mode;
    r.setPixelRatio(oldPr);
    r.setSize(oldSize.x, oldSize.y, false);
    this.requestRender();
    return c.toDataURL('image/png');
  }
}
