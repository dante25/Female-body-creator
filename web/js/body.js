// Bazni model (MakeHuman, CC0) + morph targeti.
// Jedinica u fajlu je decimetar; y = 0 je pod.

export async function loadBody(base = 'model/') {
  const [manifest, bin] = await Promise.all([
    fetch(base + 'body.json').then(r => r.json()),
    fetch(base + 'body.bin').then(r => r.arrayBuffer()),
  ]);
  const f32 = d => new Float32Array(bin, d.offset, d.count);
  const u32 = d => new Uint32Array(bin, d.offset, d.count);
  const morphs = manifest.morphs.map(m => ({
    id: m.id, label: m.label, group: m.group,
    dec: { idx: u32(m.dec.idx), delta: f32(m.dec.delta) },
    inc: { idx: u32(m.inc.idx), delta: f32(m.inc.delta) },
  }));
  return new Body(f32(manifest.position), u32(manifest.body), u32(manifest.eyes), morphs);
}

export class Body {
  constructor(base, bodyIdx, eyeIdx, morphs) {
    this.base = base;
    this.bodyIdx = bodyIdx;
    this.eyeIdx = eyeIdx;
    this.morphs = morphs;
    this.groups = [...new Set(morphs.map(m => m.group))];
    this.positions = new Float32Array(base.length);
  }

  defaults() {
    const v = {};
    for (const m of this.morphs) v[m.id] = 0;
    return v;
  }

  // values: { id: -100..100 } -> popunjava this.positions, vraća visinu u cm
  apply(values) {
    const p = this.positions;
    p.set(this.base);
    for (const m of this.morphs) {
      const v = (values[m.id] || 0) / 100;
      if (!v) continue;
      const t = v > 0 ? m.inc : m.dec, w = Math.abs(v);
      const { idx, delta } = t;
      for (let i = 0, n = idx.length; i < n; i++) {
        const o = idx[i] * 3, d = i * 3;
        p[o] += delta[d] * w;
        p[o + 1] += delta[d + 1] * w;
        p[o + 2] += delta[d + 2] * w;
      }
    }
    // spusti na pod
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < p.length; i += 3) { if (p[i] < minY) minY = p[i]; if (p[i] > maxY) maxY = p[i]; }
    for (let i = 1; i < p.length; i += 3) p[i] -= minY;
    this.height = (maxY - minY);
    return this.height * 10;
  }

  // Wavefront OBJ trenutnog oblika (u centimetrima)
  toOBJ() {
    const p = this.positions, out = ['# Body Creator – baziran na MakeHuman (CC0)', 'o body'];
    for (let i = 0; i < p.length; i += 3) out.push(`v ${(p[i] * 10).toFixed(4)} ${(p[i + 1] * 10).toFixed(4)} ${(p[i + 2] * 10).toFixed(4)}`);
    const face = idx => { for (let i = 0; i < idx.length; i += 3) out.push(`f ${idx[i] + 1} ${idx[i + 1] + 1} ${idx[i + 2] + 1}`); };
    out.push('g body'); face(this.bodyIdx);
    out.push('g eyes'); face(this.eyeIdx);
    return out.join('\n') + '\n';
  }
}
