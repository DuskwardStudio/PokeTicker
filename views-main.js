'use strict';
// ===== Main screens: router, Home, Check, My Cards, Ideas, card page =====
const SUBPAGES = ['comps', 'shop', 'watch', 'market', 'sets', 'settings'];
function metaText() {
  if (!state.eng) return 'No prices yet';
  const age = Math.floor((Date.now() - new Date(state.eng.date + 'T12:00:00').getTime()) / DAY);
  return `Prices from ${fmtDay(state.eng.date)}${age >= 3 ? ' (old — tap Refresh)' : ''} · ${getRows().length.toLocaleString()} items`;
}
function render() {
  if (!state) return;
  const v = $('view'), tab = state.tab;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === (SUBPAGES.includes(tab) ? 'more' : tab)));
  document.body.classList.toggle('masked', !!prefs.mask);
  $('meta').textContent = metaText();
  if (state.eng) logPredictions();
  const R = { home: renderHome, check: renderCheck, port: renderPortfolio, deals: renderIdeas, more: renderMore, comps: renderComps, shop: renderShop, watch: renderWatch, market: renderMarket, sets: renderSets, settings: renderSettings };
  (R[tab] || renderHome)(v);
}
const back = (label) => `<a class="back" data-go="more" href="#">← ${label || 'More'}</a>`;
function needPrices(v) {
  if (state.eng) return false;
  v.innerHTML = '<div class="empty">Loading today’s prices… If this stays blank, check your connection and tap <b>Refresh</b>.</div>'; return true;
}
const starHtml = id => `<span class="star${wl.list.includes(id) ? ' on' : ''}" role="button" aria-label="Watch" data-id="${esc(id)}">${wl.list.includes(id) ? '★' : '☆'}</span>`;
function rowHtml(r, mode) {
  const pf = perfOf(r.id, r.price, r.c), c = r.c;
  const right = mode === 'chg' ? `<b>${chgCell(pf.d1)}</b><span class="flat">${usd(r.price)}</span>` : `<b>${usd(r.price)}</b><span>${chgCell(pf.d1)}</span>`;
  return `<div class="row" data-open="${esc(r.id)}"><img loading="lazy" src="${esc(c.img)}" alt=""><div class="info"><div class="name">${esc(cardTitle(c))}</div><div class="sub">${esc(c.s)}${c.num ? ' · #' + esc(c.num) : ''}${c.r ? ' · ' + esc(c.r) : ''}</div></div><div class="px">${right}</div>${starHtml(r.id)}</div>`;
}
function toggleWatch(id) {
  const i = wl.list.indexOf(id); if (i >= 0) { wl.list.splice(i, 1); delete wl.t[id]; } else wl.list.push(id);
  saveWl(); render(); if (state.sel) renderDrawer();
}

// ---------- Home ----------
function renderHome(v) {
  const s = portSummary(); recordPort(s);
  const sg = n => n == null ? 'flat' : n > 0 ? 'up' : n < 0 ? 'down' : 'flat', sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + usd(Math.abs(n));
  const hasCards = port.lots.length > 0, haveData = !!state.eng;
  const ideas = haveData ? getRows().filter(r => r.price >= 5 && !r.c.k).map(scoreIdea).filter(r => !r.spike && r.idea >= IDEA_MIN).sort((x, y) => y.idea - x.idea).slice(0, 3) : [];
  const todo = [];
  if (!haveData) todo.push('Prices are still loading. Tap <b>Refresh</b> if this stays blank.');
  if (hasUserData() && Date.now() - store.get('pt_lastbackup', 0) > 7 * DAY) todo.push('It’s been a while since your last backup. <a href="#" data-go="settings">Back up now</a> — your cards live only on this device.');
  for (const r of s.rows) {
    const c = r.l.cardId && state.cards[r.l.cardId];
    if (r.src === 'live' && c && r.v != null) { const pf = perfOf(r.l.cardId, r.v, c); if (pf.d7 != null && pf.d7 > 25) todo.push(`<b>${esc(r.l.name)}</b> is up ${pf.d7.toFixed(0)}% this week. If you want to cash in, now may be a good time.`); }
    if (r.plPct != null && r.plPct <= -20) todo.push(`<b>${esc(r.l.name)}</b> is ${(-r.plPct).toFixed(0)}% below what you paid. Check Sold Prices for its real market value before deciding.`);
    if (r.l.relink) todo.push(`<b>${esc(r.l.name)}</b> couldn’t be matched to the new price list. Edit it in <a href="#" data-go="port">My Cards</a> to re-pick the card.`);
  }
  for (const id of wl.list) {
    const c = state.cards[id]; if (!c) continue; const pf = perfOf(id, c.p, c), tg = wl.t[id];
    if (tg && c.p <= tg) todo.push(`🎯 <b>${esc(cardTitle(c))}</b> is at ${usd(c.p)} — at or under your target of ${usd(tg)}.`);
    else if (pf.d1 != null && Math.abs(pf.d1) >= 5) todo.push(`Watching <b>${esc(cardTitle(c))}</b>: ${pf.d1 > 0 ? 'up' : 'down'} ${Math.abs(pf.d1).toFixed(0)}% today.`);
  }
  if (s.noCost) todo.push(`${s.noCost} of your cards ${s.noCost === 1 ? 'has' : 'have'} no purchase price, so your profit can’t be worked out. Add them in <a href="#" data-go="port">My Cards</a>.`);
  const tr = trackRecord();
  const trText = tr.n30 >= 5 ? `Of ${tr.n30} past ideas that are 30+ days old, <b>${tr.hit30}</b> moved the way PokéTicker guessed (up or down), and the average miss was ${tr.medMiss != null ? tr.medMiss.toFixed(0) : '—'} percentage points. ${tr.n90 >= 5 ? `For 90 days: ${tr.hit90} of ${tr.n90}.` : ''}`
    : 'PokéTicker saves each day’s top ideas and grades them after 30 days. Check back here to see how good the guesses are before you trust them.';
  v.innerHTML = `${hasCards ? `<div class="grid" style="margin-bottom:14px">
      <div class="tile"><div class="lbl">Your cards are worth</div><div class="big money">${usd(s.value)}</div><div class="lbl">${port.lots.length} item${port.lots.length === 1 ? '' : 's'}</div></div>
      <div class="tile"><div class="lbl">You’re ${s.unreal >= 0 ? 'up' : 'down'}</div><div class="big money ${sg(s.unreal)}">${sgn(s.unreal)}</div><div class="lbl ${sg(s.unrealPct)}">${pct(s.unrealPct)} on ${pm(s.invested)} spent</div></div>
      <div class="tile"><div class="lbl">Since yesterday</div><div class="big money ${sg(s.day)}">${s.dayPct == null ? '—' : sgn(s.day)}</div><div class="lbl ${sg(s.dayPct)}">${s.dayPct == null ? 'fills in tomorrow' : pct(s.dayPct)}</div></div></div>`
    : `<div class="todo"><b>Start here:</b> add the cards you own in <a href="#" data-go="port">My Cards</a> (or import your Collectr file there). Then Home shows what you’re worth and whether you’re up or down.</div>`}
    <h2>Today’s buy ideas</h2><p class="intro">Cards that look cheap compared with where they’ve been, with a rough 90-day outlook. These are ideas to research, not promises.</p>
    ${ideas.length ? ideas.map(r => { const w = outlookWord(r.ol[90].pct); return `<div class="idea" data-open="${esc(r.id)}"><img src="${esc(r.c.img)}" alt=""><div class="info"><b>${esc(cardTitle(r.c))}</b> <span class="flat">${esc(r.c.s)}</span><div>${usd(r.price)} now · <b class="${w[1]}">${w[0]}</b> over 90 days (${pct(r.ol[90].pct)}, typical range ${usd(r.ol[90].lo)}–${usd(r.ol[90].hi)})</div><div class="sub2" style="margin:2px 0 0">${esc(r.why[0] || r.ol.why[0] || '')}</div></div></div>`; }).join('') + `<p><a href="#" data-go="deals" style="color:var(--accent)">See all buy ideas →</a></p>` : `<div class="empty">${haveData ? 'No standout ideas yet. PokéTicker learns a card’s normal price swings from daily history, so ideas sharpen over the next few weeks.' : 'Waiting for prices.'}</div>`}
    ${todo.length ? `<h2 style="margin-top:18px">Needs your attention</h2>${todo.map(t => `<div class="todo">${t}</div>`).join('')}` : ''}
    <h2 style="margin-top:18px">How good are the guesses?</h2><p class="intro" style="max-width:none">${trText}</p>
    <details class="guide"${hasCards ? '' : ' open'}><summary>New here? How PokéTicker works</summary>
      <ol style="padding-left:20px;margin:10px 0 0;line-height:1.6"><li><b>Check</b> — at a card show or looking at a listing? Search the card and see what you can safely pay.</li>
        <li><b>My Cards</b> — add what you own and what you paid. PokéTicker shows if you’re up or down.</li>
        <li><b>Sold Prices</b> (More) — log what cards actually sold for. Your logged sales become the most trustworthy price.</li>
        <li><b>Ideas</b> — cards that look cheap, each with a rough 90-day outlook and the reasons behind it.</li></ol></details>`;
}

// ---------- Check (quick price check and "what can I pay?") ----------
function renderCheck(v) {
  if (needPrices(v)) return;
  const ck = state.chk || (state.chk = { q: '', id: null, basis: 'market', margin: store.get('pt_margin', 25), ask: '', shipIn: '' });
  v.innerHTML = `<p class="intro">Looking at a card at a show, or at a listing online? Search it, and PokéTicker shows its price, your own sold-price value, and the most you can pay and still make your margin.</p>
    <input type="search" class="big-search" id="cq" placeholder="Search a card or product (e.g. umbreon ex 161)" autocomplete="off" value="${esc(ck.q)}">
    <div class="searchres" id="cres"></div><div id="cpanel"></div>`;
  const res = $('cres'), draw = () => {
    const hits = searchCards(ck.q, { limit: 10 });
    res.innerHTML = ck.q.trim().length < 2 ? '' : (hits.map(r => `<div class="row" data-pick="${esc(r.id)}"><img loading="lazy" src="${esc(r.c.img)}" alt=""><div class="info"><div class="name">${esc(cardTitle(r.c))}</div><div class="sub">${esc(r.c.s)} · #${esc(r.c.num || '—')} · ${esc(r.c.r || (r.c.k ? 'Sealed' : ''))}</div></div><div class="px"><b>${usd(r.price)}</b></div></div>`).join('') || '<div class="empty">No match. Try fewer words, or the card number.</div>');
    res.querySelectorAll('[data-pick]').forEach(el => el.onclick = () => { ck.id = el.dataset.pick; ck.q = ''; $('cq').value = ''; res.innerHTML = ''; drawCheckPanel(); });
  };
  $('cq').oninput = e => { ck.q = e.target.value; draw(); };
  drawCheckPanel(); if (!ck.id) setTimeout(() => { try { $('cq').focus(); } catch (e) { /* ignore */ } }, 50);
}
function drawCheckPanel() {
  const ck = state.chk, box = $('cpanel'); if (!box) return;
  const c = ck.id && state.cards[ck.id]; if (!c) { box.innerHTML = ''; return; }
  const id = ck.id, pf = perfOf(id, c.p, c), fv = fairValue({ cardId: id, name: c.n, set: c.s, num: c.num }, 'Raw'), ol = outlook(id, c.p, c, pf), w = ol ? outlookWord(ol[90].pct) : null;
  const sibs = siblings(id).filter(x => state.cards[x] && state.cards[x].p > 0);
  box.innerHTML = `<div class="calc" style="margin-top:14px"><div class="dhead" style="gap:12px"><img src="${esc(imgOf(c.pid, true))}" alt="" style="width:92px">
      <div style="min-width:0"><b style="font-size:17px">${esc(c.n)}</b><div class="sub2">${esc(c.s)}${c.num ? ' · #' + esc(c.num) : ''}</div>${c.r ? `<span class="pill">${esc(c.r)}</span>` : ''}<span class="pill">${esc(c.ser)}</span>
      <div class="big2" style="font-size:28px;margin:6px 0 2px">${usd(c.p)}</div><div>${['d1', 'd7', 'd30'].map((k, i) => `<span class="pill">${['1D', '7D', '30D'][i]} ${chgCell(pf[k])}</span>`).join('')}</div></div></div>
    ${sibs.length > 1 ? `<div class="chips">${sibs.map(x => `<button data-var="${esc(x)}" class="${x === id ? 'active' : ''}">${esc(state.cards[x].sub || 'Standard')} ${usd(state.cards[x].p)}</button>`).join('')}</div>` : ''}
    <div class="sub2" style="margin-top:8px">${fv ? `Your sold-price value: <b>${usd(fv.fv)}</b> (${fv.conf} confidence, ${fv.used} sale${fv.used === 1 ? '' : 's'}${fv.stale ? ', no sale in 90 days' : ''})` : 'No sold prices logged for this card yet — log a few to get a value you can trust.'}
      ${w ? `<br>90-day outlook: <b class="${w[1]}">${w[0]}</b> (${pct(ol[90].pct)}, typical range ${usd(ol[90].lo)}–${usd(ol[90].hi)}) — a rough estimate.` : ''}</div></div>
    <div class="calc"><b>What can I pay?</b>
      <div class="popform" style="margin-top:8px"><label class="sub2">Resell at <select id="kb"><option value="market"${ck.basis === 'market' ? ' selected' : ''}>market price</option><option value="fair"${ck.basis === 'fair' ? ' selected' : ''}${fv ? '' : ' disabled'}>my sold-price value</option></select></label>
        <label class="sub2">Margin I want <input type="number" id="km" min="0" step="1" value="${ck.margin}">%</label>
        <label class="sub2">Fees <input type="number" id="kf" min="0" step="0.25" value="${comps.fee}">%</label>
        <label class="sub2">Shipping out $ <input type="number" id="ko" min="0" step="0.25" value="${comps.shipOut}"></label></div>
      <div class="popform"><label class="sub2">Seller asks $ <input type="number" id="ka" min="0" step="0.01" value="${esc(ck.ask)}" placeholder="optional"></label><label class="sub2">Shipping to me $ <input type="number" id="ks" min="0" step="0.01" value="${esc(ck.shipIn)}"></label></div>
      <div class="out" id="kout"></div></div>
    <div class="popform" style="margin-top:12px"><button data-act="detail">Full details</button><button data-act="comp">Log a sold price</button><button data-act="add">Add to My Cards</button><button data-act="watch">${wl.list.includes(id) ? '★ Watching' : '☆ Watch'}</button></div>`;
  const calc = () => {
    ck.basis = $('kb').value; ck.margin = parseFloat($('km').value) || 0; comps.fee = parseFloat($('kf').value) || 0; comps.shipOut = parseFloat($('ko').value) || 0; ck.ask = $('ka').value; ck.shipIn = $('ks').value;
    store.set('pt_margin', ck.margin); saveComps();
    const base = ck.basis === 'fair' && fv ? fv.fv : c.p, net = base * (1 - comps.fee / 100) - comps.shipOut, maxPay = net / (1 + ck.margin / 100);
    let html = `Resale value <b>${usd(base)}</b> → after ${comps.fee}% fees and ${usd(comps.shipOut)} shipping you keep <b>${usd(net)}</b>.<br>To make ${ck.margin}%, pay at most <b class="up" style="font-size:20px">${usd(Math.max(0, maxPay))}</b>.`;
    html += `<div class="sub2" style="margin-top:8px">Buying from a customer? Offers at 60% / 70% / 80% of market: <b>${usd(c.p * 0.6)}</b> / <b>${usd(c.p * 0.7)}</b> / <b>${usd(c.p * 0.8)}</b></div>`;
    const ask = parseFloat(ck.ask), sh = parseFloat(ck.shipIn) || 0;
    if (ask > 0) { const cost = ask + sh, profit = net - cost, roi = profit / cost * 100, ok = cost <= maxPay; html += `<div style="margin-top:8px"><b class="${ok ? 'up' : roi > 0 ? 'flat' : 'down'}">${ok ? 'Good price' : roi > 0 ? 'Under your margin' : 'Too expensive'}</b> — your cost ${usd(cost)} → profit ${profit >= 0 ? '+' : '−'}${usd(Math.abs(profit))} (${pct(roi)}).</div>`; }
    $('kout').innerHTML = html;
  };
  ['kb', 'km', 'kf', 'ko', 'ka', 'ks'].forEach(k => { $(k).oninput = calc; });
  box.querySelectorAll('[data-var]').forEach(b => b.onclick = () => { ck.id = b.dataset.var; drawCheckPanel(); });
  box.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if (a === 'detail') openCard(id);
    else if (a === 'watch') { toggleWatch(id); }
    else if (a === 'comp') { Object.assign(comps.form, { cardId: id, name: c.n, set: c.s, num: c.num, grade: 'Raw' }); state.tab = 'comps'; render(); window.scrollTo(0, 0); }
    else if (a === 'add') { port.form.cardId = id; port.form.prefill = true; state.tab = 'port'; render(); window.scrollTo(0, 0); }
  });
  calc();
}

// ---------- My Cards ----------
const FEE_PRESETS = { eBay: null, TCGplayer: 13, Whatnot: 11, 'In person / card show': 0, 'My website': 3, 'Facebook / Discord': 3, Other: null };
function histChart(h) {
  if (h.length < 2) return '<div class="sub2">The value-over-time chart appears after your second day of data — PokéTicker records your value each day you open it.</div>';
  const W = 640, H = 170, L = 58, R = 10, T = 10, B = 22, ts = h.map(x => new Date(x.d + 'T12:00:00').getTime());
  const t0 = ts[0], t1 = ts[ts.length - 1] || t0 + 1, vals = h.flatMap(x => [x.value, x.invested]).filter(x => x > 0);
  let lo = Math.min(...vals), hi = Math.max(...vals); const padv = (hi - lo) * 0.1 || hi * 0.1 || 1; lo = Math.max(0, lo - padv); hi += padv;
  const X = i => L + (ts[i] - t0) / ((t1 - t0) || 1) * (W - L - R), Y = x => T + (1 - (x - lo) / (hi - lo)) * (H - T - B);
  const path = k => h.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x[k]).toFixed(1)}`).join('');
  const up = h[h.length - 1].value >= h[h.length - 1].invested;
  return `<svg class="chart money" viewBox="0 0 ${W} ${H}">${[0, 0.5, 1].map(f => { const x = lo + (hi - lo) * f; return `<line x1="${L}" x2="${W - R}" y1="${Y(x)}" y2="${Y(x)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(x) + 3}" text-anchor="end">${usd(x)}</text>`; }).join('')}
    <text x="${L}" y="${H - 6}">${esc(h[0].d)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${esc(h[h.length - 1].d)}</text>
    <path d="${path('invested')}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <path d="${path('value')}" fill="none" stroke="${up ? 'var(--up)' : 'var(--down)'}" stroke-width="2.2"/></svg><div class="sub2">Solid: current value · Dashed: amount invested</div>`;
}
function renderPortfolio(v) {
  const s = portSummary(); recordPort(s);
  const sg = n => n == null ? 'flat' : n > 0 ? 'up' : n < 0 ? 'down' : 'flat', sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + usd(Math.abs(n));
  const sorted = [...s.rows].sort((x, y) => (y.valT ?? -1) - (x.valT ?? -1));
  const byEra = {}; s.rows.forEach(r => { if (r.valT != null) byEra[lotEra(r.l)] = (byEra[lotEra(r.l)] || 0) + r.valT; });
  const alloc = Object.entries(byEra).sort((x, y) => y[1] - x[1]);
  const topShare = sorted.length && s.value ? Math.max(0, ...sorted.map(r => (r.valT || 0))) / s.value * 100 : 0;
  const warns = [];
  if (topShare > 35 && sorted.length > 1) warns.push(`One position is ${topShare.toFixed(0)}% of your portfolio — consider how much risk that is.`);
  if (s.unpriced) warns.push(`${s.unpriced} item${s.unpriced === 1 ? ' has' : 's have'} no price (not matched to a tracked card, or no value entered) and ${s.unpriced === 1 ? 'is' : 'are'} left out of totals. Use ✎ to enter a value.`);
  if (s.noCost) warns.push(`${s.noCost} item${s.noCost === 1 ? ' has' : 's have'} no purchase price, so ${s.noCost === 1 ? 'it is' : 'they are'} left out of profit/loss.`);
  const tiles = `<div class="grid" style="margin-bottom:14px">
    <div class="tile"><div class="lbl">Current value</div><div class="big money">${usd(s.value)}</div><div class="lbl">${port.lots.length} item${port.lots.length === 1 ? '' : 's'}</div></div>
    <div class="tile"><div class="lbl">Total invested</div><div class="big money">${usd(s.invested)}</div><div class="lbl">items with a purchase price</div></div>
    <div class="tile"><div class="lbl">Profit / loss (unsold)</div><div class="big money ${sg(s.unreal)}">${sgn(s.unreal)}</div><div class="lbl ${sg(s.unrealPct)}">${pct(s.unrealPct)}</div></div>
    <div class="tile"><div class="lbl">Today</div><div class="big money ${sg(s.day)}">${sgn(s.day)}</div><div class="lbl ${sg(s.dayPct)}">${pct(s.dayPct)}</div></div>
    <div class="tile"><div class="lbl">Profit from sales</div><div class="big money ${sg(s.realized)}">${sgn(s.realized)}</div><div class="lbl">${port.sales.length} sale${port.sales.length === 1 ? '' : 's'}</div></div>
    <div class="tile"><div class="lbl">Total return</div><div class="big money ${sg(s.unreal + s.realized)}">${sgn(s.unreal + s.realized)}</div><div class="lbl">unsold + sold</div></div></div>`;
  const lotRows = sorted.map(r => {
    const l = r.l, c = l.cardId && state.cards[l.cardId], pf = c && r.src === 'live' && r.v != null ? perfOf(l.cardId, r.v, c) : null, chips = [];
    if (l.status === 'sale') chips.push(`<span class="pill up">For sale${l.ask ? ' · asking ' + usd(l.ask) : ''}</span>`);
    if (pf && pf.d7 != null && pf.d7 > 25) chips.push('<span class="pill up">▲ hot +' + pf.d7.toFixed(0) + '% 7D — consider taking profit?</span>');
    if (r.plPct != null && r.plPct <= -20) chips.push('<span class="pill down">underwater ' + pct(r.plPct) + '</span>');
    if (l.cost == null) chips.push('<span class="pill">no purchase price</span>');
    if (r.v == null) chips.push('<span class="pill">no price</span>');
    const held = l.date ? Math.max(0, Math.round((Date.now() - new Date(l.date + 'T12:00:00').getTime()) / DAY)) : null, ed = port.edit && port.edit.uid === l.uid ? port.edit : null;
    let form = '';
    if (ed && ed.mode === 'sell') form = sellFormHtml(l, r.v);
    if (ed && ed.mode === 'edit') form = `<tr><td colspan="9"><div class="popform">Edit: <input type="number" id="eq" min="0" step="1" value="${l.qty}" title="quantity"><input type="number" id="ec" min="0" step="0.01" value="${l.cost ?? ''}" placeholder="paid each"><input type="number" id="ev" min="0" step="0.01" value="${l.val ?? ''}" placeholder="value override (locks it)" style="width:190px"><input type="number" id="eask" min="0" step="0.01" value="${l.ask ?? ''}" placeholder="asking price"><input type="text" id="eg" value="${esc(l.grade || '')}" placeholder="grade / condition" style="width:140px"><button class="primary" data-p="editok" data-uid="${esc(l.uid)}">Save</button><button data-p="cancel">Cancel</button>${l.cardId ? '' : `<button data-p="relink" data-uid="${esc(l.uid)}">Re-pick the card…</button>`}</div></td></tr>`;
    return `<tr ${l.cardId ? `data-open="${esc(l.cardId)}" style="cursor:pointer"` : ''}><td><b>${esc(l.name)}</b>${l.grade ? ` <span class="pill">${esc(l.grade)}</span>` : ''}<div class="sub2" style="margin:0">${esc(l.set || '')} · ${esc(l.src)}${l.kind === 'sealed' ? ' · sealed' : ''}${held != null ? ` · held ${held}d` : ''}</div>${chips.join(' ')}</td>
      <td class="num">${l.qty}</td><td class="num">${l.cost != null ? pm(l.cost) : `<input type="number" class="costin" min="0" step="0.01" placeholder="paid ea." data-uid="${esc(l.uid)}" style="width:84px;padding:3px 6px">`}</td>
      <td class="num">${pm(r.v)}${r.src === 'comps' ? `<span class="up" title="fair value from your ${r.n} sold price${r.n === 1 ? '' : 's'}"> ◆${r.n}</span>` : r.src === 'manual' ? '<span class="flat" title="typed or imported value"> ✎</span>' : ''}</td><td class="num"><b>${pm(r.valT)}</b></td>
      <td class="num ${sg(r.pl)}">${r.pl != null ? `<span class="money">${sgn(r.pl)}</span>` : '—'}</td><td class="num ${sg(r.plPct)}">${pct(r.plPct)}</td>
      <td style="white-space:nowrap"><a href="#" data-p="edit" data-uid="${esc(l.uid)}">✎</a> <a href="#" data-p="sell" data-uid="${esc(l.uid)}">Sold</a> <a href="#" data-p="${l.status === 'sale' ? 'unlist' : 'list'}" data-uid="${esc(l.uid)}">${l.status === 'sale' ? 'Unlist' : 'List'}</a> <a href="#" data-p="del" data-uid="${esc(l.uid)}" style="color:var(--down)">✕</a></td></tr>${form}`;
  }).join('');
  v.innerHTML = '<p class="intro">Everything you own, what you paid, and whether you’re up or down. Add a card below, or import your Collectr file at the bottom. “List” moves an item into your shop stock.</p>' + tiles + (warns.length ? `<div class="sub2">${warns.map(w => '⚠ ' + esc(w)).join('<br>')}</div>` : '') +
    `<div class="cols"><div><h2>Portfolio value over time</h2>${histChart(port.hist)}</div>
      <div><h2>Where your money is</h2>${alloc.length ? alloc.map(([k, val]) => `<div style="margin:6px 0"><div style="display:flex;justify-content:space-between"><span>${esc(k)}</span><span class="flat">${pm(val)} · ${(val / s.value * 100).toFixed(0)}%</span></div><div class="bar"><div style="width:${(val / s.value * 100).toFixed(1)}%"></div></div></div>`).join('') : '<div class="empty">Add something you own to see this.</div>'}</div></div>
    <div class="dsec"><h2>Add to your cards</h2>
      <div class="popform"><select id="pkind"><option value="card">Card</option><option value="sealed">Sealed product</option><option value="other">Other</option></select>
        <input type="text" id="pq" placeholder="Search a card or product, or type any item name" style="flex:1;min-width:220px" autocomplete="off">
        <input type="number" id="pqty" min="1" step="1" value="1" title="Quantity" style="width:70px">
        <input type="number" id="pcost" min="0" step="0.01" placeholder="Paid each ($)">
        <input type="date" id="pdate" value="${today()}">
        <input type="text" id="pgrade" placeholder="Grade / condition" style="width:140px">
        <input type="number" id="pval" min="0" step="0.01" placeholder="Value each (only if not a tracked card)">
        <button class="primary" id="padd">Add</button></div>
      <div class="searchres" id="pres"></div><div class="sub2" id="plinked"></div></div>
    <div class="dsec"><h2>Your holdings</h2>${sorted.length ? `<table><tr><th>Item</th><th class="num">Qty</th><th class="num">Paid ea.</th><th class="num">Value ea.</th><th class="num">Value</th><th class="num">Profit / loss</th><th class="num">%</th><th></th></tr>${lotRows}</table>` : '<div class="empty">Nothing here yet. Add what you own above, or import a Collectr / Card Ladder CSV below.</div>'}
      ${port.msg ? `<p class="sub2">${esc(port.msg)}</p>` : ''}</div>
    <div class="dsec"><h2>Import from Collectr / Card Ladder</h2>
      <div class="drop" id="drop"><div style="margin-bottom:8px">Drop a CSV export here or choose a file (importing again replaces that source’s items; costs you typed in are kept)</div>
        <select id="csrc"><option>Collectr</option><option>Card Ladder</option><option>Other</option></select> <input type="file" id="cfile" accept=".csv,.tsv,.txt"></div>
      <p class="note">Backups, password protection and restoring are in <a href="#" data-go="settings" style="color:var(--accent)">More → Backup &amp; Security</a>.</p></div>`;
  wirePortfolio(v);
}
function sellFormHtml(l, price) {
  return `<tr><td colspan="9"><div class="popform"><b>Sold:</b> <input type="number" id="sq" min="0" step="1" value="${l.qty}" title="quantity"><input type="number" id="sp" min="0" step="0.01" value="${price != null ? price : ''}" placeholder="price each">
    <select id="sch">${CHANNELS.map(c => `<option>${esc(c)}</option>`).join('')}</select><label class="sub2" style="margin:0">Fee % <input type="number" id="sfee" min="0" step="0.05" value="${comps.fee}" style="width:76px"></label>
    <label class="sub2" style="margin:0">Shipping I paid $ <input type="number" id="ssh" min="0" step="0.01" value="0" style="width:76px"></label><input type="date" id="sd" value="${today()}">
    <button class="primary" data-p="sellok" data-uid="${esc(l.uid)}">Record sale</button><button data-p="cancel">Cancel</button></div></td></tr>`;
}
function wirePortfolio(v) {
  const refreshAll = () => { savePort(); recordPort(); render(); };
  v.querySelectorAll('[data-p]').forEach(el => el.onclick = e => {
    e.preventDefault(); e.stopPropagation();
    const act = el.dataset.p, id = el.dataset.uid, lot = port.lots.find(l => l.uid === id);
    if (act === 'edit' || act === 'sell') {
      port.edit = { uid: id, mode: act }; render();
      if (act === 'sell') { const ch = $('sch'), fee = $('sfee'); if (ch) ch.onchange = () => { const p = FEE_PRESETS[ch.value]; fee.value = p == null ? comps.fee : p; }; }
    } else if (act === 'cancel') { port.edit = null; render(); }
    else if (act === 'list' && lot) { lot.status = 'sale'; if (lot.ask == null) { const f = lotVal(lot).v; lot.ask = f != null ? Math.round(f * 100) / 100 : null; } port.msg = `“${lot.name}” is now in your shop stock (More → Shop).`; refreshAll(); }
    else if (act === 'unlist' && lot) { lot.status = 'hold'; refreshAll(); }
    else if (act === 'del' && lot) { if (el.dataset.arm === '1') { port.lots = port.lots.filter(l => l.uid !== id); port.edit = null; refreshAll(); } else { el.dataset.arm = '1'; el.textContent = 'Tap again to remove'; setTimeout(() => { if (el.isConnected) { el.dataset.arm = ''; el.textContent = '✕'; } }, 3500); } }
    else if (act === 'editok' && lot) {
      const q = parseFloat($('eq').value), c = $('ec').value, val = $('ev').value, ask = $('eask').value;
      if (q > 0) lot.qty = q; lot.cost = c === '' ? null : +c; lot.val = val === '' ? null : +val; lot.pin = val !== ''; lot.ask = ask === '' ? null : +ask; lot.grade = $('eg').value.trim(); port.edit = null; refreshAll();
    } else if (act === 'relink' && lot) { port.edit = null; port.form.cardId = null; $('pq').value = lot.name; $('pq').dispatchEvent(new Event('input')); window.scrollTo(0, 0); toast('Pick the card below, then delete the old row.'); }
    else if (act === 'sellok' && lot) {
      const q = parseFloat($('sq').value), p = parseFloat($('sp').value), d = $('sd').value || today(), feePct = parseFloat($('sfee').value) || 0, ship = parseFloat($('ssh').value) || 0;
      if (!(q > 0) || q > lot.qty || !(p >= 0)) { toast(`Enter a quantity up to ${lot.qty} and a sale price.`); return; }
      port.sales.push({ uid: uid(), name: lot.name, qty: q, cost: lot.cost, price: p, date: d > today() ? today() : d, src: lot.src, channel: $('sch').value, fee: Math.round(p * q * feePct) / 100, ship });
      lot.qty -= q; if (lot.qty <= 0) port.lots = port.lots.filter(l => l.uid !== id);
      port.edit = null; port.msg = `Recorded sale of ${q} × ${lot.name} at ${usd(p)}.`; refreshAll();
    }
  });
  [...v.querySelectorAll('.costin')].forEach((inp, idx) => {
    inp.onclick = e => e.stopPropagation();
    inp.onchange = () => { if (inp.value === '') return; const lot = port.lots.find(l => l.uid === inp.dataset.uid); if (!lot) return; lot.cost = Math.max(0, +inp.value); port.focusIdx = idx; refreshAll(); };
  });
  if (port.focusIdx != null) { const n = v.querySelectorAll('.costin')[port.focusIdx]; port.focusIdx = null; if (n) n.focus(); }
  const pq = $('pq'), res = $('pres');
  const pick = id => { const c = state.cards[id]; port.form.cardId = id; pq.value = `${cardTitle(c)} — ${c.s}${c.num ? ' #' + c.num : ''}`; res.innerHTML = ''; $('plinked').textContent = `Linked to the live price (${usd(c.p)}). Leave “Value each” blank to use it.`; if (c.k) $('pkind').value = 'sealed'; };
  pq.oninput = () => {
    port.form.cardId = null; $('plinked').textContent = '';
    const hits = searchCards(pq.value, { limit: 8 }); if (pq.value.trim().length < 2) { res.innerHTML = ''; return; }
    res.innerHTML = hits.map(r => `<div class="row" data-pick="${esc(r.id)}"><img src="${esc(r.c.img)}" alt=""><div class="info"><div class="name">${esc(cardTitle(r.c))}</div><div class="sub">${esc(r.c.s)} · #${esc(r.c.num || '—')} · ${esc(r.c.r || (r.c.k ? 'Sealed' : ''))}</div></div><div class="px"><b>${usd(r.price)}</b></div></div>`).join('') || '<div class="empty">No tracked match — you can still add it as a custom item with a value.</div>';
    res.querySelectorAll('[data-pick]').forEach(el => el.onclick = () => pick(el.dataset.pick));
  };
  if (port.form.prefill && port.form.cardId && state.cards[port.form.cardId]) { port.form.prefill = false; pick(port.form.cardId); setTimeout(() => $('pcost').focus(), 50); }
  $('padd').onclick = () => {
    const cardId = port.form.cardId, c = cardId && state.cards[cardId], name = c ? c.n : pq.value.trim(), qty = parseFloat($('pqty').value) || 1, cost = $('pcost').value, val = $('pval').value;
    if (!name) { toast('Type or pick an item first.'); return; }
    if (!cardId && val === '') { toast('Items that aren’t tracked cards need a “Value each” so they can be valued.'); return; }
    port.lots.push({ uid: uid(), cardId: cardId || null, name, set: c ? c.s : '', num: c ? c.num : '', grade: $('pgrade').value.trim(), qty, cost: cost === '' ? null : +cost, val: val === '' ? null : +val, pin: false,
      date: $('pdate').value || today(), src: 'Manual', kind: c ? (c.k ? 'sealed' : 'card') : $('pkind').value, status: 'hold', ask: null });
    port.form.cardId = null; port.msg = `Added ${qty} × ${name}.`; savePort(); recordPort(); render();
  };
  const doImport = async file => {
    try { const r = await importCsv(await file.text(), $('csrc').value); port.msg = `Imported ${r.n} rows from ${file.name}${r.linked != null ? ` — ${r.linked} matched to live prices` : ''} (columns used: ${Object.values(r.mapped).join(', ')}).`; recordPort(); }
    catch (e) { port.msg = 'Import failed: ' + e.message; }
    render();
  };
  $('cfile').onchange = e => e.target.files[0] && doImport(e.target.files[0]);
  const dz = $('drop');
  ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) doImport(f); });
}

// ---------- Ideas (buy ideas) ----------
function renderIdeas(v) {
  if (needPrices(v)) return;
  const d = state.deal, rars = [...new Set(getRows().filter(r => !r.c.k).map(r => r.c.r).filter(Boolean))].sort();
  v.innerHTML = `<p class="intro">Cards and sealed products that look cheap compared with their recent prices, each with a rough 90-day outlook. Tap one to see why. These are ideas to research, not promises.</p>
    <div class="toolbar"><span>Min price $<input type="number" id="dmin" min="0" step="1" value="${d.min}"></span>
      <select id="dkind"><option value="">Cards &amp; sealed</option><option value="0"${d.kind === '0' ? ' selected' : ''}>Cards only</option><option value="1"${d.kind === '1' ? ' selected' : ''}>Sealed only</option></select>
      <select id="drar"><option value="">All rarities</option>${rars.map(e => `<option${e === d.rar ? ' selected' : ''}>${esc(e)}</option>`).join('')}</select>
      <select id="dsig">${[['', 'Any signal'], ['dip', 'Dips vs 30D'], ['floor', 'Listings under market'], ['comps', 'Below my sold prices']].map(([k, l]) => `<option value="${k}"${k === d.sig ? ' selected' : ''}>${l}</option>`).join('')}</select></div><div id="dealbody"></div>`;
  $('dmin').onchange = e => { d.min = Math.max(0, +e.target.value || 0); drawIdeas(); };
  $('dkind').onchange = e => { d.kind = e.target.value; drawIdeas(); };
  $('drar').onchange = e => { d.rar = e.target.value; drawIdeas(); };
  $('dsig').onchange = e => { d.sig = e.target.value; drawIdeas(); };
  drawIdeas();
}
function drawIdeas() {
  const box = $('dealbody'); if (!box) return; const d = state.deal, held = new Set(port.lots.map(l => l.cardId).filter(Boolean));
  let rows = getRows().filter(r => r.price >= d.min && (d.kind === '' || String(r.c.k) === d.kind) && (!d.rar || r.c.r === d.rar)).map(scoreIdea);
  if (d.sig === 'dip') rows = rows.filter(r => r.pf.d30 != null && r.pf.d30 <= -5);
  if (d.sig === 'floor') rows = rows.filter(r => r.floor != null && r.floor >= 15);
  if (d.sig === 'comps') rows = rows.filter(r => r.why.some(x => x.includes('your sold prices')));
  rows = rows.filter(r => r.idea >= IDEA_MIN).sort((x, y) => y.idea - x.idea);
  box.innerHTML = `<table class="scr"><tr><th>Idea score</th><th>Item</th><th class="num">Price</th><th class="hm">90-day outlook</th><th class="hm">Why it’s flagged</th><th></th></tr>` +
    (rows.slice(0, d.limit).map(r => { const w = r.ol ? outlookWord(r.ol[90].pct) : ['—', 'flat']; return `<tr data-open="${esc(r.id)}"><td style="width:90px"><b>${r.idea}</b><div class="bar" style="height:6px;margin-top:3px"><div style="width:${Math.min(100, r.idea)}%;height:6px;background:${r.spike ? 'var(--down)' : 'var(--up)'}"></div></div></td>
      <td><img loading="lazy" src="${esc(r.c.img)}" alt=""><b>${esc(cardTitle(r.c))}</b>${held.has(r.id) ? ' <span class="pill">owned</span>' : ''}<div class="sub2" style="margin:0">${esc(r.c.s)} · ${esc(r.c.r || (r.c.k ? 'Sealed' : ''))}</div>${r.ol ? `<div class="sm"><b class="${w[1]}">${w[0]}</b> ${chgCell(r.ol[90].pct)} in 90 days</div>` : ''}</td>
      <td class="num"><b>${usd(r.price)}</b></td><td class="hm">${r.ol ? `<b class="${w[1]}">${w[0]}</b> ${chgCell(r.ol[90].pct)}<div class="sub2" style="margin:0">${usd(r.ol[90].lo)}–${usd(r.ol[90].hi)} typical</div>` : '—'}</td>
      <td class="hm">${r.why.map(x => `<span class="pill">${esc(x)}</span>`).join('')}${r.spike ? '' : (r.ol && r.ol.why[0] ? `<span class="pill">${esc(r.ol.why[0])}</span>` : '')}</td><td>${starHtml(r.id)}</td></tr>`; }).join('') || '<tr><td colspan="6"><div class="empty">Nothing stands out right now. Ideas get sharper as PokéTicker collects more days of price history.</div></td></tr>') +
    `</table>${rows.length > d.limit ? '<p style="text-align:center"><button id="dmore">Show more</button></p>' : ''}
    <p class="note"><b>How to read this:</b> the idea score (0–100) mixes signals that something is priced below where it’s been (a drop vs its 30-day level, cheaper listings, or your own sold prices) with a rough 90-day outlook based on age and recent movement. Sudden spikes lose points. These are <b>research leads, not advice</b>: a price that’s falling can keep falling, and the cheapest listing may be a damaged copy. Check recent sold prices and condition before you buy.</p>`;
  const more = box.querySelector('#dmore'); if (more) more.onclick = () => { d.limit += 60; drawIdeas(); };
}

// ---------- card / product page ----------
let chartCtx = null;
function buildChart(id, price) {
  const c = state.cards[id], pts = histSeries(id);
  const gid = c.sid.replace(/^g/, '');
  if (!state.hist[gid] && !state.histFail[gid]) { ensureHist(gid); return { html: '<div class="empty">Loading price history…</div>', ctx: null }; }
  const days = state.range === 'all' ? 1e9 : +state.range, tMax = pts.length ? pts[pts.length - 1].t : Date.now(), tMin = tMax - days * DAY, shown = pts.filter(p => p.t >= tMin);
  if (shown.length < 2) return { html: `<div class="empty">History builds up day by day (${c.pf.np || 0} day${c.pf.np === 1 ? '' : 's'} so far). The chart appears once there are two or more.</div>`, ctx: null };
  const W = 640, H = 220, L = 52, R = 10, T = 10, B = 22, t0 = shown[0].t, t1 = shown[shown.length - 1].t || t0 + 1;
  let lo = Math.min(...shown.map(p => p.v)), hi = Math.max(...shown.map(p => p.v)); const padv = (hi - lo) * 0.08 || hi * 0.05 || 1; lo -= padv; hi += padv;
  const X = t => L + (t - t0) / ((t1 - t0) || 1) * (W - L - R), Y = x => T + (1 - (x - lo) / (hi - lo)) * (H - T - B);
  const line = shown.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
  const up = shown[shown.length - 1].v >= shown[0].v, col = up ? 'var(--up)' : 'var(--down)', fmtD = t => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
  return { html: `<div class="chartbox"><svg class="chart" id="chart" viewBox="0 0 ${W} ${H}">
    ${[0, 0.5, 1].map(f => { const x = lo + (hi - lo) * f; return `<line x1="${L}" x2="${W - R}" y1="${Y(x)}" y2="${Y(x)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(x) + 3}" text-anchor="end">${usd(x)}</text>`; }).join('')}
    <text x="${L}" y="${H - 6}">${fmtD(t0)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${fmtD(t1)}</text>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="2.2"/>${shown.length <= 60 ? shown.map(p => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="2.6" fill="${col}"/>`).join('') : ''}
    <circle id="cdot" r="4.5" fill="var(--accent)" cx="-10" cy="-10"/></svg><div class="tip" id="ctip"></div></div>`, ctx: { pts: shown, X, Y, W } };
}
function outlookSection(id, c, price, pf) {
  const o = price != null ? outlook(id, price, c, pf) : null; if (!o) return '';
  return `<div class="dsec"><h4>Rough outlook if you buy today</h4>
    <table><tr><th>In</th><th class="num">Likely price</th><th class="num">Change</th><th class="num">Typical range</th></tr>${[30, 90, 180].map(h => `<tr><td>${h} days</td><td class="num"><b>${usd(o[h].base)}</b></td><td class="num">${chgCell(o[h].pct)}</td><td class="num">${usd(o[h].lo)}–${usd(o[h].hi)}</td></tr>`).join('')}</table>
    <ul style="margin:8px 0 0;padding-left:18px">${o.why.map(x => `<li class="sub2" style="margin:2px 0">${esc(x)}</li>`).join('')}</ul>
    <div class="sub2" style="margin-top:8px">A rough estimate from age, recent movement and your own data — nobody can promise where a price goes. Estimate quality: <b>${o.quality}</b> (it improves as history builds). The range is a normal swing; prices can land outside it.</div></div>`;
}
function compSection(id, c) {
  const card = { cardId: id, name: c.n, set: c.s, num: c.num }, mine = comps.list.filter(x => sameCard(card, x)).sort((a, b) => b.date.localeCompare(a.date)), grades = [...new Set(mine.map(x => gradeKey(x.grade)))];
  const fvRows = grades.map(g => { const f = fairValue(card, g); return `<tr><td>${esc(g)}</td><td class="num">${f.used}${f.n > f.used ? ' of ' + f.n : ''}</td><td class="num"><b>${usd(f.fv)}</b>${f.stale ? ' <span class="flat">(stale)</span>' : ''}</td><td class="num">${usd(f.lo)}–${usd(f.hi)}</td><td class="num">${f.trend != null ? chgCell(f.trend) : '—'}</td></tr>`; }).join('');
  return `<div class="dsec"><h4>Sold prices you logged</h4>
    ${fvRows ? `<table><tr><th>Grade</th><th class="num">Sales</th><th class="num">Value</th><th class="num">Range</th><th class="num">Trend</th></tr>${fvRows}</table>
      <div class="sub2" style="margin-top:6px">${mine.slice(0, 5).map(x => `${esc(x.date)} · ${esc(gradeKey(x.grade))} · <b>${usd(x.price)}</b> · ${esc(x.source)}`).join('<br>')}</div>` : '<div class="sub2">None yet. Look up recent sold listings (eBay sold, 130point, Card Ladder) and log them — your value is the middle price of your recent sales.</div>'}
    <div class="popform"><select id="dgr">${GRADES.map(g => `<option>${g}</option>`).join('')}</select><input type="number" id="dpr" min="0" step="0.01" placeholder="Sold price ($)"><input type="date" id="ddt" value="${today()}"><button id="dadd" class="primary">Log sale</button></div></div>`;
}
function renderDrawer() {
  const el = $('drawer'), scrim = $('scrim');
  if (!state.sel || !state.cards[state.sel]) { el.classList.remove('open'); scrim.classList.remove('show'); state.sel = null; return; }
  const id = state.sel, c = state.cards[id], price = c.p, pf = perfOf(id, price, c), ch = buildChart(id, price); chartCtx = ch.ctx;
  const pr = c.pr || {}, sameRar = c.r ? Object.values(state.cards).filter(x => x.sid === c.sid && x.r === c.r && !x.k).length : 0, pops = (state.pop[id] || []).slice().sort((x, y) => y.d.localeCompare(x.d) || x.grader.localeCompare(y.grader));
  const lastGrader = pops.length ? pops[0].grader : 'PSA', g10 = pops.filter(p => p.grader === lastGrader).reverse().map(p => p.g10);
  const popRows = pops.map((p, i) => { const prior = pops.slice(i + 1).find(q => q.grader === p.grader), gem = p.total ? p.g10 / p.total * 100 : null, d10 = prior ? p.g10 - prior.g10 : null;
    return `<tr><td>${esc(p.d)}</td><td>${esc(p.grader)}</td><td class="num">${p.g10}</td><td class="num">${p.g9}</td><td class="num">${p.g8}</td><td class="num">${p.total}</td><td class="num">${gem != null ? gem.toFixed(1) + '%' : '—'}</td><td class="num ${d10 > 0 ? 'down' : 'flat'}">${d10 != null ? (d10 > 0 ? '+' : '') + d10 : '—'}</td><td><a href="#" data-popdel="${esc(p.d)}|${esc(p.grader)}" style="color:var(--down)">✕</a></td></tr>`; }).join('');
  const sibs = siblings(id).filter(x => state.cards[x] && state.cards[x].p > 0);
  el.innerHTML = `<div class="dhead"><img src="${esc(imgOf(c.pid, true))}" alt="">
      <div style="min-width:0"><h3>${esc(c.n)}</h3><div class="sub2">${esc(ticker(id, c))} · ${esc(c.s)}${c.num ? ' · #' + esc(c.num) : ''}</div>
        ${c.r ? `<span class="pill">${esc(c.r)}</span>` : ''}<span class="pill">${esc(c.ser)}</span>${c.sub ? `<span class="pill">${esc(c.sub)}</span>` : ''}
        <div style="margin-top:8px">${starHtml(id)} <span class="sub2">${wl.list.includes(id) ? 'Watching' : 'Watch'}</span></div></div>
      <button class="xbtn" id="dclose" aria-label="Close">✕</button></div>
    <div class="big2">${usd(price)}</div>
    <div>${['d1', 'd7', 'd30'].map((k, i) => `<span class="pill">${['1D', '7D', '30D'][i]} ${chgCell(pf[k])}</span>`).join('')}</div>
    ${sibs.length > 1 ? `<div class="chips">${sibs.map(x => `<button data-var="${esc(x)}" class="${x === id ? 'active' : ''}">${esc(state.cards[x].sub || 'Standard')} ${usd(state.cards[x].p)}</button>`).join('')}</div>` : ''}
    <div class="rangebtns">${[['30', '30D'], ['90', '90D'], ['all', 'All']].map(([k, l]) => `<button data-range="${k}" class="${state.range === k ? 'active' : ''}">${l}</button>`).join('')}</div>
    ${ch.html}
    ${outlookSection(id, c, price, pf)}
    <div class="dsec"><h4>Quote (TCGplayer, USD)</h4><table><tr><th>${esc(c.sub || 'Price')}</th><th class="num">Low</th><th class="num">Mid</th><th class="num">Market</th><th class="num">High</th></tr>
      <tr><td></td><td class="num">${usd(pr.l)}</td><td class="num">${usd(pr.m)}</td><td class="num"><b>${usd(price)}</b></td><td class="num">${usd(pr.h)}</td></tr></table>
      <div class="sub2" style="margin-top:8px">Market is a recent-sales average. Low is the cheapest listing — it may be a damaged copy.${pr.l && price ? ` Spread to market: ${pct((price - pr.l) / pr.l * 100)}.` : ''}</div></div>
    <div class="dsec"><h4>Your target price</h4><div class="popform"><input type="number" id="tgt" min="0" step="0.01" placeholder="Alert me at or below $" value="${wl.t[id] ?? ''}"><button id="tgtset">${wl.list.includes(id) ? 'Save target' : 'Watch with target'}</button></div><div class="sub2">When the price reaches your target, Home tells you. (You get it when you open the app.)</div></div>
    ${c.k ? '' : `<div class="dsec"><h4>Population</h4>
      <div class="stat"><b>${sameRar || '—'}</b>${esc(c.r || 'cards')} in this set</div><div class="stat"><b>${pops.length ? pops.filter(p => p.grader === lastGrader)[0].g10 : '—'}</b>${esc(lastGrader)} 10s (latest entry)</div><div class="stat"><b>${pops.length && pops[0].total ? (pops[0].g10 / pops[0].total * 100).toFixed(1) + '%' : '—'}</b>gem rate</div>
      <div class="sub2" style="margin-top:8px">Graded population has no free public data feed, so type it in from the PSA / CGC / BGS pop report. Each dated entry builds a supply trend. <a href="https://www.psacard.com/pop/tcg-cards/" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">Open PSA Pop Report ↗</a></div>
      <div class="popform"><select id="pgr"><option>PSA</option><option>CGC</option><option>BGS</option></select><input type="number" id="p10" min="0" placeholder="Gem 10 pop"><input type="number" id="p9" min="0" placeholder="Grade 9 pop"><input type="number" id="p8" min="0" placeholder="8 &amp; lower"><input type="number" id="ptot" min="0" placeholder="Total (optional)"><button id="psave" class="primary">Save today’s pop</button></div>
      ${pops.length ? `<table><tr><th>Date</th><th>Grader</th><th class="num">10</th><th class="num">9</th><th class="num">≤8</th><th class="num">Total</th><th class="num">Gem</th><th class="num">Δ10</th><th></th></tr>${popRows}</table>` : ''}</div>`}
    ${compSection(id, c)}
    <div class="dsec popform"><button data-dact="check">Price check &amp; margin</button><button data-dact="add">Add to My Cards</button><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);margin-left:6px">View on TCGplayer ↗</a></div>`;
  el.classList.add('open'); scrim.classList.add('show');
  el.querySelector('#dclose').onclick = closeCard;
  el.querySelectorAll('[data-range]').forEach(b => b.onclick = () => { state.range = b.dataset.range; renderDrawer(); });
  el.querySelectorAll('[data-var]').forEach(b => b.onclick = () => { state.sel = b.dataset.var; renderDrawer(); });
  el.querySelectorAll('[data-popdel]').forEach(a2 => a2.onclick = e => { e.preventDefault(); const [d, g] = a2.dataset.popdel.split('|'); state.pop[id] = (state.pop[id] || []).filter(p => !(p.d === d && p.grader === g)); store.set('pt_pop', state.pop); renderDrawer(); });
  const ps = el.querySelector('#psave');
  if (ps) ps.onclick = () => {
    const n = k => Math.max(0, parseInt(el.querySelector('#' + k).value, 10) || 0), a = n('p10'), b = n('p9'), d = n('p8'), total = n('ptot') || (a + b + d);
    if (!total) { toast('Enter at least one population number.'); return; }
    const grader = el.querySelector('#pgr').value, list = (state.pop[id] || []).filter(p => !(p.d === today() && p.grader === grader));
    list.push({ d: today(), grader, g10: a, g9: b, g8: d, total }); state.pop[id] = list; store.set('pt_pop', state.pop); renderDrawer();
  };
  el.querySelector('#tgtset').onclick = () => { const t = parseFloat(el.querySelector('#tgt').value); if (!wl.list.includes(id)) wl.list.push(id); if (t > 0) wl.t[id] = t; else delete wl.t[id]; saveWl(); render(); renderDrawer(); toast(t > 0 ? `Target set at ${usd(t)}.` : 'Target cleared.'); };
  const add = el.querySelector('#dadd');
  if (add) add.onclick = () => { const p = parseFloat(el.querySelector('#dpr').value); if (!(p > 0)) { toast('Enter the sold price.'); return; } addComp({ cardId: id, name: c.n, set: c.s, num: c.num }, el.querySelector('#dgr').value, p, el.querySelector('#ddt').value || today(), 'Other', '', ''); saveComps(); renderDrawer(); render(); };
  el.querySelectorAll('[data-dact]').forEach(b => b.onclick = () => {
    closeCard();
    if (b.dataset.dact === 'check') { state.chk = Object.assign(state.chk || { q: '', basis: 'market', margin: store.get('pt_margin', 25), ask: '', shipIn: '' }, { id }); state.tab = 'check'; }
    else { port.form.cardId = id; port.form.prefill = true; state.tab = 'port'; }
    render(); window.scrollTo(0, 0);
  });
  const svg = el.querySelector('#chart');
  if (svg && chartCtx) svg.addEventListener('mousemove', e => {
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * chartCtx.W; let best = chartCtx.pts[0];
    for (const p of chartCtx.pts) if (Math.abs(chartCtx.X(p.t) - x) < Math.abs(chartCtx.X(best.t) - x)) best = p;
    const dot = svg.querySelector('#cdot'), tip = el.querySelector('#ctip'); dot.setAttribute('cx', chartCtx.X(best.t)); dot.setAttribute('cy', chartCtx.Y(best.v));
    tip.textContent = `${new Date(best.t).toLocaleDateString()} · ${usd(best.v)}`; tip.style.opacity = 1;
  });
}
function openCard(id) { state.sel = id; renderDrawer(); }
function closeCard() { state.sel = null; renderDrawer(); }
