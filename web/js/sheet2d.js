// 2D "character sheet": sprijeda, profil, otpozadi.
// Svi dijelovi se crtaju kao zatvoreni poligoni; spajanje kontura radi se
// trikom "prvo debela siva linija za sve dijelove, pa bijela ispuna preko",
// pa se dobija jedna zajednička kontura kao na referentnoj slici.

import { lerp } from './model.js';

const smoothstep = t => t * t * (3 - 2 * t);

// Catmull-Rom zatvorena putanja -> SVG bezier
export function smoothPath(pts) {
  const n = pts.length;
  const f = v => v.toFixed(2);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
}

function openPath(pts) {
  return 'M' + pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('L');
}

// Gusto uzorkovanje centralne linije (Catmull-Rom) s interpolacijom poluprečnika.
function sampleChain(ctrl, k = 8) {
  const out = [];
  const n = ctrl.length;
  const P = i => ctrl[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let j = 0; j < k; j++) {
      const t = j / k, t2 = t * t, t3 = t2 * t;
      const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y), r: lerp(p1.r, p2.r, smoothstep(t)) });
    }
  }
  out.push({ ...ctrl[n - 1] });
  return out;
}

// Lijeva/desna ivica lanca (bez kapica).
function chainEdges(ctrl) {
  const s = sampleChain(ctrl), n = s.length, left = [], right = [];
  s.forEach((p, i) => {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l, ny = dx / l;
    left.push([p.x + nx * p.r, p.y + ny * p.r]);
    right.push([p.x - nx * p.r, p.y - ny * p.r]);
  });
  return { left, right };
}

// Obris "kobasice" oko centralne linije sa zaobljenim krajevima.
export function chainOutline(ctrl, { capStart = true, capEnd = true } = {}) {
  const s = sampleChain(ctrl);
  const n = s.length;
  const tan = s.map((p, i) => {
    const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    return [dx / l, dy / l];
  });
  const left = [], right = [];
  s.forEach((p, i) => {
    const [tx, ty] = tan[i];
    const nx = -ty, ny = tx;
    left.push([p.x + nx * p.r, p.y + ny * p.r]);
    right.push([p.x - nx * p.r, p.y - ny * p.r]);
  });
  const poly = [...left];
  const cap = (p, t, sign) => {
    const [tx, ty] = t; const nx = -ty, ny = tx;
    const res = [];
    for (let i = 1; i < 6; i++) {
      const a = i / 6 * Math.PI;
      res.push([p.x + sign * (nx * Math.cos(a) + tx * Math.sin(a)) * p.r,
                p.y + sign * (ny * Math.cos(a) + ty * Math.sin(a)) * p.r]);
    }
    return res;
  };
  if (capEnd && s[n - 1].r > 0.2) poly.push(...cap(s[n - 1], tan[n - 1], 1));
  poly.push(...right.reverse());
  if (capStart && s[0].r > 0.2) poly.push(...cap(s[0], tan[0], -1));
  return poly;
}

// -------- dijelovi tijela u 2D --------

function headFront(M) {
  const h = M.head, hh = h.h, hw = h.w;
  const right = [
    [0.0, 1.0], [0.42, 0.985], [0.78, 0.9], [0.96, 0.75], [1.0, 0.6], [0.97, 0.46],
    [0.9, 0.34], [0.78, 0.22], [0.58, 0.1], [0.3, 0.02],
  ].map(([u, v]) => {
    const j = v < 0.45 ? lerp(h.jaw, 1, v / 0.45) : 1;
    return [u * hw * j, h.yChin + v * hh];
  });
  const left = right.slice(1).reverse().map(([x, y]) => [-x, y]);
  return [...right, [0, h.yChin], ...left];
}

function headSide(M) {
  const h = M.head, hh = h.h, hl = h.len / 2, n = h.nose, j = h.jaw;
  const pts = [
    [0.1, 1.0], [0.5, 0.96], [0.8, 0.84], [0.92, 0.7], [0.94, 0.63], [0.885, 0.59],
    [0.9, 0.55], [0.9 + 0.13 * n, 0.46], [0.9 + 0.06 * n, 0.425], [0.875, 0.415],
    [0.9, 0.375], [0.87, 0.34], [0.89, 0.305], [0.835, 0.255],
    [0.84 + 0.08 * (j - 1), 0.17], [0.76 * j, 0.04], [0.6, 0.0], [0.35, 0.06], [0.05, 0.12],
    [-0.5, 0.24], [-0.86, 0.38], [-0.99, 0.58], [-0.93, 0.8], [-0.66, 0.95], [-0.28, 1.0],
  ];
  return pts.map(([zn, v]) => [h.z + zn * hl, h.yChin + v * hh]);
}

function torsoFront(M) {
  const t = M.torso, N = 70, right = [];
  for (let i = 0; i <= N; i++) {
    const y = lerp(t.yTop, t.yBottom, i / N);
    right.push([t.W(y), y]);
  }
  const left = right.slice().reverse().map(([x, y]) => [-x, y]);
  return [...right, ...left];
}

function torsoSide(M) {
  const t = M.torso, N = 80, front = [], back = [];
  for (let i = 0; i <= N; i++) {
    const y = lerp(t.yTop, t.yBottom, i / N);
    front.push([t.F(y), y]);
    back.push([-t.B(y), y]);
  }
  return [...front, ...back.reverse()];
}

function footFront(M, side) {
  const f = M.foot;
  const cx = side * (f.x + M.H * 0.004), w = f.width, top = f.ankleY;
  const pts = [];
  // zaobljen oblik: od gležnja se širi do poda
  const prof = [[0, 0.62], [0.25, 0.8], [0.5, 0.95], [0.75, 1.0], [0.92, 0.9], [1.0, 0.55]];
  for (const [t, s] of prof) pts.push([cx + w * s, top - t * top]);
  for (let i = prof.length - 1; i >= 0; i--) { const [t, s] = prof[i]; pts.push([cx - w * s * 0.92, top - t * top]); }
  return pts;
}

function footSide(M) {
  const f = M.foot, H = M.H;
  const hz = f.heelZ, tz = f.toeZ, L = tz - hz, top = f.ankleY;
  // facing +z (prema licu)
  return [
    [hz + L * 0.12, top * 1.15], [hz + L * 0.30, top * 1.1], [hz + L * 0.48, top * 0.82],
    [hz + L * 0.72, top * 0.48], [hz + L * 0.9, top * 0.32], [tz, top * 0.16], [tz - L * 0.02, 0.2],
    [hz + L * 0.7, 0.05], [hz + L * 0.35, 0.3], [hz + L * 0.08, 0.1], [hz - H * 0.002, top * 0.25],
    [hz + L * 0.02, top * 0.7],
  ];
}

// Dijelovi za pogled sprijeda/otpozadi (x, y)
function frontParts(M) {
  const parts = [];
  parts.push(torsoFront(M));
  parts.push(chainOutline([{ x: 0, y: M.neck.y0, r: M.neck.r * 1.1 }, { x: 0, y: M.neck.y1, r: M.neck.r }]));
  parts.push(headFront(M));
  for (const s of [1, -1]) {
    parts.push(chainOutline(M.leg.map(p => ({ x: s * p.x, y: p.y, r: p.r }))));
    parts.push(footFront(M, s));
    const chain = [...M.arm, ...M.hand.slice(1)].map(p => ({ x: s * p.x, y: p.y, r: p.r }));
    parts.push(chainOutline(chain, { capEnd: false }));
  }
  return parts;
}

// Profil: horizontalna osa = z (lice gleda lijevo -> x = -z)
function sideParts(M) {
  const flip = pts => pts.map(([z, y]) => [-z, y]);
  const body = [];
  body.push(flip(torsoSide(M)));
  body.push(flip(chainOutline([
    { x: M.neck.z0, y: M.neck.y0, r: M.neck.r * 1.08 },
    { x: M.neck.z1, y: M.neck.y1, r: M.neck.r },
  ])));
  body.push(flip(headSide(M)));
  // noga: list izbočen nazad
  const legSide = M.leg.map((p, i) => {
    const calfShift = (i === 4 ? -0.22 : i === 5 ? -0.12 : 0) * p.r;
    const thighFront = i === 2 ? 0.08 * p.r : 0;
    return { x: p.z + calfShift + thighFront, y: p.y, r: p.r * (i === 4 ? 1.08 : 1) };
  });
  body.push(flip(chainOutline(legSide)));
  body.push(flip(footSide(M)));
  // ruka (crta se iznad tijela sa svojom konturom)
  const armChain = [...M.arm, ...M.hand.slice(1)].map((p, i) => ({ x: p.z, y: p.y, r: p.r * (i === 0 ? 0.95 : 0.93) }));
  const arm = flip(chainOutline(armChain, { capEnd: false }));
  return { body, arm };
}

// ---------- SVG ----------
export function renderSheet(M, opts = {}) {
  const H = M.H;
  const sw = H * 0.0062;               // debljina konture
  const gap = H * 0.47;
  const cols = [0, gap, gap * 2];
  const top = -(M.yTop + H * 0.07);
  const bottom = H * 0.11;
  const left = -H * 0.26 - (opts.guides ? H * 0.07 : 0);
  const right = gap * 2 + H * 0.31;
  const vb = [left, top, right - left, bottom - top];

  const tr = (pts, dx) => pts.map(([x, y]) => [x + dx, -y]);
  const outline = '#6f6f6f', fill = opts.fill || '#ffffff';

  const unionGroup = (parts, dx) => {
    const ds = parts.map(p => smoothPath(tr(p, dx)));
    return `<g stroke="${outline}" stroke-width="${(sw * 2).toFixed(2)}" stroke-linejoin="round" fill="${outline}">` +
      ds.map(d => `<path d="${d}"/>`).join('') + `</g>` +
      `<g fill="${fill}">` + ds.map(d => `<path d="${d}"/>`).join('') + `</g>`;
  };

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(v => v.toFixed(1)).join(' ')}" preserveAspectRatio="xMidYMid meet">`;
  svg += `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="#ffffff"/>`;

  // Vodilice: visine glave
  if (opts.guides) {
    const unit = M.yTop - M.yChin;
    const n = Math.ceil(M.yTop / unit);
    svg += `<g stroke="#c9d6e8" stroke-width="${(sw * 0.25).toFixed(2)}" stroke-dasharray="${sw * 1.5} ${sw}">`;
    for (let i = 0; i <= n; i++) {
      const y = -(M.yTop - i * unit);
      if (-y < -0.01) break;
      svg += `<line x1="${left + H * 0.06}" y1="${y}" x2="${right - H * 0.02}" y2="${y}"/>`;
    }
    svg += `</g><g fill="#8aa3c4" font-size="${H * 0.022}" font-family="sans-serif" text-anchor="end">`;
    for (let i = 0; i < n; i++) {
      const y = -(M.yTop - (i + 0.5) * unit);
      if (-y < 0) break;
      svg += `<text x="${left + H * 0.05}" y="${y + H * 0.008}">${i + 1}</text>`;
    }
    svg += `</g>`;
    // orijentiri
    const marks = [['grudi', M.yBust], ['struk', M.yWaist], ['bokovi', M.yHip], ['međunožje', M.yCrotch]];
    svg += `<g stroke="#e8b4b8" stroke-width="${(sw * 0.3).toFixed(2)}">`;
    for (const [, y] of marks) svg += `<line x1="${left + H * 0.06}" y1="${-y}" x2="${right - H * 0.02}" y2="${-y}"/>`;
    svg += `</g><g fill="#c98a90" font-size="${H * 0.016}" font-family="sans-serif">`;
    for (const [t, y] of marks) svg += `<text x="${right - H * 0.02}" y="${-y - H * 0.006}" text-anchor="end">${t}</text>`;
    svg += `</g>`;
  }

  // pod
  svg += `<line x1="${left + H * 0.06}" y1="0" x2="${right - H * 0.02}" y2="0" stroke="#d0d0d0" stroke-width="${sw * 0.3}"/>`;

  // Sprijeda
  const fp = frontParts(M);
  svg += unionGroup(fp, cols[0]);
  // Profil
  const sp = sideParts(M);
  svg += unionGroup(sp.body, cols[1]);
  const armD = smoothPath(tr(sp.arm, cols[1]));
  svg += `<path d="${armD}" fill="${fill}" stroke="${outline}" stroke-width="${(sw * 0.7).toFixed(2)}" stroke-linejoin="round"/>`;
  // Otpozadi (silueta je simetrična) + detalji leđa
  svg += unionGroup(fp, cols[2]);

  // tanke unutrašnje linije
  const thin = `fill="none" stroke="${outline}" stroke-width="${(sw * 0.45).toFixed(2)}" stroke-linecap="round"`;
  const bx = cols[2];
  const gY = M.yCrotch + H * 0.005;
  svg += `<path ${thin} d="${openPath([[bx, -(M.yCrotch + H * 0.075)], [bx, -(gY - H * 0.0)]])}"/>`;
  for (const s of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push([bx + s * lerp(H * 0.004, M.torso.W(gY) * 0.62, t), -(gY - H * 0.012 * Math.sin(t * Math.PI) + H * 0.004 * t)]);
    }
    svg += `<path ${thin} d="${openPath(pts)}"/>`;
  }
  svg += `<path ${thin} opacity="0.55" d="${openPath([[bx, -(M.yShoulder - H * 0.01)], [bx, -(M.yWaist)]])}"/>`;
  // unutrašnja ivica ruku (vidljiva i kad se ruka preklapa s trupom)
  const yArmpit = M.yCrotch + M.seg.torso * 0.8;
  for (const dx of [cols[0], cols[2]]) {
    for (const s of [1, -1]) {
      const chain = [...M.arm, ...M.hand.slice(1)].map(p => ({ x: s * p.x, y: p.y, r: p.r }));
      const e = chainEdges(chain);
      const inner = (s > 0 ? e.right : e.left).filter(([, y]) => y < yArmpit);
      if (inner.length > 2) svg += `<path ${thin} d="${openPath(tr(inner, dx))}"/>`;
    }
  }
  // pupak i linija između nogu sprijeda
  svg += `<ellipse cx="${cols[0]}" cy="${-M.yNavel}" rx="${H * 0.0025}" ry="${H * 0.004}" fill="${outline}" opacity="0.7"/>`;
  svg += `<path ${thin} d="${openPath([[cols[0], -(M.yCrotch + H * 0.004)], [cols[0], -(M.yCrotch - H * 0.035)]])}"/>`;

  // naslovi
  const labels = ['SPRIJEDA', 'PROFIL', 'OTPOZADI'];
  svg += `<g fill="#555" font-size="${H * 0.026}" font-family="sans-serif" font-weight="600" text-anchor="middle" letter-spacing="${H * 0.002}">`;
  labels.forEach((l, i) => { svg += `<text x="${cols[i]}" y="${top + H * 0.04}">${l}</text>`; });
  svg += `</g>`;

  // mjere
  const ms = M.measures;
  const txt = `Visina ${ms.height.toFixed(0)} cm   ·   Grudi ${ms.bust.toFixed(0)}   ·   Ispod grudi ${ms.underbust.toFixed(0)}   ·   Struk ${ms.waist.toFixed(0)}   ·   Bokovi ${ms.hips.toFixed(0)}   ·   Ramena ${ms.shoulders.toFixed(0)}   ·   Unutr. dužina noge ${ms.inseam.toFixed(0)} cm`;
  svg += `<text x="${(left + right) / 2}" y="${H * 0.07}" font-size="${H * 0.019}" fill="#666" font-family="sans-serif" text-anchor="middle">${txt}</text>`;

  svg += `</svg>`;
  return svg;
}
