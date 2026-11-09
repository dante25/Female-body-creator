// Engine za "live" deformaciju slike (mesh warp).
// Slika se postavi kao tekstura na gustu mrežu; slajderi pomjeraju verteksе
// mreže u anatomskim zonama svake figure (sprijeda / profil / otpozadi).
import * as THREE from 'three';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gauss = (y, c, sU, sD) => { const s = y < c ? sU : sD; const q = (y - c) / s; return Math.exp(-q * q); };

// Zone: c = visina centra zone (udio visine figure od vrha glave), s = širina zone,
// k = maksimalna promjena pri slajderu ±100.
// front/back: scale = širenje oko središta, leg = svaka noga oko svoje osi, head = glava/vrat
// profil:     scale = širenje oko lokalnog središta, push = izbočenje naprijed (+1) ili nazad (−1)
const EFFECTS = {
  shoulders: { f: { kind: 'scale', c: 0.19, s: 0.045, k: 0.14 } },
  neckCirc: { f: { kind: 'head', c: 0.145, s: 0.018, k: 0.3 }, p: { kind: 'scale', c: 0.145, s: 0.018, k: 0.25 } },
  headSize: { f: { kind: 'head', c: 0.065, s: 0.06, k: 0.16 }, p: { kind: 'scale', c: 0.065, s: 0.06, k: 0.16 } },
  headWidth: { f: { kind: 'head', c: 0.065, s: 0.06, k: 0.15 } },
  headFat: { f: { kind: 'head', c: 0.09, s: 0.035, k: 0.12 }, p: { kind: 'scale', c: 0.09, s: 0.035, k: 0.08 } },
  bustSize: { f: { kind: 'torso', c: 0.27, s: 0.035, k: 0.06 }, p: { kind: 'push', dir: 1, c: 0.27, sU: 0.045, sD: 0.028, k: 0.24 } },
  bustPoint: { p: { kind: 'push', dir: 1, c: 0.275, sU: 0.03, sD: 0.022, k: 0.14 } },
  underbust: { f: { kind: 'torso', c: 0.31, s: 0.025, k: 0.12 }, p: { kind: 'scale', c: 0.31, s: 0.025, k: 0.1 } },
  waist: { f: { kind: 'torso', c: 0.38, s: 0.045, k: 0.28 }, p: { kind: 'scale', c: 0.38, s: 0.045, k: 0.18 } },
  belly: { f: { kind: 'torso', c: 0.44, s: 0.045, k: 0.08 }, p: { kind: 'push', dir: 1, c: 0.43, sU: 0.05, sD: 0.05, k: 0.26 } },
  hips: { f: { kind: 'torso', c: 0.5, s: 0.05, k: 0.22 }, p: { kind: 'scale', c: 0.49, s: 0.05, k: 0.1 } },
  glutes: { f: { kind: 'torso', c: 0.5, s: 0.045, k: 0.06 }, p: { kind: 'push', dir: -1, c: 0.49, sU: 0.05, sD: 0.035, k: 0.26 } },
  torsoDepth: { p: { kind: 'scale', c: 0.35, s: 0.12, k: 0.2 } },
  vshape: { f: { kind: 'scale', c: 0.23, s: 0.05, k: 0.12 } },
  thighs: { f: { kind: 'leg', c: 0.61, s: 0.06, k: 0.3 }, p: { kind: 'scale', c: 0.61, s: 0.06, k: 0.25 } },
  knees: { f: { kind: 'leg', c: 0.73, s: 0.025, k: 0.2 }, p: { kind: 'scale', c: 0.73, s: 0.025, k: 0.2 } },
  calves: { f: { kind: 'leg', c: 0.81, s: 0.04, k: 0.3 }, p: { kind: 'scale', c: 0.81, s: 0.04, k: 0.25 } },
  ankles: { f: { kind: 'leg', c: 0.93, s: 0.02, k: 0.25 }, p: { kind: 'scale', c: 0.93, s: 0.02, k: 0.2 } },
};
// složeni slajderi
const COMPOSITE = {
  weight: { waist: 0.6, hips: 0.5, thighs: 0.6, belly: 0.5, bustSize: 0.3, glutes: 0.4, calves: 0.4, neckCirc: 0.4, shoulders: 0.15, underbust: 0.4, headFat: 0.4 },
  muscle: { shoulders: 0.4, calves: 0.3, thighs: 0.2, waist: -0.15, vshape: 0.3 },
};
// vertikalni segmenti: [od, do] (udio visine) i slajderi koji ih produžuju
const SEGMENTS = [
  { a: 0, b: 0.125, ids: { headSize: 0.15 } },
  { a: 0.125, b: 0.17, ids: { neckLength: 0.5 } },
  { a: 0.17, b: 0.52, ids: { torsoLength: 0.2 } },
  { a: 0.52, b: 0.73, ids: { upperLegLen: 0.25 } },
  { a: 0.73, b: 1, ids: { lowerLegLen: 0.25 } },
];

export const WARP_SUPPORTED = new Set([...Object.keys(EFFECTS), ...Object.keys(COMPOSITE), 'neckLength', 'torsoLength', 'upperLegLen', 'lowerLegLen']);

// ---------------- analiza slike ----------------
function analyze(img) {
  const maxW = 700;
  const sc = Math.min(1, maxW / img.width);
  const w = Math.round(img.width * sc), h = Math.round(img.height * sc);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const l = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    ink[i] = l < 175 ? 1 : 0;
  }
  // projekcija po kolonama -> figure
  const col = new Uint32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) col[x] += ink[y * w + x];
  const minCount = Math.max(2, h * 0.004);
  const runs = [];
  let start = -1, lastInk = -1;
  const gap = Math.max(3, w * 0.015);
  for (let x = 0; x < w; x++) {
    if (col[x] >= minCount) {
      if (start < 0) start = x;
      else if (x - lastInk > gap) { runs.push([start, lastInk]); start = x; }
      lastInk = x;
    }
  }
  if (start >= 0) runs.push([start, lastInk]);
  let figs = runs.filter(([a, b]) => b - a > w * 0.04).map(([a, b]) => {
    let top = h, bottom = 0;
    for (let y = 0; y < h; y++) for (let x = a; x <= b; x++) if (ink[y * w + x]) { if (y < top) top = y; if (y > bottom) bottom = y; break; }
    return { x0: a, x1: b, top, bottom };
  }).filter(f => f.bottom - f.top > h * 0.3);
  // zadrži najviše 3 najveće
  figs.sort((p, q) => (q.bottom - q.top) * (q.x1 - q.x0) - (p.bottom - p.top) * (p.x1 - p.x0));
  figs = figs.slice(0, 3).sort((p, q) => p.x0 - q.x0);

  // profil = najuža figura (kad ih ima više)
  if (figs.length >= 2) {
    let ni = 0;
    figs.forEach((f, i) => { if (f.x1 - f.x0 < figs[ni].x1 - figs[ni].x0) ni = i; });
    figs.forEach((f, i) => { f.type = i === ni ? 'p' : 'f'; });
  } else if (figs.length === 1) figs[0].type = 'f';

  // lokalna mjerenja za svaku zonu
  const rowExtent = (f, yy) => {
    let l = Infinity, r = -Infinity;
    for (let y = Math.max(0, yy - 2); y <= Math.min(h - 1, yy + 2); y++) {
      for (let x = f.x0; x <= f.x1; x++) if (ink[y * w + x]) { if (x < l) l = x; if (x > r) r = x; }
    }
    return l <= r ? [l, r] : null;
  };
  for (const f of figs) {
    const H = f.bottom - f.top;
    f.cx = (f.x0 + f.x1) / 2;
    f.W = (f.x1 - f.x0) / 2;
    f.zones = {};
    for (const [id, e] of Object.entries(EFFECTS)) {
      const z = e[f.type];
      if (!z) continue;
      const yy = Math.round(f.top + z.c * H);
      const ext = rowExtent(f, yy) || [f.cx - f.W * 0.3, f.cx + f.W * 0.3];
      let cx = (ext[0] + ext[1]) / 2, hw = Math.max(2, (ext[1] - ext[0]) / 2);
      if (f.type === 'f') cx = f.cx;  // sprijeda/otpozadi su simetrične
      const zone = { ...z, cx, hw };
      if (z.kind === 'leg') {
        const xo = Math.min(Math.max(ext[1] - f.cx, f.cx - ext[0]), f.W * 0.45);
        zone.d = xo / 2; zone.lr = xo / 2;
      }
      if (z.kind === 'torso') {
        // od središta prema van: kontura trupa, pa razmak, pa ruka
        const scan = (dir) => {
          let x = Math.round(f.cx), st = 0, edge = null, arm = null;
          const lim = dir > 0 ? f.x1 : f.x0;
          for (; dir > 0 ? x <= lim : x >= lim; x += dir) {
            let on = 0;
            for (let y = Math.max(0, yy - 1); y <= Math.min(h - 1, yy + 1); y++) on |= ink[y * w + x];
            if (st === 0 && on) st = 1;
            else if (st === 1 && !on) { edge = Math.abs(x - f.cx); st = 2; }
            else if (st === 2 && on) { arm = Math.abs(x - f.cx); break; }
          }
          return [edge, arm];
        };
        const [e1, a1] = scan(1), [e2, a2] = scan(-1);
        const edges = [e1, e2].filter(v => v), arms = [a1, a2].filter(v => v);
        zone.edge = edges.length ? edges.reduce((p, q) => p + q) / edges.length : f.W * 0.5;
        zone.arm = arms.length ? arms.reduce((p, q) => p + q) / arms.length : null;
      }
      if (z.kind === 'head') {
        const he = rowExtent(f, Math.round(f.top + 0.065 * H));
        zone.hw = he ? (he[1] - he[0]) / 2 : f.W * 0.15;
      }
      f.zones[id] = zone;
    }
  }
  // skaliraj nazad na pune koordinate slike
  const inv = 1 / sc;
  for (const f of figs) {
    for (const k of ['x0', 'x1', 'top', 'bottom', 'cx', 'W']) f[k] *= inv;
    for (const z of Object.values(f.zones)) for (const k of ['cx', 'hw', 'd', 'lr', 'edge', 'arm']) if (z[k] !== undefined) z[k] *= inv;
  }
  return figs;
}

// ---------------- prikaz ----------------
export class WarpView {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.setClearColor(0xffffff, 1);
    r.domElement.className = 'warp-canvas';
    container.appendChild(r.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
    this.faceLeft = true;
    this.showOriginal = false;
    this.values = {};
    new ResizeObserver(() => this.resize()).observe(container);
  }

  get loaded() { return !!this.mesh; }

  async setImage(src) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('slika se ne može otvoriti')); i.src = src; });
    this.img = img;
    this.W = img.width; this.H = img.height;
    this.figs = analyze(img);
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.map.dispose(); this.scene.remove(this.mesh); }
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    // mreža
    const nx = 200, ny = Math.max(80, Math.round(200 * this.H / this.W));
    this.nx = nx; this.ny = ny;
    const pos = new Float32Array((nx + 1) * (ny + 1) * 3);
    const uv = new Float32Array((nx + 1) * (ny + 1) * 2);
    const idx = [];
    this.gx = new Float32Array(nx + 1); this.gy = new Float32Array(ny + 1);
    for (let i = 0; i <= nx; i++) this.gx[i] = i / nx * this.W;
    for (let j = 0; j <= ny; j++) this.gy[j] = j / ny * this.H;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const v = j * (nx + 1) + i;
      uv[v * 2] = i / nx; uv[v * 2 + 1] = 1 - j / ny;
      if (i < nx && j < ny) { const a = v, b = v + 1, c = v + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex }));
    this.scene.add(this.mesh);
    this.update(this.values);
    return this.figs.length;
  }

  setFaceLeft(v) { this.faceLeft = v; this.update(this.values); }
  setShowOriginal(v) { this.showOriginal = v; this.update(this.values); }

  // efektivne jačine zona iz vrijednosti slajdera
  amounts(values) {
    const a = {};
    for (const id of Object.keys(EFFECTS)) a[id] = (values[id] || 0) / 100;
    for (const [cid, mix] of Object.entries(COMPOSITE)) {
      const v = (values[cid] || 0) / 100;
      if (v) for (const [id, m] of Object.entries(mix)) a[id] += v * m;
    }
    return a;
  }

  update(values) {
    this.values = values;
    if (!this.mesh) return;
    const vals = this.showOriginal ? {} : values;
    const A = this.amounts(vals);
    const { nx, ny, gx, gy } = this;
    const dx = new Float32Array((nx + 1) * (ny + 1));

    for (const f of this.figs) {
      const Hf = f.bottom - f.top;
      const lim0 = f.x0 - f.W * 0.25, lim1 = f.x1 + f.W * 0.25;
      for (const [id, z] of Object.entries(f.zones)) {
        const amt = A[id];
        if (!amt) continue;
        const k = amt * z.k;
        const cY = f.top + z.c * Hf, sU = (z.sU ?? z.s) * Hf, sD = (z.sD ?? z.s) * Hf;
        // težina po redovima
        const rowW = new Float32Array(ny + 1);
        let any = false;
        for (let j = 0; j <= ny; j++) { const g = gauss(gy[j], cY, sU, sD); rowW[j] = g > 0.003 ? g : 0; if (rowW[j]) any = true; }
        if (!any) continue;
        // pomak po kolonama
        const colD = new Float32Array(nx + 1);
        for (let i = 0; i <= nx; i++) {
          const x = gx[i];
          if (x < lim0 || x > lim1) continue;
          const edge = smooth(lim0, f.x0, x) * (1 - smooth(f.x1, lim1, x));
          let v = 0;
          if (z.kind === 'scale') {
            const R = Math.max(z.hw * 1.25, f.W * 0.35);
            v = (x - z.cx) * (1 - smooth(1.0, 1.6, Math.abs(x - z.cx) / R));
          } else if (z.kind === 'torso') {
            // trup se širi/sužava, ruke ostaju (razmak trup–ruka se prilagodi)
            const r = Math.abs(x - z.cx), e = z.edge;
            let fe = z.arm ? Math.max(z.arm, e * (1 + 2.2 * Math.max(0, k))) : e * 1.35;
            fe = Math.max(fe, e * 1.08);
            v = r <= e ? (x - z.cx) : Math.sign(x - z.cx) * e * (1 - smooth(e, fe, r));
          } else if (z.kind === 'head') {
            v = (x - z.cx) * (1 - smooth(1.1, 1.9, Math.abs(x - z.cx) / z.hw));
          } else if (z.kind === 'leg') {
            for (const s of [-1, 1]) {
              const lc = f.cx + s * z.d;
              v += (x - lc) * (1 - smooth(0.9, 1.7, Math.abs(x - lc) / Math.max(1, z.lr)));
            }
          } else if (z.kind === 'push') {
            const dir = z.dir * (this.faceLeft ? -1 : 1);
            const t = (x - z.cx) * dir / z.hw;      // >0 prema strani izbočenja
            v = dir * z.hw * smooth(-0.3, 0.7, t) * (1 - smooth(1.6, 2.6, t));
          }
          colD[i] = v * edge;
        }
        for (let j = 0; j <= ny; j++) {
          const rw = rowW[j] * k;
          if (!rw) continue;
          const o = j * (nx + 1);
          for (let i = 0; i <= nx; i++) dx[o + i] += colD[i] * rw;
        }
      }
    }

    // vertikalno: produženje segmenata (stopala ostaju na podu)
    const ref = this.figs[0] || { top: 0, bottom: this.H };
    const top = Math.min(...this.figs.map(f => f.top), ref.top), bottom = Math.max(...this.figs.map(f => f.bottom), ref.bottom);
    const Hb = bottom - top;
    const segs = SEGMENTS.map(s => {
      let sc = 1;
      for (const [id, m] of Object.entries(s.ids)) sc += (vals[id] || 0) / 100 * m;
      return { y0: top + s.a * Hb, y1: top + s.b * Hb, sc: Math.max(0.3, sc) };
    });
    // od dna prema gore
    let acc = bottom;
    for (let i = segs.length - 1; i >= 0; i--) { const s = segs[i]; s.n1 = acc; acc -= (s.y1 - s.y0) * s.sc; s.n0 = acc; }
    const shiftTop = acc - top;
    const mapY = y => {
      if (y <= top) return y + shiftTop;
      if (y >= bottom) return y;
      for (const s of segs) if (y <= s.y1) return s.n0 + (y - s.y0) * s.sc;
      return y;
    };

    const pos = this.mesh.geometry.attributes.position.array;
    for (let j = 0; j <= ny; j++) {
      const yy = -mapY(gy[j]);
      for (let i = 0; i <= nx; i++) {
        const v = j * (nx + 1) + i;
        pos[v * 3] = gx[i] + dx[v];
        pos[v * 3 + 1] = yy;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.bounds = { x0: 0, x1: this.W, y0: Math.min(0, shiftTop), y1: this.H };
    this.render();
  }

  fitCamera(w, h) {
    const b = this.bounds || { x0: 0, x1: 1, y0: 0, y1: 1 };
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const s = Math.max(bw / w, bh / h) * 1.02;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    const c = this.camera;
    c.left = cx - w * s / 2; c.right = cx + w * s / 2;
    c.top = -(cy - h * s / 2); c.bottom = -(cy + h * s / 2);
    c.updateProjectionMatrix();
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.render();
  }

  render() {
    const size = this.renderer.getSize(new THREE.Vector2());
    if (!size.x) return;
    this.fitCamera(size.x, size.y);
    this.renderer.render(this.scene, this.camera);
  }

  // PNG u punoj rezoluciji slike
  snapshot() {
    const r = this.renderer;
    const old = r.getSize(new THREE.Vector2()), pr = r.getPixelRatio();
    const b = this.bounds, W = Math.round(b.x1 - b.x0), H = Math.round(b.y1 - b.y0);
    const s = Math.min(1, 4096 / Math.max(W, H));
    r.setPixelRatio(1);
    r.setSize(Math.round(W * s), Math.round(H * s), false);
    const c = this.camera;
    c.left = b.x0; c.right = b.x1; c.top = -b.y0; c.bottom = -b.y1; c.updateProjectionMatrix();
    r.render(this.scene, c);
    const url = r.domElement.toDataURL('image/png');
    r.setPixelRatio(pr);
    r.setSize(old.x, old.y, false);
    this.render();
    return url;
  }
}
