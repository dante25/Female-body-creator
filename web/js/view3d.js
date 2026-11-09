// 3D prikaz – proceduralni "maneken" izgrađen iz istog modela kao i 2D list.
import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { lerp } from './model.js';

const smoothstep = t => t * t * (3 - 2 * t);

// ---------- generatori geometrije ----------

function torsoGeometry(M) {
  const t = M.torso, rings = 72, seg = 56;
  const pos = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const y = lerp(t.yBottom, t.yTop, i / rings);
    for (const [x, z] of t.ring(y, seg)) pos.push(x, y, z);
  }
  // kape (dno i vrh)
  const bottom = pos.length / 3; pos.push(0, t.yBottom - M.H * 0.004, 0);
  const top = pos.length / 3; pos.push(0, t.yTop + M.H * 0.004, -M.H * 0.006);
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + (j + 1) % seg, c = a + seg, d = b + seg;
      idx.push(a, b, c, b, d, c);
    }
  }
  for (let j = 0; j < seg; j++) {
    idx.push(bottom, (j + 1) % seg, j);
    const o = rings * seg;
    idx.push(top, o + j, o + (j + 1) % seg);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Cijev duž Catmull-Rom krive sa promjenljivim poluprečnikom i zaobljenim krajevima.
// ctrl: [{x,y,z,r, sx?, sz?}]
function tubeGeometry(ctrl, { radial = 28, k = 10, ref = new THREE.Vector3(1, 0, 0) } = {}) {
  const n = ctrl.length;
  const P = i => ctrl[Math.max(0, Math.min(n - 1, i))];
  const S = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const cr = key => 0.5 * (2 * p1[key] + (-p0[key] + p2[key]) * t + (2 * p0[key] - 5 * p1[key] + 4 * p2[key] - p3[key]) * t2 + (-p0[key] + 3 * p1[key] - 3 * p2[key] + p3[key]) * t3);
      const st = smoothstep(t);
      S.push({
        c: new THREE.Vector3(cr('x'), cr('y'), cr('z')),
        r: lerp(p1.r, p2.r, st),
        sx: lerp(p1.sx ?? 1, p2.sx ?? 1, st), sz: lerp(p1.sz ?? 1, p2.sz ?? 1, st),
      });
    }
  }
  const last = ctrl[n - 1];
  S.push({ c: new THREE.Vector3(last.x, last.y, last.z), r: last.r, sx: last.sx ?? 1, sz: last.sz ?? 1 });
  const m = S.length;
  S.forEach((s, i) => {
    const a = S[Math.max(0, i - 1)].c, b = S[Math.min(m - 1, i + 1)].c;
    s.t = b.clone().sub(a).normalize();
  });
  // kape: dodatni prstenovi koji se sužavaju (polusfera)
  const capRings = 6;
  const rings = [];
  const addCap = (s, dir) => {
    const out = [];
    for (let q = capRings; q >= 1; q--) {
      const a = q / capRings * Math.PI / 2;
      out.push({ ...s, c: s.c.clone().addScaledVector(s.t, dir * s.r * Math.sin(a) * 0.9), r: s.r * Math.cos(a) + 1e-3 });
    }
    return out;
  };
  rings.push(...addCap(S[0], -1));
  rings.push(...S);
  rings.push(...addCap(S[m - 1], 1).reverse());

  const pos = [], idx = [];
  const tmpS = new THREE.Vector3(), tmpU = new THREE.Vector3(), v = new THREE.Vector3();
  for (const s of rings) {
    const T = s.t;
    const r0 = Math.abs(T.dot(ref)) > 0.9 ? new THREE.Vector3(0, 0, 1) : ref;
    tmpS.copy(r0).addScaledVector(T, -r0.dot(T)).normalize();
    tmpU.crossVectors(T, tmpS).normalize();
    for (let j = 0; j < radial; j++) {
      const ph = j / radial * Math.PI * 2;
      v.copy(s.c).addScaledVector(tmpS, Math.cos(ph) * s.r * s.sx).addScaledVector(tmpU, Math.sin(ph) * s.r * s.sz);
      pos.push(v.x, v.y, v.z);
    }
  }
  const R = rings.length;
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + (j + 1) % radial, c = a + radial, d = b + radial;
      idx.push(a, b, c, b, d, c);
    }
  }
  // zatvori vrhove
  const s0 = pos.length / 3; const c0 = rings[0].c; pos.push(c0.x, c0.y, c0.z);
  const s1 = pos.length / 3; const c1 = rings[R - 1].c; pos.push(c1.x, c1.y, c1.z);
  for (let j = 0; j < radial; j++) {
    idx.push(s0, (j + 1) % radial, j);
    idx.push(s1, (R - 1) * radial + j, (R - 1) * radial + (j + 1) % radial);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function headGeometry(M) {
  const h = M.head;
  const g = new THREE.SphereGeometry(1, 56, 40);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const v = (y + 1) / 2;
    // vilica se sužava prema bradi
    const jw = v < 0.5 ? lerp(0.66 * h.jaw, 1, smoothstep(v / 0.5)) : 1;
    let X = x * h.w * jw;
    let Z = z * h.len / 2;
    if (z < 0 && v < 0.4) Z *= lerp(0.45, 1, smoothstep(v / 0.4));   // potiljak prelazi u vrat
    if (z > 0 && v < 0.3) Z *= lerp(0.85 * h.jaw, 1, v / 0.3);       // brada
    if (z > 0 && v > 0.5 && v < 0.75) Z *= 1.03;                      // čelo / obrve
    const Y = h.yChin + v * h.h;
    p.setXYZ(i, X, Y, Z + h.z);
  }
  g.computeVertexNormals();
  return g;
}

function ellipsoid(rx, ry, rz) {
  const g = new THREE.SphereGeometry(1, 20, 14);
  g.scale(rx, ry, rz);
  return g;
}

// ---------- klasa prikaza ----------
export class View3D {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(r.domElement);

    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color(0xeef1f5);
    this.camera = new THREE.PerspectiveCamera(28, 1, 5, 5000);
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 60;
    this.controls.maxDistance = 1500;

    s.add(new THREE.HemisphereLight(0xffffff, 0x9aa3ad, 1.5));
    const key = this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(150, 320, 260);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -150, right: 150, top: 220, bottom: -20, near: 10, far: 1000 });
    s.add(key);
    const rim = new THREE.DirectionalLight(0xdfe8ff, 0.9);
    rim.position.set(-200, 200, -250);
    s.add(rim);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.ShadowMaterial({ opacity: 0.18 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);
    const grid = new THREE.PolarGridHelper(120, 8, 6, 48, 0xc5ccd6, 0xd8dde4);
    grid.position.y = 0.05;
    s.add(grid);

    this.material = new THREE.MeshStandardMaterial({ color: 0xe0b9a0, roughness: 0.62, metalness: 0.0 });
    this.body = new THREE.Group();
    s.add(this.body);
    this.firstFit = true;

    const loop = () => {
      requestAnimationFrame(loop);
      if (!this.visible) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
    new ResizeObserver(() => this.resize()).observe(container);
  }

  setVisible(v) { this.visible = v; if (v) this.resize(); }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setColor(hex) { this.material.color.set(hex); }
  setWireframe(on) { this.material.wireframe = on; }

  setView(name) {
    const H = this.H || 168;
    const d = H * 2.7;
    const dir = { front: [0, 0, 1], side: [-1, 0, 0], back: [0, 0, -1], q: [-0.7, 0.12, 0.7] }[name];
    const t = new THREE.Vector3(0, H * 0.52, 0);
    this.controls.target.copy(t);
    this.camera.position.set(t.x + dir[0] * d, t.y + dir[1] * d, t.z + dir[2] * d);
    this.controls.update();
  }

  update(M) {
    this.H = M.H;
    for (const c of this.body.children) c.geometry.dispose();
    this.body.clear();
    const add = geo => {
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.body.add(mesh);
    };
    const H = M.H;
    add(torsoGeometry(M));
    add(tubeGeometry([
      { x: 0, y: M.neck.y0, z: M.neck.z0, r: M.neck.r * 1.1 },
      { x: 0, y: (M.neck.y0 + M.neck.y1) / 2, z: (M.neck.z0 + M.neck.z1) / 2, r: M.neck.r },
      { x: 0, y: M.neck.y1, z: M.neck.z1, r: M.neck.r * 0.95 },
    ]));
    add(headGeometry(M));
    const h = M.head;
    // nos i uši
    const nose = ellipsoid(h.w * 0.11, h.h * 0.085, h.len * 0.07 * h.nose);
    nose.translate(0, h.yChin + h.h * 0.47, h.z + h.len * 0.47);
    add(nose);
    for (const s of [1, -1]) {
      const ear = ellipsoid(h.w * 0.12, h.h * 0.14, h.len * 0.09);
      ear.translate(s * h.w * 0.97, h.yChin + h.h * 0.52, h.z - h.len * 0.03);
      add(ear);
    }

    for (const s of [1, -1]) {
      // noga (list izbočen nazad)
      const legCtrl = M.leg.map((p, i) => i === 0 ? ({ x: s * p.x * 0.92, y: p.y - M.H * 0.008, z: p.z, r: p.r * 0.72 }) : ({
        x: s * p.x,
        y: p.y,
        z: p.z + (i === 4 ? -0.22 : i === 5 ? -0.12 : 0) * p.r,
        r: p.r * (i === 4 ? 1.04 : 1),
      }));
      add(tubeGeometry(legCtrl));
      // stopalo
      const f = M.foot, L = f.toeZ - f.heelZ, fx = s * f.x;
      const sz = 0.62;
      const fp = [
        { r: H * 0.021, z: f.heelZ + H * 0.022, w: 0.85 },
        { r: H * 0.024, z: f.heelZ + L * 0.38, w: 0.95 },
        { r: H * 0.025, z: f.heelZ + L * 0.68, w: 1.05 },
        { r: H * 0.019, z: f.toeZ - H * 0.02, w: 1.1 },
      ].map((q, i) => ({
        x: fx + s * H * 0.006 * i / 3, y: q.r * sz * (i === 0 ? 1.35 : i === 1 ? 1.4 : 1), z: q.z,
        r: q.r * f.width / (H * 0.024), sx: q.w, sz,
      }));
      add(tubeGeometry(fp, { ref: new THREE.Vector3(1, 0, 0) }));
      // ruka + šaka (šaka spljoštena)
      const armCtrl = [
        ...M.arm.map(p => ({ x: s * p.x, y: p.y, z: p.z, r: p.r })),
        ...M.hand.slice(1).map((p, i) => ({ x: s * p.x, y: p.y, z: p.z, r: p.r, sx: [0.62, 0.5, 0.5, 0.6][i], sz: [1.05, 1, 0.9, 0.9][i] })),
      ];
      add(tubeGeometry(armCtrl, { radial: 24 }));
      // palac
      const w = M.hand[1];
      add(tubeGeometry([
        { x: s * (w.x - H * 0.004), y: w.y + H * 0.004, z: w.z + H * 0.012, r: H * 0.0085 },
        { x: s * (w.x - H * 0.006), y: w.y - H * 0.02, z: w.z + H * 0.022, r: H * 0.007 },
        { x: s * (w.x - H * 0.004), y: w.y - H * 0.04, z: w.z + H * 0.024, r: H * 0.005 },
      ], { radial: 14 }));
    }

    if (this.firstFit) { this.firstFit = false; this.setView('q'); }
  }

  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
