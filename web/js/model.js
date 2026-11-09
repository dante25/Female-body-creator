// Parametarski model ženskog tijela.
// Sve dimenzije su u centimetrima, y raste od poda prema gore,
// x je lijevo/desno (desna strana tijela = +x), z je naprijed (+z = lice).

export const PARAM_GROUPS = [
  {
    id: 'opce', label: 'Opće', params: [
      { id: 'height', label: 'Visina', min: 145, max: 195, def: 168, unit: 'cm' },
      { id: 'weight', label: 'Punoća (masa)', min: 0, max: 100, def: 40 },
      { id: 'muscle', label: 'Mišićavost', min: 0, max: 100, def: 30 },
    ],
  },
  {
    id: 'glava', label: 'Glava i vrat', params: [
      { id: 'headSize', label: 'Veličina glave', min: 85, max: 115, def: 100, unit: '%' },
      { id: 'headWidth', label: 'Širina glave', min: 85, max: 115, def: 100, unit: '%' },
      { id: 'jaw', label: 'Vilica / brada', min: 80, max: 120, def: 100, unit: '%' },
      { id: 'nose', label: 'Nos', min: 60, max: 140, def: 100, unit: '%' },
      { id: 'neckLength', label: 'Dužina vrata', min: 70, max: 140, def: 100, unit: '%' },
      { id: 'neckWidth', label: 'Debljina vrata', min: 75, max: 130, def: 100, unit: '%' },
    ],
  },
  {
    id: 'trup', label: 'Trup', params: [
      { id: 'shoulders', label: 'Širina ramena', min: 80, max: 125, def: 100, unit: '%' },
      { id: 'torsoLength', label: 'Dužina trupa', min: 85, max: 115, def: 100, unit: '%' },
      { id: 'chest', label: 'Grudni koš', min: 80, max: 125, def: 100, unit: '%' },
      { id: 'bust', label: 'Grudi – veličina', min: 0, max: 100, def: 40 },
      { id: 'bustLift', label: 'Grudi – visina', min: 0, max: 100, def: 50 },
      { id: 'waist', label: 'Struk', min: 70, max: 140, def: 100, unit: '%' },
      { id: 'belly', label: 'Stomak', min: 0, max: 100, def: 15 },
      { id: 'hips', label: 'Bokovi', min: 80, max: 130, def: 100, unit: '%' },
      { id: 'glutes', label: 'Zadnjica', min: 0, max: 100, def: 45 },
    ],
  },
  {
    id: 'ruke', label: 'Ruke', params: [
      { id: 'armLength', label: 'Dužina ruku', min: 85, max: 115, def: 100, unit: '%' },
      { id: 'upperArm', label: 'Nadlaktica', min: 75, max: 140, def: 100, unit: '%' },
      { id: 'forearm', label: 'Podlaktica', min: 75, max: 135, def: 100, unit: '%' },
      { id: 'hands', label: 'Šake', min: 85, max: 120, def: 100, unit: '%' },
    ],
  },
  {
    id: 'noge', label: 'Noge', params: [
      { id: 'legLength', label: 'Dužina nogu', min: 85, max: 115, def: 100, unit: '%' },
      { id: 'thighs', label: 'Butine', min: 75, max: 140, def: 100, unit: '%' },
      { id: 'knees', label: 'Koljena', min: 85, max: 120, def: 100, unit: '%' },
      { id: 'calves', label: 'Listovi', min: 75, max: 135, def: 100, unit: '%' },
      { id: 'ankles', label: 'Gležnjevi', min: 80, max: 125, def: 100, unit: '%' },
      { id: 'feet', label: 'Stopala', min: 85, max: 120, def: 100, unit: '%' },
    ],
  },
];

export const ALL_PARAMS = PARAM_GROUPS.flatMap(g => g.params);

export function defaultParams() {
  const p = {};
  for (const d of ALL_PARAMS) p[d.id] = d.def;
  return p;
}

export const PRESETS = {
  'Prosječna': {},
  'Vitka': { weight: 10, muscle: 20, waist: 90, hips: 92, thighs: 88, upperArm: 88, forearm: 90, calves: 90, bust: 25, glutes: 30, belly: 0, neckWidth: 92 },
  'Atletska': { weight: 25, muscle: 85, shoulders: 110, waist: 100, hips: 98, thighs: 112, calves: 115, upperArm: 112, forearm: 110, bust: 30, glutes: 60, belly: 0 },
  'Pješčani sat': { weight: 45, waist: 82, hips: 118, bust: 70, bustLift: 60, glutes: 70, thighs: 108, chest: 102 },
  'Kruška': { weight: 50, shoulders: 92, chest: 94, bust: 25, waist: 98, hips: 125, glutes: 75, thighs: 120, calves: 105 },
  'Punija': { weight: 90, muscle: 20, waist: 128, belly: 55, hips: 120, bust: 75, glutes: 70, thighs: 128, upperArm: 130, forearm: 118, calves: 120, neckWidth: 115, ankles: 112 },
  'Manekenka': { height: 180, weight: 12, legLength: 110, torsoLength: 95, headSize: 94, waist: 88, hips: 95, thighs: 90, bust: 30, neckLength: 115 },
};

// ---------- pomoćne funkcije ----------
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Monotona kubna interpolacija (Fritsch–Carlson) kroz tačke [[x, y], ...] sortirane po x.
export function makeSpline(pts) {
  const n = pts.length;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// Asimetrična gausova "izbočina".
const bump = (y, c, sUp, sDown) => {
  const s = y > c ? sUp : sDown;
  const q = (y - c) / s;
  return Math.exp(-q * q);
};

// ---------- glavna funkcija ----------
export function buildModel(P) {
  const H = P.height;
  const pc = k => P[k] / 100;              // procenat -> faktor
  const f = (P.weight - 40) / 60;            // punoća  [-0.67 .. 1]
  const m = (P.muscle - 30) / 70;            // mišići  [-0.43 .. 1]
  const fat = k => 1 + f * k;
  const mus = k => 1 + m * k;

  // --- vertikalni segmenti (normalizirani na zadanu visinu) ---
  const seg = {
    head: 0.130 * pc('headSize'),
    neck: 0.035 * pc('neckLength'),
    torso: 0.350 * pc('torsoLength'),
    legs: 0.485 * pc('legLength'),
  };
  const sum = seg.head + seg.neck + seg.torso + seg.legs;
  for (const k in seg) seg[k] = seg[k] / sum * H;

  const yCrotch = seg.legs;
  const yShoulder = yCrotch + seg.torso;
  const yChin = yShoulder + seg.neck;
  const yTop = yChin + seg.head;
  const T = t => yCrotch + t * seg.torso;  // relativna visina na trupu

  const yBust = T(0.64 + 0.10 * P.bustLift / 100);
  const yUnderBust = T(0.585 + 0.05 * P.bustLift / 100);
  const yWaist = T(0.43);
  const yNavel = T(0.31);
  const yHip = T(0.08);

  // --- širine (polovine) ---
  const sh = H * 0.100 * pc('shoulders') * mus(0.06) * fat(0.04);
  const chestW = H * 0.080 * pc('chest') * fat(0.12);
  const bustW = chestW + H * 0.010 * P.bust / 100 * fat(0.2);
  const waistW = H * 0.068 * pc('waist') * fat(0.35) * mus(0.02) + H * 0.006 * P.belly / 100;
  const hipW = H * 0.097 * pc('hips') * fat(0.17) + H * 0.006 * P.glutes / 100;
  const neckR = H * 0.0275 * pc('neckWidth') * fat(0.12) * mus(0.06);

  const torsoW = makeSpline([
    [yCrotch - H * 0.045, hipW * 0.45],
    [yCrotch - H * 0.02, hipW * 0.86],
    [yCrotch, hipW * 0.97],
    [yHip, hipW],
    [T(0.24), lerp(hipW, waistW, 0.55)],
    [yWaist, waistW],
    [yUnderBust, lerp(waistW, chestW, 0.85)],
    [yBust, bustW],
    [T(0.83), chestW * 1.04],
    [T(0.93), sh * 0.97],
    [yShoulder, sh * 0.93],
    [yShoulder + H * 0.012, lerp(neckR, sh, 0.45)],
    [yShoulder + H * 0.022, neckR * 1.05],
  ]);

  // --- dubina trupa: naprijed (F) i nazad (B) od središnje ravni ---
  const bellyA = H * (0.045 * P.belly / 100 * fat(0.4) + 0.016 * Math.max(f, 0));
  const torsoF0 = makeSpline([
    [yCrotch - H * 0.045, H * 0.012],
    [yCrotch - H * 0.02, H * 0.030],
    [yCrotch, H * 0.042 * fat(0.15)],
    [yHip, H * 0.049 * fat(0.2)],
    [T(0.24), H * 0.050 * fat(0.25)],
    [yWaist, H * 0.049 * fat(0.3)],
    [yUnderBust, H * 0.052 * pc('chest')],
    [yBust, H * 0.057 * pc('chest')],
    [T(0.83), H * 0.053 * pc('chest')],
    [yShoulder, H * 0.034],
    [yShoulder + H * 0.022, neckR * 0.55],
  ]);
  const torsoB0 = makeSpline([
    [yCrotch - H * 0.045, H * 0.012],
    [yCrotch - H * 0.02, H * 0.028],
    [yCrotch, H * 0.046 * fat(0.15)],
    [yHip, H * 0.060 * fat(0.15)],
    [T(0.24), H * 0.050 * fat(0.15)],
    [yWaist, H * 0.040 * fat(0.2)],
    [yUnderBust, H * 0.047],
    [yBust, H * 0.051],
    [T(0.83), H * 0.055 * mus(0.04)],
    [yShoulder, H * 0.047],
    [yShoulder + H * 0.022, neckR * 0.8],
  ]);

  const bustA = H * (0.006 + 0.052 * P.bust / 100) * fat(0.15);
  const bustSU = H * (0.045 + 0.02 * P.bust / 100), bustSD = H * (0.020 + 0.012 * P.bust / 100);
  const gluteA = H * (0.006 + 0.036 * P.glutes / 100) * fat(0.1);
  const gluteY = T(0.06);
  const gluteSU = H * 0.05, gluteSD = H * 0.026;

  const bustBump = y => bustA * bump(y, yBust, bustSU, bustSD);
  const gluteBump = y => gluteA * bump(y, gluteY, gluteSU, gluteSD);
  const bellyBump = y => bellyA * bump(y, yNavel, H * 0.06, H * 0.05);

  // Profil (bočni pogled) – uključuje izbočine
  const torsoF = y => torsoF0(y) + bustBump(y) + bellyBump(y);
  const torsoB = y => torsoB0(y) + gluteBump(y);

  const torso = {
    yBottom: yCrotch - H * 0.045,
    yTop: yShoulder + H * 0.022,
    W: torsoW, F0: torsoF0, B0: torsoB0, F: torsoF, B: torsoB,
    bustBump, gluteBump, bellyBump,
  };

  // Poprečni presjek trupa na visini y (za 3D i obime). Vraća [[x,z],...]
  // θ = 0 -> naprijed (+z), θ = π/2 -> desno (+x)
  torso.ring = (y, n = 48) => {
    const w = torsoW(y), fr = torsoF0(y) + bellyBump(y), bk = torsoB0(y);
    const bb = bustBump(y), gb = gluteBump(y);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const th = i / n * Math.PI * 2;
      const s = Math.sin(th), c = Math.cos(th);
      const p = 0.82; // superelipsa (malo "kvadratnija" od elipse)
      let x = w * Math.sign(s) * Math.pow(Math.abs(s), p);
      let z = (c >= 0 ? fr : bk) * Math.sign(c) * Math.pow(Math.abs(c), p);
      // grudi: dva režnja naprijed
      if (bb > 0.001) {
        const lobe = g => Math.exp(-(((th - g) / 0.42) ** 2));
        const a = lobe(0.5) + lobe(Math.PI * 2 - 0.5);
        z += bb * a * 0.95; x += Math.sign(s) * bb * a * 0.25;
      }
      // gluteusi: dva režnja nazad
      if (gb > 0.001) {
        const lobe = g => Math.exp(-(((th - g) / 0.55) ** 2));
        const a = lobe(Math.PI - 0.42) + lobe(Math.PI + 0.42);
        z -= gb * a * 0.95; x += Math.sign(s) * gb * a * 0.2;
      }
      pts.push([x, z]);
    }
    return pts;
  };

  // --- noge ---
  const thighR = H * 0.052 * pc('thighs') * fat(0.25) * mus(0.08);
  const kneeR = H * 0.030 * pc('knees') * fat(0.12);
  const calfR = H * 0.0325 * pc('calves') * fat(0.15) * mus(0.12);
  const ankleR = H * 0.0155 * pc('ankles') * fat(0.08);
  const L = yCrotch;
  const legX = hipW * 0.5;
  const leg = [ // x, y, z, r   (z = pomak središta, "back" = dodatak nazad)
    { x: legX * 1.02, y: yCrotch + H * 0.05, z: 0, r: thighR * 0.98 },
    { x: legX, y: yCrotch, z: 0, r: thighR },
    { x: lerp(legX, H * 0.040, 0.55), y: L * 0.80, z: H * 0.003, r: lerp(thighR, kneeR, 0.42) },
    { x: H * 0.040, y: L * 0.585, z: H * 0.002, r: kneeR },
    { x: H * 0.040, y: L * 0.43, z: -H * 0.008, r: calfR },
    { x: H * 0.039, y: L * 0.25, z: -H * 0.006, r: lerp(calfR, ankleR, 0.6) },
    { x: H * 0.038, y: L * 0.09, z: -H * 0.004, r: ankleR },
    { x: H * 0.038, y: H * 0.028, z: -H * 0.004, r: ankleR * 1.15 },
  ];
  const footLen = H * 0.150 * pc('feet');
  const foot = {
    x: H * 0.040, heelZ: -H * 0.022 * pc('feet'), toeZ: -H * 0.022 + footLen,
    width: H * 0.024 * pc('feet') * fat(0.05), height: H * 0.040,
    ankleY: H * 0.045,
  };

  // --- ruke ---
  const armLen = H * 0.315 * pc('armLength');
  const uaR = H * 0.0235 * pc('upperArm') * fat(0.3) * mus(0.15);
  const faR = H * 0.0195 * pc('forearm') * fat(0.18) * mus(0.12);
  const wristR = H * 0.0135 * fat(0.05);
  const handS = pc('hands');
  const shoulderJ = { x: sh - uaR * 0.95, y: yShoulder - H * 0.016, z: -H * 0.006 };
  const wristY = shoulderJ.y - armLen;
  // najšira tačka tijela na visini zgloba (trup ili vanjska ivica butine)
  const hipAtWrist = Math.max(torsoW(wristY), hipW * 0.5 + H * 0.052 * pc('thighs') * fat(0.25) * mus(0.08) * 0.97);
  const wrist = { x: Math.max(hipAtWrist + wristR + H * 0.012, shoulderJ.x + H * 0.02), y: wristY, z: H * 0.004 };
  const elbowY = shoulderJ.y - armLen * 0.47;
  const elbowX = Math.max(lerp(shoulderJ.x, wrist.x, 0.47) + H * 0.006, torsoW(elbowY) + H * 0.026 * fat(0.2));
  const arm = [
    { x: shoulderJ.x, y: shoulderJ.y + H * 0.004, z: shoulderJ.z, r: uaR * 1.18 },
    { x: lerp(shoulderJ.x, elbowX, 0.35), y: lerp(shoulderJ.y, elbowY, 0.35), z: -H * 0.008, r: uaR },
    { x: elbowX, y: elbowY, z: -H * 0.012, r: lerp(uaR, faR, 0.55) * 0.92 },
    { x: lerp(elbowX, wrist.x, 0.3), y: lerp(elbowY, wristY, 0.3), z: -H * 0.006, r: faR },
    { x: wrist.x, y: wristY, z: wrist.z, r: wristR },
  ];
  // šaka nastavlja smjer podlaktice
  const dx = wrist.x - elbowX, dy = wristY - elbowY, dl = Math.hypot(dx, dy);
  const ux = dx / dl, uy = dy / dl;
  const hl = H * 0.108 * handS;
  const hand = [
    { t: 0.0, r: wristR },
    { t: 0.32, r: H * 0.0185 * handS * fat(0.05) },
    { t: 0.62, r: H * 0.0165 * handS },
    { t: 0.90, r: H * 0.011 * handS },
    { t: 1.0, r: H * 0.004 * handS },
  ].map(p => ({ x: wrist.x + ux * hl * p.t, y: wristY + uy * hl * p.t, z: wrist.z + H * 0.008 * p.t, r: p.r }));

  // --- glava ---
  const head = {
    yChin, yTop, h: seg.head,
    w: H * 0.046 * pc('headSize') * pc('headWidth'),
    len: H * 0.114 * pc('headSize'),
    z: H * 0.006, jaw: pc('jaw'), nose: pc('nose'),
  };
  const neck = { r: neckR, y0: yShoulder - H * 0.01, y1: yChin + seg.head * 0.25, z0: -H * 0.010, z1: H * 0.002 };

  // --- mjere (obimi) ---
  const perim = pts => {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      s += Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
    return s;
  };
  const scan = (y0, y1, pick) => {
    let best = null;
    for (let i = 0; i <= 24; i++) {
      const y = lerp(y0, y1, i / 24);
      const c = perim(torso.ring(y, 96));
      if (best === null || pick(c, best)) best = c;
    }
    return best;
  };
  const measures = {
    height: H,
    bust: scan(yBust - H * 0.03, yBust + H * 0.03, (a, b) => a > b),
    underbust: perim(torso.ring(yUnderBust - H * 0.012, 96)),
    waist: scan(yWaist - H * 0.04, yWaist + H * 0.04, (a, b) => a < b),
    hips: scan(yCrotch, T(0.2), (a, b) => a > b),
    shoulders: (shoulderJ.x + uaR * 1.18) * 2,
    inseam: yCrotch,
    thigh: 2 * Math.PI * thighR * 0.98,
  };

  return {
    H, P, seg, yCrotch, yShoulder, yChin, yTop, yBust, yWaist, yHip, yNavel,
    torso, leg, foot, arm, hand, head, neck, measures,
  };
}
