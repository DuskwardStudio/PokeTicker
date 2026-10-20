'use strict';
// ===== PokéTicker start-up and global events =====
let lastEngineCheck = 0;
async function boot() {
  await openStore();
  initState();
  const cached = store.get('pt_latest', null);
  if (cached) { try { validateLatest(cached); applyLatest(cached); migrateLegacy(); relinkByFields(); } catch (e) { store.del('pt_latest'); } }
  watchLock(); if (lockOn()) showLock();

  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { state.tab = b.dataset.tab; closeCard(); render(); window.scrollTo(0, 0); });
  $('refresh').onclick = () => { lastEngineCheck = Date.now(); loadEngine(true); };
  $('mask').onclick = () => { prefs.mask = !prefs.mask; savePrefs(); render(); };
  $('scrim').onclick = closeCard;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.sel) closeCard(); });
  document.addEventListener('click', e => {
    const star = e.target.closest('.star');
    if (star) { e.preventDefault(); e.stopPropagation(); toggleWatch(star.dataset.id); return; }
    const go = e.target.closest('[data-go]'); if (go) { e.preventDefault(); state.tab = go.dataset.go; closeCard(); render(); window.scrollTo(0, 0); return; }
    const tg = e.target.closest('[data-toggle]');
    if (tg && $('view').contains(tg)) { const k = tg.dataset.toggle, cur = k in state.open ? state.open[k] : (k.startsWith('era:') && tg.textContent.includes('▾')); state.open[k] = !cur; render(); return; }
    const op = e.target.closest('[data-open]'); if (op && !e.target.closest('input, select, textarea, button')) { e.preventDefault(); openCard(op.dataset.open); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastEngineCheck > 3 * 36e5) { lastEngineCheck = Date.now(); loadEngine(false); } });

  // shared from another app (Android share menu): prefill the sold-price box
  const q = new URLSearchParams(location.search);
  if (q.has('text') || q.has('url') || q.has('title')) {
    comps.bulk = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join('\n').slice(0, 5000); state.tab = 'comps';
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
    setTimeout(() => toast('Shared. Pick the item, then tap “Add pasted sales”.'), 600);
  }
  render(); autoSnapshot();
  lastEngineCheck = Date.now(); loadEngine(false);

  if (location.protocol.startsWith('http')) {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* optional */ }
  }
  window.__pt = { get state() { return state; }, get port() { return port; }, get comps() { return comps; }, get wl() { return wl; }, get preds() { return preds; }, store, render, renderDrawer, loadEngine, applyLatest, importCsv, outlook, scoreIdea, fairValue, portSummary, shopReport, parseCompText, searchCards, cleanBackup, makeBackup, encryptBackup, decryptBackup, setPin, checkPin };   // debug handle
}
boot().catch(err => { console.error(err); const s = document.getElementById('status'); if (s) { s.textContent = 'PokéTicker hit a problem starting up: ' + err.message; s.className = 'status show err'; } });
