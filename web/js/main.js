import { PARAM_GROUPS, ALL_PARAMS, PRESETS, defaultParams, buildModel, clamp } from './model.js';
import { renderSheet } from './sheet2d.js';

const $ = s => document.querySelector(s);
const STORE = 'bodyCreator.v1';

// ---------- stanje ----------
const store = {
  get() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; } },
  set(v) { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* nema pohrane */ } },
};
const saved = store.get();
const state = {
  P: { ...defaultParams(), ...(saved.P || {}) },
  mode: saved.mode || '2d',
  tab: saved.tab || PARAM_GROUPS[0].id,
  guides: saved.guides ?? true,
  skin: saved.skin || '#e0b9a0',
  zoom: 1,
};
const persist = () => store.set({ P: state.P, mode: state.mode, tab: state.tab, guides: state.guides, skin: state.skin });

let view3d = null;
let M = null;

// ---------- slajderi ----------
const inputs = {};
function buildSliders() {
  const tabs = $('#tabs'), box = $('#sliders');
  for (const g of PARAM_GROUPS) {
    const b = document.createElement('button');
    b.textContent = g.label; b.dataset.tab = g.id;
    b.onclick = () => { state.tab = g.id; showTab(); persist(); };
    tabs.appendChild(b);

    const sec = document.createElement('div');
    sec.className = 'group'; sec.dataset.group = g.id;
    for (const d of g.params) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<div class="top"><span class="lbl">${d.label}</span><span class="val"></span></div>
        <input type="range" min="${d.min}" max="${d.max}" step="1">`;
      const inp = row.querySelector('input');
      inp.oninput = () => { state.P[d.id] = +inp.value; syncRow(d); schedule(); };
      inp.onchange = persist;
      // dupli dodir na naziv vraća zadanu vrijednost
      row.querySelector('.top').ondblclick = () => { state.P[d.id] = d.def; syncRow(d); schedule(); persist(); };
      inputs[d.id] = { inp, row, val: row.querySelector('.val') };
      sec.appendChild(row);
    }
    box.appendChild(sec);
  }
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = 'Savjet: dvaput dodirni naziv slajdera za vraćanje na zadanu vrijednost.';
  box.appendChild(hint);
}

function syncRow(d) {
  const { inp, row, val } = inputs[d.id];
  const v = state.P[d.id];
  inp.value = v;
  inp.style.setProperty('--p', `${(v - d.min) / (d.max - d.min) * 100}%`);
  val.textContent = d.unit ? `${v} ${d.unit}` : v;
  row.classList.toggle('changed', v !== d.def);
}
const syncAll = () => ALL_PARAMS.forEach(syncRow);

function showTab() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  document.querySelectorAll('.group').forEach(s => s.classList.toggle('hidden', s.dataset.group !== state.tab));
}

// ---------- crtanje ----------
let pending = false;
function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; render(); });
}

function render() {
  M = buildModel(state.P);
  const ms = M.measures;
  $('#measures').innerHTML =
    `Visina <b>${ms.height.toFixed(0)}</b> cm<br>` +
    `Grudi <b>${ms.bust.toFixed(0)}</b> · Struk <b>${ms.waist.toFixed(0)}</b> · Bokovi <b>${ms.hips.toFixed(0)}</b>`;
  if (state.mode === '2d') {
    $('#sheet').innerHTML = renderSheet(M, { guides: state.guides });
    applyZoom();
  } else if (view3d) {
    view3d.update(M);
  }
}

function applyZoom() {
  const sheet = $('#sheet'), svg = sheet.querySelector('svg');
  if (!svg) return;
  sheet.classList.toggle('zoomed', state.zoom > 1);
  svg.style.width = state.zoom > 1 ? `${state.zoom * 100}%` : '';
}

async function setMode(mode) {
  state.mode = mode; persist();
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  const is3d = mode === '3d';
  $('#sheet').classList.toggle('hidden', is3d);
  $('#tools2d').classList.toggle('hidden', is3d);
  $('#three').classList.toggle('hidden', !is3d);
  $('#tools3d').classList.toggle('hidden', !is3d);
  if (is3d && !view3d) {
    try {
      const { View3D } = await import('./view3d.js');
      view3d = new View3D($('#three'));
      view3d.setColor(state.skin);
    } catch (e) {
      toast('3D nije dostupan: ' + e.message);
      return setMode('2d');
    }
  }
  if (view3d) view3d.setVisible(is3d);
  render();
}

// ---------- spremanje slike ----------
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2600);
}

function sheetToPng() {
  return new Promise((resolve, reject) => {
    const svg = renderSheet(M, { guides: state.guides });
    const vb = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
    const W = 2400, Hh = Math.round(W * vb[3] / vb[2]);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = W; c.height = Hh;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, Hh);
      ctx.drawImage(img, 0, 0, W, Hh);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('<svg ', `<svg width="${W}" height="${Hh}" `));
  });
}

async function saveImage() {
  try {
    const dataUrl = state.mode === '2d' ? await sheetToPng() : view3d.snapshot();
    const name = `body_${state.mode}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
    if (window.AndroidBridge && window.AndroidBridge.savePng) {
      const res = window.AndroidBridge.savePng(dataUrl.split(',')[1], name);
      toast(res || 'Spremljeno');
    } else {
      const a = document.createElement('a');
      a.href = dataUrl; a.download = name; a.click();
      toast('Slika preuzeta');
    }
  } catch (e) {
    toast('Greška pri spremanju: ' + e.message);
  }
}

// ---------- predlošci / nasumično ----------
function buildPresets() {
  const sel = $('#preset');
  sel.innerHTML = '<option value="">Predložak…</option>' +
    Object.keys(PRESETS).map(k => `<option>${k}</option>`).join('');
  sel.onchange = () => {
    if (!sel.value) return;
    state.P = { ...defaultParams(), ...PRESETS[sel.value] };
    sel.value = '';
    syncAll(); schedule(); persist();
  };
}

function randomize() {
  const g = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // ~normalno, [-1,1]
  for (const d of ALL_PARAMS) {
    const span = d.id === 'height' ? 0.5 : 0.75;
    const half = (d.max - d.min) / 2 * span;
    state.P[d.id] = Math.round(clamp(d.def + g() * half, d.min, d.max));
  }
  syncAll(); schedule(); persist();
}

// ---------- start ----------
buildSliders();
buildPresets();
syncAll();
showTab();
$('#guides').checked = state.guides;
$('#skin').value = state.skin;

document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
$('#btnRandom').onclick = randomize;
$('#btnReset').onclick = () => { state.P = defaultParams(); syncAll(); schedule(); persist(); toast('Vraćeno na zadano'); };
$('#btnSave').onclick = saveImage;
$('#guides').onchange = e => { state.guides = e.target.checked; persist(); schedule(); };
$('#zoomIn').onclick = () => { state.zoom = Math.min(4, state.zoom * 1.5); applyZoom(); };
$('#zoomOut').onclick = () => { state.zoom = Math.max(1, state.zoom / 1.5); applyZoom(); };
$('#skin').oninput = e => { state.skin = e.target.value; view3d?.setColor(state.skin); persist(); };
$('#wire').onchange = e => view3d?.setWireframe(e.target.checked);
document.querySelectorAll('#tools3d [data-view]').forEach(b => b.onclick = () => view3d?.setView(b.dataset.view));

setMode(state.mode);
