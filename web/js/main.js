import { loadBody } from './body.js';
import { Viewer } from './viewer.js';

const $ = s => document.querySelector(s);
const KEY = 'bodyCreator.v2';

const PRESETS = {
  'Prosječna': {},
  'Vitka': { weight: -60, muscle: -10, waist: -30, hips: -20, thighs: -30, bustSize: -30, glutes: -20, upperArm: -20 },
  'Atletska': { weight: -30, muscle: 80, shoulders: 25, vshape: 25, waist: -15, glutes: 30, thighs: 20, calves: 30, bustSize: -20 },
  'Pješčani sat': { waist: -55, hips: 50, bustSize: 60, glutes: 50, thighs: 20, bustFirm: 30 },
  'Kruška': { shoulders: -20, bustSize: -30, waist: -10, hips: 80, glutes: 60, thighs: 50 },
  'Punija': { weight: 80, belly: 40, bustSize: 50, hips: 40, glutes: 40, thighs: 40, upperArm: 40 },
  'Visoka manekenka': { height: 70, weight: -50, upperLegLen: 30, lowerLegLen: 30, waist: -30, hips: -10, bustSize: -20, neckLength: 30 },
};

const store = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* nema pohrane */ } },
};

let body, viewer;
const saved = store.get();
const state = { values: {}, chars: saved.chars || {}, tab: saved.tab, mode: saved.mode || '3d', skin: saved.skin || '#e2b49a', guides: saved.guides ?? true };
const persist = () => store.set({ values: state.values, chars: state.chars, tab: state.tab, mode: state.mode, skin: state.skin, guides: state.guides });

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- slajderi ----------
const rows = {};
function buildUI() {
  const tabs = $('#tabs'), box = $('#sliders');
  if (!body.groups.includes(state.tab)) state.tab = body.groups[0];
  for (const g of body.groups) {
    const b = document.createElement('button');
    b.textContent = g; b.dataset.tab = g;
    b.onclick = () => { state.tab = g; showTab(); persist(); };
    tabs.appendChild(b);
    const sec = document.createElement('div');
    sec.className = 'group'; sec.dataset.group = g;
    for (const m of body.morphs.filter(m => m.group === g)) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<div class="top"><span>${m.label}</span><span class="val"></span></div><input type="range" min="-100" max="100" step="1">`;
      const inp = row.querySelector('input');
      inp.oninput = () => { state.values[m.id] = +inp.value; syncRow(m.id); schedule(); };
      inp.onchange = persist;
      row.querySelector('.top').ondblclick = () => { state.values[m.id] = 0; syncRow(m.id); schedule(); persist(); };
      rows[m.id] = { row, inp, val: row.querySelector('.val') };
      sec.appendChild(row);
    }
    box.appendChild(sec);
  }
  showTab();
}

function syncRow(id) {
  const { row, inp, val } = rows[id];
  const v = state.values[id] || 0;
  inp.value = v;
  const p = (v + 100) / 2;
  inp.style.setProperty('--a', `${Math.min(50, p)}%`);
  inp.style.setProperty('--b', `${Math.max(50, p)}%`);
  val.textContent = v > 0 ? `+${v}` : v;
  row.classList.toggle('zero', v === 0);
}
const syncAll = () => Object.keys(rows).forEach(syncRow);

function showTab() {
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  document.querySelectorAll('.group').forEach(s => s.classList.toggle('hidden', s.dataset.group !== state.tab));
}

let pending = false;
function schedule() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    const h = body.apply(state.values);
    viewer.update();
    $('#height').textContent = `Visina ${h.toFixed(0)} cm`;
  });
}

function setValues(v) {
  state.values = { ...body.defaults(), ...v };
  syncAll(); schedule(); persist();
}

function setMode(m) {
  state.mode = m; persist();
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  $('#tools3d').classList.toggle('hidden', m !== '3d');
  $('#toolsSheet').classList.toggle('hidden', m !== 'sheet');
  viewer.setMode(m);
  $('#height').classList.toggle('hidden', m !== '3d');
}

// ---------- likovi ----------
function renderChars() {
  const list = $('#charList');
  const names = Object.keys(state.chars).sort((a, b) => a.localeCompare(b));
  list.innerHTML = names.length ? '' : '<div class="empty">Još nema spremljenih likova.</div>';
  for (const n of names) {
    const r = document.createElement('div');
    r.className = 'charrow';
    r.innerHTML = `<button class="item"><b></b><span>dodirni za učitavanje</span></button><button class="del" title="Obriši">🗑</button>`;
    r.querySelector('b').textContent = n;
    r.querySelector('.item').onclick = () => { setValues(state.chars[n]); close(); toast(`Učitano: ${n}`); };
    r.querySelector('.del').onclick = () => { delete state.chars[n]; persist(); renderChars(); };
    list.appendChild(r);
  }
  const pl = $('#presetList');
  pl.innerHTML = '';
  for (const n of Object.keys(PRESETS)) {
    const b = document.createElement('button');
    b.className = 'item'; b.innerHTML = '<b></b>';
    b.querySelector('b').textContent = n;
    b.onclick = () => { setValues(PRESETS[n]); close(); toast(`Predložak: ${n}`); };
    pl.appendChild(b);
  }
}
function open(id) { $(id).classList.remove('hidden'); }
function close() { document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); }

// ---------- export ----------
function stamp() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }

function saveFile(name, mime, { dataUrl, text }) {
  const b64 = dataUrl ? dataUrl.split(',')[1] : btoa(unescape(encodeURIComponent(text)));
  if (window.AndroidBridge && window.AndroidBridge.saveFile) {
    toast(window.AndroidBridge.saveFile(b64, name, mime) || 'Spremljeno');
    return;
  }
  const a = document.createElement('a');
  a.href = dataUrl || URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click();
  toast('Preuzeto: ' + name);
}

function doExport(kind) {
  close();
  try {
    if (kind === 'sheet') saveFile(`character_sheet_${stamp()}.png`, 'image/png', { dataUrl: viewer.snapshot(true) });
    if (kind === 'view') saveFile(`body_${stamp()}.png`, 'image/png', { dataUrl: viewer.snapshot(false) });
    if (kind === 'obj') saveFile(`body_${stamp()}.obj`, 'text/plain', { text: body.toOBJ() });
    if (kind === 'json') saveFile(`body_${stamp()}.json`, 'application/json', { text: JSON.stringify({ app: 'BodyCreator', values: state.values }, null, 1) });
  } catch (e) {
    toast('Greška: ' + e.message);
  }
}

// ---------- start ----------
(async () => {
  try {
    body = await loadBody();
  } catch (e) {
    $('#loading').textContent = 'Greška pri učitavanju modela: ' + e.message;
    return;
  }
  $('#loading').remove();
  viewer = new Viewer($('#viewer'), body);
  state.values = { ...body.defaults(), ...(saved.values || {}) };
  buildUI();
  syncAll();
  body.apply(state.values);
  viewer.update();
  viewer.view('front');
  viewer.setSkin(state.skin);
  viewer.setGuides(state.guides);
  schedule();
  setMode(state.mode);

  document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => viewer.view(b.dataset.view));
  $('#skin').value = state.skin;
  $('#skin').oninput = e => { state.skin = e.target.value; viewer.setSkin(state.skin); persist(); };
  $('#guides').checked = state.guides;
  $('#guides').onchange = e => { state.guides = e.target.checked; viewer.setGuides(state.guides); persist(); };
  $('#btnReset').onclick = () => { setValues({}); toast('Vraćeno na bazni model'); };
  $('#btnChars').onclick = () => { renderChars(); open('#charsModal'); };
  $('#btnExport').onclick = () => open('#exportModal');
  $('#btnSaveChar').onclick = () => {
    const n = $('#charName').value.trim();
    if (!n) { toast('Upiši ime lika'); return; }
    state.chars[n] = { ...state.values }; persist(); renderChars();
    $('#charName').value = '';
    toast(`Spremljeno: ${n}`);
  };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = close);
  document.querySelectorAll('.modal').forEach(m => m.onclick = e => { if (e.target === m) close(); });
  document.querySelectorAll('[data-export]').forEach(b => b.onclick = () => doExport(b.dataset.export));
  $('#importFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      setValues(j.values || j); close(); toast('Postavke učitane');
    } catch { toast('Neispravan fajl'); }
    e.target.value = '';
  };
})();
