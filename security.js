'use strict';
// ===== PokéTicker security: app lock (PIN), encrypted backups, safety copies, validation of restored data =====
const enc = new TextEncoder(), dec = new TextDecoder();
function b64(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const rand = n => crypto.getRandomValues(new Uint8Array(n));
async function pbkdf2Bits(secret, salt, iters, bits) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, key, bits);
}
async function aesKey(pass, salt, iters) {
  const bits = await pbkdf2Bits(pass, salt, iters, 256);
  return crypto.subtle.importKey('raw', bits, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const sameBytes = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };

// ---------- PIN lock ----------
// This is a screen lock for the app. It keeps casual snoopers out; it does not encrypt what is stored in the browser,
// so keep your phone's own screen lock on too, and use a password-protected backup for files you send anywhere.
const lockOn = () => !!store.get('pt_lock', null);
async function setPin(pin) {
  const salt = rand(16), iters = 210000, hash = await pbkdf2Bits(pin, salt, iters, 256);
  store.set('pt_lock', { salt: b64(salt), hash: b64(hash), iters }); store.set('pt_lockfail', { n: 0, until: 0 });
}
async function checkPin(pin) {
  const L = store.get('pt_lock', null); if (!L) return true;
  const f = store.get('pt_lockfail', { n: 0, until: 0 });
  if (Date.now() < f.until) throw new Error('Too many tries. Wait ' + Math.ceil((f.until - Date.now()) / 1000) + ' seconds.');
  const ok = sameBytes(new Uint8Array(await pbkdf2Bits(pin, unb64(L.salt), L.iters, 256)), unb64(L.hash));
  if (ok) store.set('pt_lockfail', { n: 0, until: 0 });
  else { const n = f.n + 1; store.set('pt_lockfail', { n, until: n >= 5 ? Date.now() + Math.min(600, 15 * 2 ** (n - 5)) * 1000 : 0 }); }
  return ok;
}
function showLock() {
  if (!lockOn()) return;
  const el = $('lockscreen'); el.hidden = false;
  el.innerHTML = `<div style="font-size:42px">🔒</div><h2 style="font-size:20px;margin:0">PokéTicker is locked</h2>
    <input type="password" id="pinin" inputmode="numeric" autocomplete="off" maxlength="12" aria-label="PIN" placeholder="PIN">
    <div id="pinmsg" class="sub2" style="min-height:18px"></div><button class="primary" id="pinok">Unlock</button>
    <details class="sub2" style="max-width:320px"><summary>Forgot your PIN?</summary>The PIN can’t be recovered. To start over, clear this site’s data in your browser settings — your cards will be erased, so restore from a backup file afterwards.</details>`;
  const go = async () => {
    const pin = $('pinin').value; $('pinmsg').textContent = '';
    try { if (await checkPin(pin)) { el.hidden = true; el.innerHTML = ''; } else { $('pinmsg').textContent = 'Wrong PIN.'; $('pinin').value = ''; } }
    catch (e) { $('pinmsg').textContent = e.message; }
  };
  $('pinok').onclick = go; $('pinin').onkeydown = e => { if (e.key === 'Enter') go(); }; setTimeout(() => $('pinin').focus(), 50);
}
let hiddenAt = 0;
function watchLock() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (lockOn() && hiddenAt && Date.now() - hiddenAt > (prefs.lockMin || 0) * 60000) showLock();
  });
  $('lockbtn').onclick = showLock;
  $('lockbtn').hidden = !lockOn();
}

// ---------- backups ----------
function makeBackup() {
  return { app: 'poketicker', v: 2, at: new Date().toISOString(), lots: port.lots, sales: port.sales, expenses: port.exp, hist: port.hist, comps: comps.list, fee: comps.fee, shipOut: comps.shipOut,
    pop: state.pop, watch: wl.list, targets: wl.t, owned: state.owned, prefs: { mask: prefs.mask, lockMin: prefs.lockMin } };
}
const hasUserData = () => port.lots.length || port.sales.length || port.exp.length || comps.list.length || wl.list.length;
async function encryptBackup(obj, pass) {
  const salt = rand(16), iv = rand(12), iters = 250000, key = await aesKey(pass, salt, iters);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { app: 'poketicker', enc: 1, iters, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
async function decryptBackup(env, pass) {
  try {
    const key = await aesKey(pass, unb64(env.salt), env.iters);
    return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, key, unb64(env.ct))));
  } catch (e) { throw new Error('Wrong password, or the file is damaged.'); }
}
async function backupFile(password) {
  const data = makeBackup(), body = password ? await encryptBackup(data, password) : data;
  return new File([JSON.stringify(body)], `poketicker-backup-${today()}${password ? '-protected' : ''}.json`, { type: 'application/json' });
}
async function saveBackup(password, share) {
  const file = await backupFile(password);
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'PokéTicker backup' }); }
  else { download(file.name, await file.text(), 'application/json'); }
  store.set('pt_lastbackup', Date.now());
}
// restored files are untrusted: keep only known fields with the right types
const num = x => (typeof x === 'number' && isFinite(x)) ? x : null;
const str = (x, n = 200) => typeof x === 'string' ? x.slice(0, n) : '';
const arr = x => Array.isArray(x) ? x.slice(0, 50000) : [];
function cleanBackup(j) {
  return {
    lots: arr(j.lots).map(l => ({ uid: str(l.uid, 30) || uid(), cardId: l.cardId ? str(l.cardId, 40) : null, name: str(l.name), set: str(l.set), num: str(l.num, 30), grade: str(l.grade, 40), qty: num(l.qty) ?? 1, cost: num(l.cost), val: num(l.val), pin: !!l.pin,
      date: str(l.date, 10), src: str(l.src, 30) || 'Manual', kind: ['card', 'sealed', 'other'].includes(l.kind) ? l.kind : 'card', status: l.status === 'sale' ? 'sale' : 'hold', ask: num(l.ask), relink: !!l.relink })),
    sales: arr(j.sales).map(s => ({ uid: str(s.uid, 30) || uid(), name: str(s.name), qty: num(s.qty) ?? 1, cost: num(s.cost), price: num(s.price) ?? 0, date: str(s.date, 10), src: str(s.src, 30), channel: str(s.channel, 40), fee: num(s.fee) ?? 0, ship: num(s.ship) ?? 0 })),
    expenses: arr(j.expenses).map(e => ({ uid: str(e.uid, 30) || uid(), date: str(e.date, 10), cat: str(e.cat, 40), amount: num(e.amount) ?? 0, note: str(e.note, 200) })),
    hist: arr(j.hist).map(h => ({ d: str(h.d, 10), value: num(h.value) ?? 0, invested: num(h.invested) ?? 0 })),
    comps: arr(j.comps).map(c => ({ uid: str(c.uid, 30) || uid(), cardId: c.cardId ? str(c.cardId, 40) : null, name: str(c.name), set: str(c.set), num: str(c.num, 30), grade: str(c.grade, 20), price: num(c.price) ?? 0, date: str(c.date, 10), source: str(c.source, 30), url: /^https?:\/\//.test(c.url || '') ? str(c.url, 500) : '', note: str(c.note, 200) })),
    fee: num(j.fee) ?? 13.25, shipOut: num(j.shipOut) ?? 4,
    pop: (j.pop && typeof j.pop === 'object') ? Object.fromEntries(Object.entries(j.pop).slice(0, 5000).map(([k, v]) => [str(k, 40), arr(v).map(p => ({ d: str(p.d, 10), grader: str(p.grader, 10), g10: num(p.g10) ?? 0, g9: num(p.g9) ?? 0, g8: num(p.g8) ?? 0, total: num(p.total) ?? 0 }))])) : {},
    watch: arr(j.watch).map(x => str(x, 40)).filter(Boolean),
    targets: (j.targets && typeof j.targets === 'object') ? Object.fromEntries(Object.entries(j.targets).slice(0, 5000).filter(([, v]) => num(v) != null).map(([k, v]) => [str(k, 40), v])) : {},
    owned: (j.owned && typeof j.owned === 'object') ? Object.fromEntries(Object.entries(j.owned).slice(0, 5000).map(([k, v]) => [str(k, 20), (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).slice(0, 5000).map(x => [str(x, 20), true])) : {}])) : {}
  };
}
function snapshotNow() {   // safety copy kept inside the app (last few), so a mistaken restore or delete can be undone
  if (!hasUserData()) return;
  const list = store.get('pt_autobak', []); list.unshift({ t: Date.now(), d: JSON.stringify(makeBackup()) }); store.set('pt_autobak', list.slice(0, 4));
}
function autoSnapshot() {
  const list = store.get('pt_autobak', []);
  if (hasUserData() && (!list.length || Date.now() - list[0].t > 20 * 36e5)) snapshotNow();
}
function applyBackup(j) {
  snapshotNow();
  const c = cleanBackup(j);
  port.lots = c.lots; port.sales = c.sales; port.exp = c.expenses; port.hist = c.hist; comps.list = c.comps; comps.fee = c.fee; comps.shipOut = c.shipOut;
  state.pop = c.pop; wl.list = c.watch; wl.t = c.targets; state.owned = c.owned;
  if (j.prefs) { prefs.mask = !!j.prefs.mask; prefs.lockMin = num(j.prefs.lockMin) ?? 5; savePrefs(); }
  savePort(); saveComps(); saveWl(); store.set('pt_pop', state.pop); store.set('pt_owned', state.owned);
}
async function restoreFromText(text, password) {
  let j; try { j = JSON.parse(text); } catch (e) { throw new Error('That file isn’t a PokéTicker backup.'); }
  if (!j || j.app !== 'poketicker') {
    if (j && j.app === 'poketrends') j.app = 'poketicker'; else throw new Error('That file isn’t a PokéTicker backup.');
  }
  if (j.enc) { if (!password) { const e = new Error('password'); e.needPassword = true; throw e; } j = await decryptBackup(j, password); }
  applyBackup(j);
}
