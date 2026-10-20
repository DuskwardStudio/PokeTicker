'use strict';
// ===== PokéTicker core: helpers, storage, price data loading =====
// Prices come from the daily data file built by the price engine (see engine/update.py and .github/workflows/prices.yml).
const DATA_BASE = 'https://raw.githubusercontent.com/DuskwardStudio/PokeTicker/data/';
const $ = id => document.getElementById(id);
const DAY = 864e5;
const pad2 = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const usd = n => (n == null || isNaN(n)) ? '—' : '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pm = n => `<span class="money">${usd(n)}</span>`;               // personal amounts: can be hidden with the eye button
const pct = n => n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 14) : Math.random().toString(36).slice(2, 10) + Date.now().toString(36));
const median = arr => { const s = [...arr].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const normNum = x => String(x ?? '').split('/')[0].replace(/^#/, '').trim().toLowerCase().replace(/^([a-z]*)0+(?=\d)/, '$1');
const chgCell = v => `<span class="${v > 0.05 ? 'up' : v < -0.05 ? 'down' : 'flat'}">${pct(v)}</span>`;
const csvCell = x => { const s = String(x ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const fmtDay = iso => { try { return new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch (e) { return iso || ''; } };

function setStatus(msg, err) { const el = $('status'); el.textContent = msg || ''; el.className = 'status' + (msg ? ' show' : '') + (err ? ' err' : ''); }
function toast(msg) {
  let box = $('toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.className = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.appendChild(t); setTimeout(() => t.remove(), 7000);
}
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
async function getJson(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 60000);
      const r = await fetch(url, { signal: ctl.signal, cache: 'no-cache' }); clearTimeout(t);
      if (r.ok) return await r.json();
      last = new Error('HTTP ' + r.status);
    } catch (e) { last = e; }
    await new Promise(r => setTimeout(r, 1200 * (i + 1)));
  }
  throw last;
}

// ---- storage: IndexedDB with an in-memory copy. The database keeps its original name so data from earlier versions carries over. ----
let MEM = {}, DB = null;
async function openStore() {
  const r = await new Promise(resolve => {
    const mem = {}, fallback = () => resolve({ mem, db: null });
    setTimeout(fallback, 4000);                         // never let a stuck database block the app from starting
    try {
      const req = indexedDB.open('poketrends', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onerror = fallback;
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction('kv'), cur = tx.objectStore('kv').openCursor();
          cur.onsuccess = () => { const c = cur.result; if (c) { mem[c.key] = c.value; c.continue(); } };
          tx.oncomplete = () => resolve({ mem, db }); tx.onerror = fallback;
        } catch (e) { fallback(); }
      };
    } catch (e) { fallback(); }
  });
  MEM = r.mem; DB = r.db;
  if (!Object.keys(MEM).some(k => k.startsWith('pt_'))) {   // first run on this storage: bring over anything an older version kept in localStorage
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('pt_')) { try { MEM[k] = JSON.parse(localStorage.getItem(k)); } catch (e) { /* skip */ } } } } catch (e) { /* none */ }
    if (DB) for (const [k, v] of Object.entries(MEM)) { try { DB.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) { /* ignore */ } }
  }
}
const store = {
  get(k, d) { return k in MEM ? MEM[k] : d; },
  set(k, v) {
    MEM[k] = v;
    if (!DB) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { setTimeout(() => setStatus('Couldn’t save to browser storage — your changes may be lost when you close the app.', true)); } return; }
    try { const tx = DB.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.onerror = () => setStatus('Couldn’t save data — your phone’s storage may be full.', true); }
    catch (e) { console.warn('storage', e); }
  },
  del(k) { delete MEM[k]; try { if (DB) DB.transaction('kv', 'readwrite').objectStore('kv').delete(k); else localStorage.removeItem(k); } catch (e) { /* ignore */ } }
};

// ---- app state (created after the database is open) ----
let state, port, comps, wl, preds, prefs;
function initState() {
  state = { cards: {}, sets: [], eng: null, hist: {}, histFail: {}, histBusy: {}, tab: 'home', sel: null, range: '90', open: {}, rows: null, idx: null,
    scr: { q: '', era: '', rar: '', kind: '', sort: 'price', dir: -1, limit: 100 }, deal: { min: 5, rar: '', kind: '', sig: '', limit: 60 },
    pop: store.get('pt_pop', {}), owned: store.get('pt_owned', {}) };
  port = { lots: store.get('pt_lots', []), sales: store.get('pt_sales', []), exp: store.get('pt_expenses', []), hist: store.get('pt_porthist', []), msg: '', edit: null, form: { cardId: null }, showSales: false, shopTab: 'stock', month: '' };
  port.lots.forEach(l => { if (!l.status) l.status = 'hold'; });
  comps = { list: store.get('pt_comps', []), form: { cardId: null, name: '', set: '', num: '', grade: 'Raw' }, fee: store.get('pt_fee', 13.25), shipOut: store.get('pt_shipout', 4), msg: '', bulk: '' };
  wl = { list: store.get('pt_watch', []), t: store.get('pt_targets', {}) };
  preds = { list: store.get('pt_preds', []) };
  prefs = Object.assign({ mask: false, lockMin: 5 }, store.get('pt_prefs', {}));
}
const savePort = () => { store.set('pt_lots', port.lots); store.set('pt_sales', port.sales); store.set('pt_expenses', port.exp); store.set('pt_porthist', port.hist); };
const saveComps = () => { store.set('pt_comps', comps.list); store.set('pt_fee', comps.fee); store.set('pt_shipout', comps.shipOut); };
const saveWl = () => { store.set('pt_watch', wl.list); store.set('pt_targets', wl.t); };
const savePrefs = () => store.set('pt_prefs', prefs);

// ---- price data ----
const imgOf = (pid, big) => `https://tcgplayer-cdn.tcgplayer.com/product/${pid}_${big ? 400 : 200}w.jpg`;
function validateLatest(L) {
  if (!L || L.v !== 2 || !Array.isArray(L.sets) || !Array.isArray(L.f) || !Array.isArray(L.i)) throw new Error('unexpected data format');
  for (const k of ['id', 's', 'n', 'p']) if (!L.f.includes(k)) throw new Error('data is missing “' + k + '”');
  if (L.i.length < 1000) throw new Error('data looks incomplete');
  const ip = L.f.indexOf('p'); let bad = 0, n = 0;
  for (let i = 0; i < L.i.length; i += 37) { n++; if (!(L.i[i][ip] > 0)) bad++; }
  if (bad > n * 0.05) throw new Error('data has too many missing prices');
}
function applyLatest(L) {
  const F = {}; L.f.forEach((k, i) => { F[k] = i; });
  const sets = L.sets.map((s, i) => ({ idx: i, id: s.id, gid: String(s.id).replace(/^g/, ''), name: s.n, abbr: s.a, date: s.d, series: s.e, count: s.c }));
  const cards = {}; let maxNp = 0;
  for (const r of L.i) {
    const id = String(r[F.id]), st = sets[r[F.s]]; if (!st) continue;
    const pid = id.split('-')[0];
    cards[id] = { n: String(r[F.n]), sub: r[F.sub] || '', s: st.name, sid: st.id, ab: st.abbr || '', ser: st.series, r: r[F.r] || '', num: r[F.num] || '', k: r[F.k] ? 1 : 0, p: r[F.p],
      pr: { l: r[F.l], m: r[F.m], h: r[F.h] }, pf: { d1: r[F.d1], d7: r[F.d7], d30: r[F.d30], vol: r[F.vol], np: r[F.np] || 0 },
      rel: st.date, pid, img: imgOf(pid), url: 'https://www.tcgplayer.com/product/' + pid };
    if (cards[id].pf.np > maxNp) maxNp = cards[id].pf.np;
  }
  state.cards = cards; state.sets = sets; state.eng = { date: L.date, updated: L.updated, days: maxNp };
  state.rows = null; state.idx = null; state.byPid = null;
}
async function loadEngine(manual) {
  const btn = $('refresh'); btn.disabled = true;
  try {
    if (!manual) setStatus(state.eng ? '' : 'Loading prices…');
    const meta = await getJson(DATA_BASE + 'meta.json');
    if (state.eng && state.eng.updated === meta.updated) { setStatus(''); if (manual) toast('Already up to date — prices from ' + fmtDay(state.eng.date) + '.'); return; }
    setStatus('Downloading prices…');
    const L = await getJson(DATA_BASE + 'latest.json'); validateLatest(L);
    store.set('pt_latest', L); applyLatest(L); migrateLegacy(); setStatus('');
    state.hist = {}; state.histFail = {}; state.histBusy = {};
    if (manual) toast('Prices updated — ' + fmtDay(L.date) + '.');
  } catch (e) {
    setStatus('Couldn’t get new prices (' + e.message + ').' + (state.eng ? ' Showing the last saved prices.' : ' Check your connection and tap Refresh.'), true);
  } finally { btn.disabled = false; render(); if (state.sel) renderDrawer(); }
}
async function ensureHist(gid) {
  if (state.hist[gid] || state.histFail[gid] || state.histBusy[gid]) return;
  state.histBusy[gid] = true;
  try {
    const h = await getJson(DATA_BASE + 'hist/' + gid + '.json', 2);
    if (!h || !Array.isArray(h.d) || typeof h.s !== 'object') throw new Error('bad history');
    state.hist[gid] = h;
  } catch (e) { state.histFail[gid] = true; }
  state.histBusy[gid] = false;
  if (state.sel) renderDrawer();
}
function histSeries(id) {
  const c = state.cards[id]; if (!c) return [];
  const h = state.hist[c.sid.replace(/^g/, '')]; if (!h || !h.s[id]) return [];
  const out = []; h.d.forEach((d, i) => { const v = h.s[id][i]; if (v != null) out.push({ t: new Date(d + 'T12:00:00').getTime(), v }); });
  return out;
}

// ---- finding a tracked card from a name / number / set (imports, restored backups, the move from the older price source) ----
const normName = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normSet = s => normName(String(s || '').replace(/^[A-Za-z0-9]{1,6}(?:\s*:|\s+-)\s*/, '').replace(/\s*base set$/i, ''));
function cardIndex() {       // name|number|set -> every variant (printing) of that card
  if (state.idx) return state.idx;
  const idx = {};
  for (const [id, c] of Object.entries(state.cards)) {
    if (c.k) continue;
    (idx[normName(c.n) + '|' + normNum(c.num) + '|' + normSet(c.s)] ||= []).push(id);
  }
  return (state.idx = idx);
}
// Find a tracked card from a name / number / set (and optionally the printing, e.g. "Reverse Holofoil"). Without a printing, the priciest variant wins.
function findCard(name, num, set, variant) {
  const idx = cardIndex(), n = normNum(num), s = normSet(set);
  const list = idx[normName(name) + '|' + n + '|' + s] || idx[normName(String(name || '').replace(/\s*\([^)]*\)/g, '')) + '|' + n + '|' + s];
  if (!list) return null;
  const want = normName(variant);
  const score = id => {
    if (!want) return 0;
    const sub = normName(state.cards[id].sub);
    if (sub === want) return 3;
    if (sub && (sub.includes(want) || want.includes(sub))) return 2;
    if (want === 'normal' && (!sub || sub.includes('normal'))) return 2;
    return 0;
  };
  return list.slice().sort((x, y) => (score(y) - score(x)) || (state.cards[y].p - state.cards[x].p))[0];
}
function relinkByFields() {   // after a restore/import: point saved items at the current price list where they can be matched
  if (!Object.keys(state.cards).length) return 0;
  let n = 0;
  const fix = x => {
    if (x.cardId && state.cards[x.cardId]) return;
    const m = (x.set && x.num) ? findCard(x.name, x.num, x.set) : null;
    if (m) { x.cardId = m; x.relink = false; n++; } else if (x.cardId) { x.cardId = null; x.relink = true; }
  };
  port.lots.forEach(fix); comps.list.forEach(fix); wl.list = wl.list.filter(id => state.cards[id]);
  return n;
}
function siblings(id) {      // other printings/variants of the same TCGplayer product (holofoil, reverse holofoil, ...)
  const c = state.cards[id]; if (!c) return [];
  if (!state.byPid) { state.byPid = {}; for (const [k, x] of Object.entries(state.cards)) (state.byPid[x.pid] ||= []).push(k); }
  return state.byPid[c.pid] || [id];
}

// ---- one-time move from the older price source: re-link saved cards to the new ids ----
function migrateLegacy() {
  if (store.get('pt_idmig', 0) >= 2) return;
  const old = store.get('pt_cards', null);
  const hasLinks = port.lots.some(l => l.cardId) || comps.list.some(c => c.cardId) || wl.list.length || Object.keys(state.pop).length;
  if (old && hasLinks) {
    const map = oldId => { const o = old[oldId]; return o ? findCard(o.n, o.num, o.s) : null; };     // the old source used the priciest variant, and so does findCard
    let lost = 0;
    port.lots.forEach(l => { if (l.cardId && !state.cards[l.cardId]) { const n = map(l.cardId); if (!n) lost++; l.cardId = n; l.relink = !n; } });
    comps.list.forEach(c => { if (c.cardId && !state.cards[c.cardId]) c.cardId = map(c.cardId); });
    wl.list = wl.list.map(id => state.cards[id] ? id : map(id)).filter(Boolean);
    const pop = {}; for (const [id, v] of Object.entries(state.pop)) { const n = state.cards[id] ? id : map(id); if (n) pop[n] = v; } state.pop = pop;
    savePort(); saveComps(); saveWl(); store.set('pt_pop', state.pop);
    if (lost) setTimeout(() => toast(lost + ' saved card' + (lost === 1 ? '' : 's') + ' couldn’t be matched to the new price list — they keep their saved value.'), 800);
  }
  ['pt_cards', 'pt_snaps', 'pt_sets', 'pt_allsets', 'pt_extra', 'pt_fulldate', 'pt_updated', 'pt_live', 'pt_livesrc', 'pt_feed', 'pt_lastpoll', 'pt_liveon', 'pt_interval', 'pt_notify', 'pt_alert', 'pt_fx', 'pt_nsets', 'pt_preds', 'pt_min'].forEach(k => store.del(k));
  preds.list = []; store.set('pt_idmig', 2);
}
