'use strict';
// ===== More menu and its pages: Sold Prices, Shop, Watchlist, Market, Eras & Sets, Backup & Security, CSV import =====
function renderMore(v) {
  v.innerHTML = `<div class="menu">
      <button data-go="comps"><b>Sold Prices</b><span>Log what cards actually sold for — your most trustworthy price.</span></button>
      <button data-go="shop"><b>Shop (SlabStreet)</b><span>Stock, sales, expenses and profit.</span></button>
      <button data-go="watch"><b>Watchlist</b><span>Cards you’re watching, with price targets.</span></button>
      <button data-go="market"><b>Market</b><span>Browse every card and sealed product.</span></button>
      <button data-go="sets"><b>Eras &amp; Sets</b><span>Browse by era and track set completion.</span></button>
      <button data-go="settings"><b>Backup &amp; Security</b><span>Back up, lock the app, restore, erase.</span></button></div>
    <details class="guide" style="margin:0 0 18px"><summary>Put PokéTicker on your phone’s home screen</summary>
      <p class="intro" style="max-width:none;margin-top:10px"><b>Android (Chrome):</b> tap the ⋮ menu, then <b>Install app</b>. <b>Samsung Internet:</b> tap ☰, then <b>Add page to → Home screen</b>. <b>iPhone (Safari):</b> Share, then <b>Add to Home Screen</b>.<br>
        Once installed, you can share an eBay sold page or link to PokéTicker from your browser’s Share menu to start logging a sold price.</p></details>
    <h2>What the numbers mean</h2>
    <p class="intro" style="max-width:none"><b>Market price</b> — what a card has recently been selling for on TCGplayer.<br><b>Sold-price value</b> — the middle price of the sales you logged yourself.<br><b>Outlook</b> — a rough guess of the price in 30, 90 and 180 days based on the set’s age, recent movement and your data. It can be wrong; the Home screen grades it over time.<br><b>Idea score</b> — how strongly PokéTicker’s signals point to something being cheap right now (0–100).<br><b>Up / down</b> — your cards’ current value compared with what you paid.</p>
    <p class="note">Prices: TCGplayer market prices (USD), collected daily through tcgcsv.com. PokéTicker is an independent personal tool and isn’t affiliated with TCGplayer, Nintendo or The Pokémon Company.</p>`;
}

// ---------- Sold Prices (comps) ----------
function renderComps(v) {
  const f = comps.form, holdings = [...new Map(port.lots.map(l => [nkey(l) + '|' + gradeKey(l.grade), l])).values()], groups = {};
  for (const c of comps.list) (groups[nkey(c) + '|' + gradeKey(c.grade)] ||= []).push(c);
  const board = Object.entries(groups).map(([k, list]) => {
    list.sort((x, y) => y.date.localeCompare(x.date));
    const head = list[0], fv = fairValue(head, head.grade), gk = gradeKey(head.grade);
    const owned = port.lots.filter(l => sameCard(l, head) && gradeKey(l.grade) === gk).reduce((t, l) => t + l.qty, 0), mkt = head.cardId && gk === 'Raw' ? latestPrice(head.cardId) : null;
    return { k, list, head, fv, gk, owned, mkt };
  }).sort((x, y) => y.head.date.localeCompare(x.head.date));
  const boardHtml = board.length ? `<table><tr><th>Item</th><th>Grade</th><th class="num">Sales</th><th class="num">Value</th><th class="num hm">Range</th><th class="hm">Last sale</th><th class="num hm">Trend</th><th class="num hm">Market</th><th class="num hm">Owned</th></tr>` +
    board.map(g => {
      const open = state.open['comp:' + g.k], mk = g.mkt != null && g.fv ? (g.mkt - g.fv.fv) / g.fv.fv * 100 : null;
      return `<tr class="tabrow" data-toggle="comp:${esc(g.k)}"><td>${open ? '▾' : '▸'} <b>${esc(g.head.name)}</b><div class="sub2" style="margin:0">${esc(g.head.set || '')}</div></td><td>${esc(g.gk)}</td><td class="num">${g.fv.used}${g.fv.n > g.fv.used ? ' / ' + g.fv.n : ''}</td>
        <td class="num"><b>${usd(g.fv.fv)}</b> <span class="pill ${g.fv.conf === 'high' ? 'up' : g.fv.conf === 'low' ? 'down' : ''}">${g.fv.stale ? 'stale' : g.fv.conf}</span></td><td class="num hm">${usd(g.fv.lo)}–${usd(g.fv.hi)}</td><td class="hm">${usd(g.fv.last.price)} · ${esc(g.fv.last.date)}</td><td class="num hm">${g.fv.trend != null ? chgCell(g.fv.trend) : '—'}</td><td class="num hm">${g.mkt != null ? usd(g.mkt) + ' ' + chgCell(mk) : '—'}</td><td class="num hm">${g.owned || '—'}</td></tr>` +
        (open ? `<tr><td colspan="9"><div class="setdetail"><table><tr><th>Sold</th><th class="num">Price</th><th>Source</th><th>Note</th><th></th></tr>${g.list.map(x => `<tr><td>${esc(x.date)}</td><td class="num">${usd(x.price)}</td><td>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.source)} ↗</a>` : esc(x.source)}</td><td>${esc(x.note)}</td><td><a href="#" data-cdel="${esc(x.uid)}" style="color:var(--down)">✕</a></td></tr>`).join('')}</table></div></td></tr>` : '');
    }).join('') + '</table>' : '<div class="empty">No sold prices yet. Pick an item above, look up its recent sold listings, and log the prices. Three to five recent sales give a trustworthy value.</div>';
  const sel = () => f.name ? `${esc(f.name)}${f.set ? ' — ' + esc(f.set) : ''}${f.num ? ' #' + esc(f.num) : ''} · <b>${esc(f.grade)}</b> ${f.cardId ? '· linked to a tracked card' : '· custom item'}` : 'Pick or type an item above';
  v.innerHTML = `${back()}<p class="intro">When you see a card sell on eBay (or anywhere), log the price here. PokéTicker turns your logged sales into a value you can trust, and checks listings against it.</p>
    <div class="dsec" style="margin-top:0;border:0;padding:0"><h2>1 · Choose the item</h2>
      <div class="popform"><input type="text" id="cq" placeholder="Search a tracked card, or type any item name" value="${esc(f.cardId ? `${f.name} — ${f.set} #${f.num}` : f.name)}" style="flex:1;min-width:240px" autocomplete="off">
        <select id="chold"><option value="">…or pick from my cards</option>${holdings.map((l, i) => `<option value="${i}">${esc(l.name)}${l.grade ? ' (' + esc(gradeKey(l.grade)) + ')' : ''} — ${esc(l.set || '')}</option>`).join('')}</select>
        <select id="cgrade">${GRADES.map(g => `<option${g === f.grade ? ' selected' : ''}>${g}</option>`).join('')}</select></div>
      <div class="searchres" id="cres"></div><div class="sub2" id="csel">${sel()}</div></div>
    <div class="cols"><div class="dsec"><h2>2 · Log sold prices</h2>
        <div class="popform"><input type="number" id="cprice" min="0" step="0.01" placeholder="Sold price ($)"><input type="date" id="cdate" value="${today()}"><select id="csrc">${SOURCES.map(s => `<option>${s}</option>`).join('')}</select>
          <input type="text" id="curl" placeholder="Link to the sale (optional)" style="flex:1;min-width:150px"><input type="text" id="cnote" placeholder="Note (e.g. best offer)" style="flex:1;min-width:130px"><button class="primary" id="cadd">Add</button></div>
        <div class="sub2">Faster: paste several sales — one per line (<code>$412.50 10/15/2026</code>), or copy straight from eBay’s “Sold items” list. PokéTicker reads each price and date, and picks up PSA/BGS/CGC grades from the titles.</div>
        <textarea id="cbulk" rows="5" placeholder="$412.50 10/15/2026&#10;$399 Oct 12&#10;388 2026-10-09">${esc(comps.bulk || '')}</textarea>
        <div style="margin-top:6px"><button id="cbulkadd">Add pasted sales</button> <span class="sub2" id="cmsg">${esc(comps.msg)}</span></div></div>
      <div class="dsec"><h2>3 · Check a listing</h2>
        <div class="popform"><input type="number" id="cask" min="0" step="0.01" placeholder="Asking price ($)"><input type="number" id="cship" min="0" step="0.01" placeholder="Shipping to you ($)">
          <label class="sub2" style="margin:0">Fees % <input type="number" id="cfee" min="0" step="0.05" value="${comps.fee}" style="width:76px"></label><label class="sub2" style="margin:0">Your shipping $ <input type="number" id="cout" min="0" step="0.25" value="${comps.shipOut}" style="width:76px"></label></div>
        <div id="cverdict" class="sub2" style="font-size:14px;color:var(--text)"></div></div></div>
    <div class="dsec"><h2>Sold-price board <span style="font-size:12px;font-weight:400" class="flat">— ${comps.list.length} sale${comps.list.length === 1 ? '' : 's'} logged</span> <button id="cexport" style="float:right">Export CSV</button></h2>${boardHtml}
      <p class="note">Your value is the middle price of the last up to 7 sales within 90 days, so one lucky or unlucky sale doesn’t move it. It feeds My Cards (◆), Ideas and each card’s page. Confidence: 5+ sales high, 3–4 medium, fewer low. Match grade and condition, and skip damaged copies or sales that look fake.</p></div>`;
  wireComps(v);
}
function wireComps(v) {
  const f = comps.form;
  const verdict = () => {
    const box = $('cverdict'), ask = parseFloat($('cask').value), ship = parseFloat($('cship').value) || 0;
    comps.fee = parseFloat($('cfee').value) || 0; comps.shipOut = parseFloat($('cout').value) || 0; saveComps();
    if (!f.name) { box.textContent = 'Choose an item first.'; return; }
    const fv = fairValue(f, f.grade);
    if (!fv) { box.textContent = `No sold prices logged yet for ${f.grade} copies of this item — log a few first.`; return; }
    const head = `Value <b>${usd(fv.fv)}</b> (${fv.conf} confidence, ${fv.used} sale${fv.used === 1 ? '' : 's'}, range ${usd(fv.lo)}–${usd(fv.hi)}${fv.stale ? ', no sale in 90 days' : ''}).`;
    if (!(ask > 0)) { box.innerHTML = head + ' Enter an asking price to compare.'; return; }
    const cost = ask + ship, vs = (cost - fv.fv) / fv.fv * 100, net = fv.fv * (1 - comps.fee / 100) - comps.shipOut, profit = net - cost, roi = profit / cost * 100;
    const t = vs <= -20 ? ['Strong deal', 'up'] : vs <= -10 ? ['Good price', 'up'] : vs <= 0 ? ['Fair — thin margin', 'flat'] : ['Overpriced vs your sales', 'down'];
    box.innerHTML = `${head}<br><b class="${t[1]}">${t[0]}</b> — your cost ${usd(cost)} is <span class="${vs <= 0 ? 'up' : 'down'}">${pct(vs)}</span> vs value. Reselling at that value nets ${usd(net)} after fees and shipping → <b class="${profit >= 0 ? 'up' : 'down'}">${profit >= 0 ? '+' : '−'}${usd(Math.abs(profit))} (${pct(roi)})</b>.${fv.conf === 'low' ? ' <span class="down">Low confidence — log more sales first.</span>' : ''}`;
  };
  const cq = $('cq'), res = $('cres'), setSel = () => { $('csel').innerHTML = f.name ? `${esc(f.name)}${f.set ? ' — ' + esc(f.set) : ''}${f.num ? ' #' + esc(f.num) : ''} · <b>${esc(f.grade)}</b> ${f.cardId ? '· linked to a tracked card' : '· custom item'}` : 'Pick or type an item above'; verdict(); };
  cq.oninput = () => {
    Object.assign(f, { cardId: null, name: cq.value.trim(), set: '', num: '' }); setSel();
    if (cq.value.trim().length < 2) { res.innerHTML = ''; return; }
    res.innerHTML = searchCards(cq.value, { limit: 8 }).map(r => `<div class="row" data-pick="${esc(r.id)}"><img src="${esc(r.c.img)}" alt=""><div class="info"><div class="name">${esc(cardTitle(r.c))}</div><div class="sub">${esc(r.c.s)} · #${esc(r.c.num || '—')} · ${esc(r.c.r || '')}</div></div><div class="px"><b>${usd(r.price)}</b></div></div>`).join('');
    res.querySelectorAll('[data-pick]').forEach(el => el.onclick = () => { const c = state.cards[el.dataset.pick]; Object.assign(f, { cardId: el.dataset.pick, name: c.n, set: c.s, num: c.num }); cq.value = `${c.n} — ${c.s} #${c.num}`; res.innerHTML = ''; setSel(); });
  };
  const holdings = [...new Map(port.lots.map(l => [nkey(l) + '|' + gradeKey(l.grade), l])).values()];
  $('chold').onchange = e => { const l = holdings[+e.target.value]; if (!l) return; Object.assign(f, { cardId: l.cardId || null, name: l.name, set: l.set || '', num: l.num || '', grade: gradeKey(l.grade) }); renderComps(v); };
  $('cgrade').onchange = e => { f.grade = e.target.value; setSel(); };
  const done = msg => { comps.msg = msg; comps.bulk = ''; saveComps(); renderComps(v); };
  $('cadd').onclick = () => {
    if (!f.name) { toast('Choose the item first.'); return; }
    const p = parseFloat($('cprice').value); if (!(p > 0)) { toast('Enter the sold price.'); return; }
    const d = $('cdate').value || today(); addComp(f, f.grade, p, d > today() ? today() : d, $('csrc').value, /^https?:\/\//.test($('curl').value.trim()) ? $('curl').value.trim() : '', $('cnote').value.trim());
    done(`Added ${usd(p)} for ${f.name} (${f.grade}).`);
  };
  $('cbulk').oninput = e => { comps.bulk = e.target.value; };
  $('cbulkadd').onclick = () => {
    if (!f.name) { toast('Choose the item first.'); return; }
    const items = parseCompText($('cbulk').value); if (!items.length) { toast('No prices found — put one sale per line, or paste eBay’s sold list.'); return; }
    const byGrade = {}; items.forEach(it => { const g = it.grade || f.grade; byGrade[g] = (byGrade[g] || 0) + 1; addComp(f, g, it.price, it.date, $('csrc').value, it.url, ''); });
    done(`Added ${items.length} sale${items.length === 1 ? '' : 's'} for ${f.name} (${Object.entries(byGrade).map(([g, n]) => n + ' as ' + g).join(', ')}).`);
  };
  v.querySelectorAll('[data-cdel]').forEach(a2 => a2.onclick = e => { e.preventDefault(); e.stopPropagation(); comps.list = comps.list.filter(x => x.uid !== a2.dataset.cdel); saveComps(); render(); });
  ['cask', 'cship', 'cfee', 'cout'].forEach(s => { $(s).oninput = verdict; });
  $('cexport').onclick = () => download(`poketicker-sold-prices-${today()}.csv`, [['Date sold', 'Item', 'Set', 'Number', 'Grade', 'Price', 'Source', 'URL', 'Note'], ...comps.list.map(c => [c.date, c.name, c.set, c.num, c.grade, c.price, c.source, c.url, c.note])].map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
  verdict();
}

// ---------- Shop (SlabStreet tools) ----------
function renderShop(v) {
  const t = port.shopTab, months = [...new Set([...port.sales.map(s => monthOf(s.date)), ...port.exp.map(e => monthOf(e.date)), today().slice(0, 7)])].filter(Boolean).sort().reverse();
  v.innerHTML = `${back()}<p class="intro">Your shop’s stock, sales and costs in one place. Items you “List” in My Cards show up as stock. This is for tracking; for taxes and licensing, check with your accountant or state.</p>
    <div class="chips">${[['stock', 'Stock'], ['sales', 'Sales'], ['exp', 'Expenses'], ['report', 'Report']].map(([k, l]) => `<button data-shoptab="${k}" class="${t === k ? 'active' : ''}">${l}</button>`).join('')}</div><div id="shopbody"></div>`;
  v.querySelectorAll('[data-shoptab]').forEach(b => b.onclick = () => { port.shopTab = b.dataset.shoptab; renderShop(v); });
  const box = $('shopbody');
  if (t === 'stock') {
    const s = portSummary(l => l.status === 'sale'), stock = [...s.rows].sort((x, y) => (y.valT ?? 0) - (x.valT ?? 0));
    const askTotal = stock.reduce((q, r) => q + (r.l.ask || 0) * r.l.qty, 0), cost = stock.reduce((q, r) => q + (r.l.cost || 0) * r.l.qty, 0);
    box.innerHTML = `<div class="grid" style="margin-bottom:12px"><div class="tile"><div class="lbl">Items for sale</div><div class="big">${stock.reduce((q, r) => q + r.l.qty, 0)}</div></div><div class="tile"><div class="lbl">Stock cost</div><div class="big money">${usd(cost)}</div></div><div class="tile"><div class="lbl">Asking total</div><div class="big money">${usd(askTotal)}</div></div><div class="tile"><div class="lbl">Market value</div><div class="big money">${usd(s.value)}</div></div></div>
      ${stock.length ? `<table><tr><th>Item</th><th class="num">Qty</th><th class="num">Cost ea.</th><th class="num">Asking</th><th class="num hm">Market ea.</th><th class="num hm">Profit at asking</th><th></th></tr>${stock.map(r => { const l = r.l, net = l.ask != null ? l.ask * (1 - comps.fee / 100) - (l.cost || 0) : null;
        const ed = port.edit && port.edit.uid === l.uid ? port.edit : null;
        return `<tr><td><b>${esc(l.name)}</b>${l.grade ? ` <span class="pill">${esc(l.grade)}</span>` : ''}<div class="sub2" style="margin:0">${esc(l.set || '')}</div></td><td class="num">${l.qty}</td><td class="num">${l.cost != null ? pm(l.cost) : '—'}</td><td class="num">${l.ask != null ? pm(l.ask) : '—'}</td><td class="num hm">${pm(r.v)}</td><td class="num hm ${net > 0 ? 'up' : 'down'}">${net != null && l.cost != null ? `<span class="money">${usd(net)}</span>` : '—'}</td>
          <td style="white-space:nowrap"><a href="#" data-p="edit" data-uid="${esc(l.uid)}">✎</a> <a href="#" data-p="sell" data-uid="${esc(l.uid)}">Sold</a> <a href="#" data-p="unlist" data-uid="${esc(l.uid)}">Unlist</a></td></tr>${ed && ed.mode === 'sell' ? sellFormHtml(l, l.ask ?? r.v) : ''}${ed && ed.mode === 'edit' ? editFormHtml(l) : ''}`; }).join('')}</table>
        <p class="note">“Profit at asking” = asking price − ${comps.fee}% fees − what you paid (shipping not included).</p>` : '<div class="empty">No stock listed. In <a href="#" data-go="port" style="color:var(--accent)">My Cards</a>, tap <b>List</b> on anything you want to sell.</div>'}`;
    wireLotActions(box, () => renderShop(v));
  } else if (t === 'sales') {
    const rep = shopReport(''), sales = [...port.sales].sort((a, b) => b.date.localeCompare(a.date));
    box.innerHTML = `<div class="grid" style="margin-bottom:12px"><div class="tile"><div class="lbl">Sales logged</div><div class="big">${port.sales.length}</div></div><div class="tile"><div class="lbl">Revenue</div><div class="big money">${usd(rep.rev)}</div></div><div class="tile"><div class="lbl">Profit on sales</div><div class="big money ${rep.rev - rep.cogs - rep.fees - rep.ship >= 0 ? 'up' : 'down'}">${usd(rep.rev - rep.cogs - rep.fees - rep.ship)}</div></div></div>
      ${sales.length ? `<table><tr><th>Date</th><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="hm">Channel</th><th class="num hm">Fees</th><th class="num hm">Shipping</th><th class="num">Profit</th><th></th></tr>${sales.map(s => `<tr><td>${esc(s.date)}</td><td>${esc(s.name)}</td><td class="num">${s.qty}</td><td class="num">${pm(s.price)}</td><td class="hm">${esc(s.channel || '')}</td><td class="num hm">${pm(s.fee || 0)}</td><td class="num hm">${pm(s.ship || 0)}</td><td class="num ${s.cost != null ? (saleProfit(s) >= 0 ? 'up' : 'down') : 'flat'}">${s.cost != null ? pm(saleProfit(s)) : '—'}</td><td><a href="#" data-sdel="${esc(s.uid)}" style="color:var(--down)">✕</a></td></tr>`).join('')}</table>` : '<div class="empty">No sales yet. Tap <b>Sold</b> next to an item in My Cards or Stock.</div>'}
      <div class="popform" style="margin-top:12px"><button id="sx">Export sales (CSV)</button></div><p class="note">Removing a sale doesn’t put the item back in stock. Add it again in My Cards if you need to.</p>`;
    box.querySelectorAll('[data-sdel]').forEach(a2 => a2.onclick = e => { e.preventDefault(); if (a2.dataset.arm === '1') { port.sales = port.sales.filter(x => x.uid !== a2.dataset.sdel); savePort(); renderShop(v); } else { a2.dataset.arm = '1'; a2.textContent = 'tap again'; setTimeout(() => { if (a2.isConnected) { a2.dataset.arm = ''; a2.textContent = '✕'; } }, 3500); } });
    const sx = $('sx'); if (sx) sx.onclick = () => download(`slabstreet-sales-${today()}.csv`, [['Date', 'Item', 'Qty', 'Price each', 'Revenue', 'Cost each', 'Fees', 'Shipping paid', 'Profit', 'Channel'], ...sales.map(s => [s.date, s.name, s.qty, s.price, saleRevenue(s), s.cost ?? '', s.fee || 0, s.ship || 0, s.cost != null ? saleProfit(s) : '', s.channel || ''])].map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
  } else if (t === 'exp') {
    const exp = [...port.exp].sort((a, b) => b.date.localeCompare(a.date)), total = exp.reduce((q, e) => q + e.amount, 0);
    box.innerHTML = `<div class="popform"><input type="date" id="xd" value="${today()}"><select id="xc">${EXP_CATS.map(c => `<option>${esc(c)}</option>`).join('')}</select><input type="number" id="xa" min="0" step="0.01" placeholder="Amount ($)"><input type="text" id="xn" placeholder="Note (optional)" style="flex:1;min-width:140px"><button class="primary" id="xadd">Add expense</button></div>
      ${exp.length ? `<table><tr><th>Date</th><th>Category</th><th class="num">Amount</th><th class="hm">Note</th><th></th></tr>${exp.map(e => `<tr><td>${esc(e.date)}</td><td>${esc(e.cat)}</td><td class="num">${pm(e.amount)}</td><td class="hm">${esc(e.note)}</td><td><a href="#" data-xdel="${esc(e.uid)}" style="color:var(--down)">✕</a></td></tr>`).join('')}<tr><td colspan="2"><b>Total</b></td><td class="num"><b>${pm(total)}</b></td><td colspan="2"></td></tr></table>` : '<div class="empty">No expenses yet. Log supplies, postage, grading fees and show costs so your profit is real.</div>'}
      <div class="popform" style="margin-top:12px"><button id="xx">Export expenses (CSV)</button></div>`;
    $('xadd').onclick = () => { const a = parseFloat($('xa').value); if (!(a > 0)) { toast('Enter the amount.'); return; } const d = $('xd').value || today(); port.exp.push({ uid: uid(), date: d > today() ? today() : d, cat: $('xc').value, amount: a, note: $('xn').value.trim() }); savePort(); renderShop(v); };
    box.querySelectorAll('[data-xdel]').forEach(a2 => a2.onclick = e => { e.preventDefault(); port.exp = port.exp.filter(x => x.uid !== a2.dataset.xdel); savePort(); renderShop(v); });
    $('xx').onclick = () => download(`slabstreet-expenses-${today()}.csv`, [['Date', 'Category', 'Amount', 'Note'], ...exp.map(e => [e.date, e.cat, e.amount, e.note])].map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
  } else {
    const m = port.month === undefined ? today().slice(0, 7) : port.month, rep = shopReport(m), ch = Object.entries(rep.byChannel).sort((a, b) => b[1].rev - a[1].rev);
    box.innerHTML = `<div class="popform"><label class="sub2">Period <select id="rm"><option value=""${m === '' ? ' selected' : ''}>All time</option>${months.map(x => `<option${x === m ? ' selected' : ''}>${x}</option>`).join('')}</select></label><button id="rx">Monthly summary (CSV)</button></div>
      <div class="grid" style="margin:10px 0 14px"><div class="tile"><div class="lbl">Revenue</div><div class="big money">${usd(rep.rev)}</div><div class="lbl">${rep.units} item${rep.units === 1 ? '' : 's'} sold</div></div>
        <div class="tile"><div class="lbl">Cost of cards sold</div><div class="big money">${usd(rep.cogs)}</div></div><div class="tile"><div class="lbl">Fees + shipping</div><div class="big money">${usd(rep.fees + rep.ship)}</div></div>
        <div class="tile"><div class="lbl">Expenses</div><div class="big money">${usd(rep.expenses)}</div></div><div class="tile"><div class="lbl">Net profit</div><div class="big money ${rep.net >= 0 ? 'up' : 'down'}">${usd(rep.net)}</div><div class="lbl">${rep.margin != null ? pct(rep.margin) + ' margin' : ''}</div></div></div>
      ${rep.unknownCost ? `<div class="sub2">⚠ ${rep.unknownCost} sale${rep.unknownCost === 1 ? ' has' : 's have'} no purchase price recorded, so profit is understated.</div>` : ''}
      ${ch.length ? `<h2>By sales channel</h2><table><tr><th>Channel</th><th class="num">Sold</th><th class="num">Revenue</th><th class="num">Profit</th></tr>${ch.map(([k, x]) => `<tr><td>${esc(k)}</td><td class="num">${x.n}</td><td class="num">${pm(x.rev)}</td><td class="num ${x.profit >= 0 ? 'up' : 'down'}">${pm(x.profit)}</td></tr>`).join('')}</table>` : ''}
      <p class="note">Net profit = revenue − cost of cards sold − fees − shipping − expenses. This is a record-keeping summary, not tax advice.</p>`;
    $('rm').onchange = e => { port.month = e.target.value; renderShop(v); };
    $('rx').onclick = () => { const rows = [['Month', 'Revenue', 'Cost of cards sold', 'Fees', 'Shipping', 'Expenses', 'Net profit']]; months.slice().reverse().forEach(mo => { const r = shopReport(mo); rows.push([mo, r.rev, r.cogs, r.fees, r.ship, r.expenses, r.net]); }); download(`slabstreet-monthly-${today()}.csv`, rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv'); };
  }
}
function editFormHtml(l) {
  return `<tr><td colspan="9"><div class="popform">Edit: <input type="number" id="eq" min="0" step="1" value="${l.qty}" title="quantity"><input type="number" id="ec" min="0" step="0.01" value="${l.cost ?? ''}" placeholder="paid each"><input type="number" id="ev" min="0" step="0.01" value="${l.val ?? ''}" placeholder="value override (locks it)" style="width:190px"><input type="number" id="eask" min="0" step="0.01" value="${l.ask ?? ''}" placeholder="asking price"><input type="text" id="eg" value="${esc(l.grade || '')}" placeholder="grade / condition" style="width:140px"><button class="primary" data-p="editok" data-uid="${esc(l.uid)}">Save</button><button data-p="cancel">Cancel</button></div></td></tr>`;
}
function wireLotActions(box, redraw) {
  const after = () => { savePort(); recordPort(); redraw(); };
  box.querySelectorAll('[data-p]').forEach(el => el.onclick = e => {
    e.preventDefault(); const act = el.dataset.p, id = el.dataset.uid, lot = port.lots.find(l => l.uid === id);
    if (act === 'edit' || act === 'sell') { port.edit = { uid: id, mode: act }; redraw(); const ch = $('sch'); if (ch) ch.onchange = () => { const p = FEE_PRESETS[ch.value]; $('sfee').value = p == null ? comps.fee : p; }; }
    else if (act === 'cancel') { port.edit = null; redraw(); }
    else if (act === 'unlist' && lot) { lot.status = 'hold'; after(); }
    else if (act === 'editok' && lot) { const q = parseFloat($('eq').value), c = $('ec').value, val = $('ev').value, ask = $('eask').value; if (q > 0) lot.qty = q; lot.cost = c === '' ? null : +c; lot.val = val === '' ? null : +val; lot.pin = val !== ''; lot.ask = ask === '' ? null : +ask; lot.grade = $('eg').value.trim(); port.edit = null; after(); }
    else if (act === 'sellok' && lot) {
      const q = parseFloat($('sq').value), p = parseFloat($('sp').value), d = $('sd').value || today(), feePct = parseFloat($('sfee').value) || 0, ship = parseFloat($('ssh').value) || 0;
      if (!(q > 0) || q > lot.qty || !(p >= 0)) { toast(`Enter a quantity up to ${lot.qty} and a sale price.`); return; }
      port.sales.push({ uid: uid(), name: lot.name, qty: q, cost: lot.cost, price: p, date: d > today() ? today() : d, src: lot.src, channel: $('sch').value, fee: Math.round(p * q * feePct) / 100, ship });
      lot.qty -= q; if (lot.qty <= 0) port.lots = port.lots.filter(l => l.uid !== id); port.edit = null; toast(`Sale recorded: ${q} × ${lot.name}.`); after();
    }
  });
}

// ---------- Watchlist ----------
function renderWatch(v) {
  if (needPrices(v)) return;
  const rows = wl.list.map(id => state.cards[id] ? { id, c: state.cards[id], price: state.cards[id].p } : null).filter(Boolean);
  v.innerHTML = `${back()}<p class="intro">Cards you’re keeping an eye on. Set a target price and Home tells you when it’s reached (you see it when you open the app).</p>
    <input type="search" id="wq" placeholder="Search a card to watch…" autocomplete="off"><div class="searchres" id="wres"></div>
    ${rows.length ? `<table style="margin-top:10px"><tr><th>Card</th><th class="num">Price</th><th class="num">1D</th><th class="num hm">7D</th><th class="num hm">30D</th><th class="num">Target $</th><th></th></tr>${rows.map(r => { const pf = perfOf(r.id, r.price, r.c), tg = wl.t[r.id];
      return `<tr data-open="${esc(r.id)}" style="cursor:pointer"><td><img src="${esc(r.c.img)}" alt="" style="width:26px;height:36px;object-fit:cover;border-radius:3px;vertical-align:middle;margin-right:8px"><b>${esc(cardTitle(r.c))}</b><div class="sub2" style="margin:0">${esc(r.c.s)}</div></td><td class="num"><b>${usd(r.price)}</b></td><td class="num">${chgCell(pf.d1)}</td><td class="num hm">${chgCell(pf.d7)}</td><td class="num hm">${chgCell(pf.d30)}</td>
        <td class="num"><input type="number" class="tgt" data-id="${esc(r.id)}" min="0" step="0.01" value="${tg ?? ''}" style="width:84px;padding:3px 6px" placeholder="—">${tg && r.price <= tg ? ' 🎯' : ''}</td><td>${starHtml(r.id)}</td></tr>`; }).join('')}</table>` : '<div class="empty">Nothing watched yet. Search above, or tap ☆ on any card.</div>'}`;
  $('wq').oninput = e => { const q = e.target.value, res = $('wres'); if (q.trim().length < 2) { res.innerHTML = ''; return; }
    res.innerHTML = searchCards(q, { limit: 8 }).map(r => rowHtml(r)).join(''); };
  v.querySelectorAll('.tgt').forEach(i => { i.onclick = e => e.stopPropagation(); i.onchange = () => { const t = parseFloat(i.value); if (t > 0) wl.t[i.dataset.id] = t; else delete wl.t[i.dataset.id]; saveWl(); render(); }; });
}

// ---------- Market (browse everything) ----------
function renderMarket(v) {
  if (needPrices(v)) return;
  const s = state.scr, rars = [...new Set(getRows().filter(r => !r.c.k).map(r => r.c.r).filter(Boolean))].sort();
  v.innerHTML = `${back()}<div class="toolbar"><input type="search" id="sq" placeholder="Search card, set or product…" value="${esc(s.q)}" style="width:230px">
      <select id="sera"><option value="">All eras</option>${ERA_ORDER.map(e => `<option${e === s.era ? ' selected' : ''}>${esc(e)}</option>`).join('')}</select>
      <select id="skind"><option value="">Cards &amp; sealed</option><option value="0"${s.kind === '0' ? ' selected' : ''}>Cards only</option><option value="1"${s.kind === '1' ? ' selected' : ''}>Sealed only</option></select>
      <select id="srar"><option value="">All rarities</option>${rars.map(e => `<option${e === s.rar ? ' selected' : ''}>${esc(e)}</option>`).join('')}</select>
      <span>Min $<input type="number" id="minp" min="0" step="0.5" value="${store.get('pt_min', 1)}"></span></div><div id="scrbody"></div>`;
  $('sq').oninput = e => { s.q = e.target.value; s.limit = 100; drawMarket(); };
  $('sera').onchange = e => { s.era = e.target.value; s.limit = 100; drawMarket(); };
  $('skind').onchange = e => { s.kind = e.target.value; s.limit = 100; drawMarket(); };
  $('srar').onchange = e => { s.rar = e.target.value; s.limit = 100; drawMarket(); };
  $('minp').onchange = e => { store.set('pt_min', Math.max(0, +e.target.value || 0)); s.limit = 100; drawMarket(); };
  drawMarket();
}
function drawMarket() {
  const box = $('scrbody'); if (!box) return; const s = state.scr, minP = store.get('pt_min', 1), q = s.q.trim().toLowerCase(), toks = q.split(/\s+/).filter(Boolean);
  let rows = getRows().filter(r => r.price >= minP && (!s.era || r.c.ser === s.era) && (s.kind === '' || String(r.c.k) === s.kind) && (!s.rar || r.c.r === s.rar) && toks.every(t => (r.c._h || (r.c._h = (r.c.n + ' ' + r.c.sub + ' ' + r.c.s + ' ' + r.c.num + ' ' + r.c.r).toLowerCase())).includes(t)));
  const dv = r => s.sort === 'name' ? r.c.n.toLowerCase() : s.sort === 'price' ? r.price : r.c.pf[s.sort];
  rows.sort((x, y) => { const a1 = dv(x), b1 = dv(y); if (a1 == null) return 1; if (b1 == null) return -1; return (a1 < b1 ? -1 : a1 > b1 ? 1 : 0) * s.dir; });
  const moved = rows.filter(r => r.c.pf.d1 != null), adv = moved.filter(r => r.c.pf.d1 > 0.05).length, dec = moved.filter(r => r.c.pf.d1 < -0.05).length, avg = moved.length ? moved.reduce((t, r) => t + r.c.pf.d1, 0) / moved.length : null;
  const th = (k, l, cls) => `<th data-sort="${k}" class="${cls || ''}" style="cursor:pointer">${l}${s.sort === k ? (s.dir < 0 ? ' ▼' : ' ▲') : ''}</th>`;
  box.innerHTML = `<div class="grid" style="margin-bottom:14px"><div class="tile"><div class="lbl">Shown</div><div class="big">${rows.length.toLocaleString()}</div></div><div class="tile"><div class="lbl">Up / down today</div><div class="big"><span class="up">${adv}</span> / <span class="down">${dec}</span></div></div><div class="tile"><div class="lbl">Average 1D move</div><div class="big">${chgCell(avg)}</div></div></div>
    <table class="scr"><tr><th></th>${th('name', 'Item')}<th class="hm">Set</th>${th('price', 'Price', 'num')}${th('d1', '1D', 'num')}${th('d7', '7D', 'num hm')}${th('d30', '30D', 'num hm')}</tr>` +
    rows.slice(0, s.limit).map(r => `<tr data-open="${esc(r.id)}"><td>${starHtml(r.id)}</td><td><img loading="lazy" src="${esc(r.c.img)}" alt=""><b>${esc(cardTitle(r.c))}</b><div class="sub2" style="margin:0">${esc(r.c.r || (r.c.k ? 'Sealed' : ''))}${r.c.num ? ' · #' + esc(r.c.num) : ''}</div></td><td class="hm">${esc(r.c.s)}</td><td class="num"><b>${usd(r.price)}</b></td><td class="num">${chgCell(r.c.pf.d1)}</td><td class="num hm">${chgCell(r.c.pf.d7)}</td><td class="num hm">${chgCell(r.c.pf.d30)}</td></tr>`).join('') +
    `</table>${rows.length > s.limit ? `<p style="text-align:center"><button id="smore">Show ${Math.min(100, rows.length - s.limit)} more</button></p>` : ''}<p class="note">Tap an item for its chart, outlook and your sold prices. Changes (1D/7D/30D) fill in as PokéTicker collects daily history.</p>`;
  box.querySelectorAll('th[data-sort]').forEach(h => h.onclick = () => { const k = h.dataset.sort; if (s.sort === k) s.dir *= -1; else { s.sort = k; s.dir = k === 'name' ? 1 : -1; } drawMarket(); });
  const more = box.querySelector('#smore'); if (more) more.onclick = () => { s.limit += 100; drawMarket(); };
}

// ---------- Eras & Sets (with set completion) ----------
function renderSets(v) {
  if (needPrices(v)) return;
  const bySet = {}; getRows().forEach(r => (bySet[r.c.sid] ||= []).push(r));
  const grouped = {}; state.sets.forEach(s => (grouped[s.series] ||= []).push(s));
  const nowStr = today(), isOpen = (key, dflt) => key in state.open ? state.open[key] : dflt;
  let html = `${back()}<p class="intro">Every era and set, newest first. Open a set for its top cards and a rarity breakdown, and tick the cards you own to track completion and what the rest would cost.</p>`, first = true;
  for (const label of ERA_ORDER) {
    const list = grouped[label]; if (!list) continue;
    list.sort((x, y) => y.date.localeCompare(x.date));
    const years = [...new Set(list.map(s => s.date.slice(0, 4)))].sort(), yr = years.length > 1 ? years[0] + '–' + years[years.length - 1] : years[0], eraRows = list.flatMap(s => bySet[s.id] || []).filter(r => !r.c.k), idx = eraRows.length ? groupIndex(eraRows.map(r => r.id)) : null;
    const open = isOpen('era:' + label, first && eraRows.length > 0); if (eraRows.length) first = false;
    html += `<div class="era" data-toggle="era:${esc(label)}"><b>${open ? '▾' : '▸'} ${esc(label)}</b><span class="flat">${list.length} sets · ${yr}</span><span class="sp"></span><span class="flat">${eraRows.length.toLocaleString()} cards</span>${idx ? `<span>Top-10 value <b>${usd(idx.value)}</b> ${chgCell(idx.chg)}</span>` : ''}</div>`;
    if (!open) continue;
    html += `<table><tr><th>Set</th><th class="hm">Released</th><th class="num">Cards</th><th>Status</th><th class="num">Top card</th><th class="num hm">Top-10 value</th><th class="num hm">1D</th></tr>`;
    for (const s of list) {
      const rs = (bySet[s.id] || []), cards = rs.filter(r => !r.c.k), upcoming = s.date > nowStr, top = cards.length ? cards.reduce((m, r) => r.price > m.price ? r : m) : null, ix = cards.length ? groupIndex(cards.map(r => r.id)) : null, sopen = isOpen('set:' + s.id, false);
      html += `<tr class="tabrow" data-toggle="set:${esc(s.id)}"><td>${sopen ? '▾' : '▸'} <b>${esc(s.name)}</b></td><td class="hm">${esc(s.date)}</td><td class="num">${cards.length}</td><td>${upcoming ? '<span class="pill">Upcoming</span>' : cards.length ? '<span class="pill up">Priced</span>' : '<span class="pill">No prices</span>'}</td><td class="num">${top ? usd(top.price) : '—'}</td><td class="num hm">${ix ? usd(ix.value) : '—'}</td><td class="num hm">${ix ? chgCell(ix.chg) : '—'}</td></tr>`;
      if (sopen) html += `<tr><td colspan="7"><div class="setdetail">${setDetailHtml(s, rs)}</div></td></tr>`;
    }
    html += '</table>';
  }
  v.innerHTML = html;
  v.querySelectorAll('[data-own]').forEach(cb => cb.onchange = () => { const [gid, pid] = cb.dataset.own.split(':'); const o = (state.owned[gid] ||= {}); if (cb.checked) o[pid] = true; else delete o[pid]; store.set('pt_owned', state.owned); renderSets(v); });
}
function setDetailHtml(s, rs) {
  const cards = rs.filter(r => !r.c.k), sealed = rs.filter(r => r.c.k);
  if (!cards.length && !sealed.length) return '<div class="empty">No prices published for this set yet.</div>';
  const byR = {}; cards.forEach(r => (byR[r.c.r || 'Unknown'] ||= []).push(r));
  const rar = Object.entries(byR).map(([k, x]) => ({ k, n: x.length, avg: x.reduce((t, r) => t + r.price, 0) / x.length, max: Math.max(...x.map(r => r.price)) })).sort((a, b) => b.max - a.max);
  const cap = cards.reduce((t, r) => t + r.price, 0), gid = s.gid, own = state.owned[gid] || {};
  // one line per card (not per variant): use the cheapest variant as what a regular copy costs
  const byPid = {}; cards.forEach(r => { const cur = byPid[r.c.pid]; if (!cur || r.price < cur.price) byPid[r.c.pid] = r; });
  const uniq = Object.values(byPid).sort((a, b) => (parseInt(normNum(a.c.num), 10) || 0) - (parseInt(normNum(b.c.num), 10) || 0));
  const have = uniq.filter(r => own[r.c.pid]), missing = uniq.filter(r => !own[r.c.pid]), cost = missing.reduce((t, r) => t + r.price, 0);
  return `<div style="margin-bottom:10px"><span class="stat"><b>${usd(cap)}</b>sum of all card prices</span><span class="stat"><b>${cards.length}</b>priced cards</span>${sealed.length ? `<span class="stat"><b>${sealed.length}</b>sealed products</span>` : ''}</div>
    <div class="cols"><div><h2>Rarity breakdown</h2><table><tr><th>Rarity</th><th class="num">Cards</th><th class="num">Avg</th><th class="num">Top</th></tr>${rar.map(x => `<tr><td>${esc(x.k)}</td><td class="num">${x.n}</td><td class="num">${usd(x.avg)}</td><td class="num">${usd(x.max)}</td></tr>`).join('')}</table></div>
      <div><h2>Top cards</h2>${[...cards].sort((a, b) => b.price - a.price).slice(0, 8).map(r => rowHtml(r)).join('')}</div></div>
    <h2 style="margin-top:14px">Set completion — ${have.length} of ${uniq.length} owned${uniq.length ? ` (${(have.length / uniq.length * 100).toFixed(0)}%)` : ''}</h2><div class="bar"><div style="width:${uniq.length ? (have.length / uniq.length * 100).toFixed(1) : 0}%"></div></div>
    <div class="sub2" style="margin-top:6px">Cost to finish at today’s cheapest prices: <b>${usd(cost)}</b></div>
    <details><summary class="sub2" style="cursor:pointer">Tick the cards I own (${uniq.length})</summary><div style="columns:2 220px;margin-top:8px">${uniq.map(r => `<label class="sub2" style="display:block;margin:0 0 4px"><input type="checkbox" data-own="${esc(gid)}:${esc(r.c.pid)}"${own[r.c.pid] ? ' checked' : ''} style="width:auto"> #${esc(r.c.num || '—')} ${esc(r.c.n)} · ${usd(r.price)}</label>`).join('')}</div></details>`;
}

// ---------- Backup & Security ----------
function renderSettings(v) {
  const lock = lockOn(), last = store.get('pt_lastbackup', 0), snaps = store.get('pt_autobak', []), eng = state.eng;
  v.innerHTML = `${back()}<h2>Backup &amp; restore</h2>
    <p class="intro">Your cards, sold prices and shop records live <b>only on this device</b>. A backup file is your safety net. ${last ? `Last backup: ${new Date(last).toLocaleDateString()}.` : '<b>No backup yet.</b>'}</p>
    <div class="popform"><label class="sub2"><input type="checkbox" id="bkpw" style="width:auto"> Protect with a password (recommended if you email it or save it to the cloud)</label></div>
    <div class="popform"><input type="password" id="bkpass" placeholder="Backup password" autocomplete="new-password" style="max-width:240px"><button class="primary" id="bkshare">Share / save backup</button><button id="bkdl">Download file</button></div>
    <div class="sub2" id="bkmsg"></div>
    <div class="popform" style="margin-top:10px"><label class="sub2">Restore from a backup file: <input type="file" id="bkrest" accept=".json,application/json"></label></div>
    <div id="bkrestpw" class="popform" hidden><input type="password" id="bkrestpass" placeholder="Password for this backup" autocomplete="off" style="max-width:240px"><button id="bkrestgo">Decrypt &amp; restore</button></div>
    ${snaps.length ? `<details style="margin-top:10px"><summary class="sub2" style="cursor:pointer">Automatic safety copies (${snaps.length})</summary>${snaps.map((s, i) => `<div class="sub2">${new Date(s.t).toLocaleString()} <button data-snap="${i}" style="padding:2px 8px">Restore this</button></div>`).join('')}<div class="sub2">Kept inside the app; a restore also saves a fresh copy first, so you can undo it.</div></details>` : ''}
    <h2 style="margin-top:22px">App lock</h2>
    <p class="intro">${lock ? 'A PIN is set. PokéTicker locks when you leave it for the time below.' : 'Optional: ask for a PIN when you open PokéTicker.'} This keeps people who pick up your phone out; it doesn’t encrypt the data stored on the device, so keep your phone’s own screen lock on too.</p>
    <div class="popform"><input type="password" id="pin1" inputmode="numeric" maxlength="12" placeholder="${lock ? 'New PIN' : 'Choose a PIN (4–12 digits)'}" autocomplete="new-password" style="max-width:200px"><input type="password" id="pin2" inputmode="numeric" maxlength="12" placeholder="Repeat PIN" autocomplete="new-password" style="max-width:200px"><button id="pinset" class="primary">${lock ? 'Change PIN' : 'Turn on lock'}</button>${lock ? '<button id="pinoff" class="danger">Turn off</button>' : ''}</div>
    ${lock ? `<div class="popform"><label class="sub2">Lock after leaving the app for <select id="lockmin">${[[0, 'right away'], [1, '1 minute'], [5, '5 minutes'], [15, '15 minutes'], [60, '1 hour']].map(([m, l]) => `<option value="${m}"${prefs.lockMin === m ? ' selected' : ''}>${l}</option>`).join('')}</select></label></div>` : ''}
    <div class="sub2" id="pinmsg2"></div>
    <h2 style="margin-top:22px">Privacy</h2>
    <p class="intro">The 👁 button at the top hides your dollar amounts (handy at card shows or for screenshots). Nothing you type — cards, costs, sales — is ever sent anywhere; PokéTicker only downloads the public price files.</p>
    <h2 style="margin-top:22px">Security checklist</h2>
    <ul class="intro" style="padding-left:18px;max-width:none"><li>Turn on <b>two-step sign-in (2FA)</b> for your GitHub account. This app is served from it, so protecting that account protects the app.</li><li>Keep your phone’s screen lock on, and use a <b>password-protected backup</b> before emailing or uploading one.</li><li>Back up after big changes (new purchases, a show weekend).</li><li>Only restore backup files you made yourself.</li></ul>
    <h2 style="margin-top:22px">Price data</h2>
    <p class="intro" style="max-width:none">${eng ? `Latest prices: <b>${fmtDay(eng.date)}</b> (built ${new Date(eng.updated).toLocaleString()}), ${state.sets.length} sets, ${Object.keys(state.cards).length.toLocaleString()} items.` : 'No prices loaded yet.'} A free daily job on GitHub collects TCGplayer market prices (via tcgcsv.com) and keeps the history that powers charts and outlooks.</p>
    <h2 style="margin-top:22px">Erase everything</h2>
    <p class="intro">Deletes your cards, sold prices, shop records and settings from this device. Make a backup first.</p>
    <div class="popform"><input type="text" id="erase" placeholder="Type ERASE to confirm" style="max-width:220px" autocomplete="off"><button class="danger" id="erasego">Erase my data</button></div>`;
  const msg = (t, bad) => { const m = $('bkmsg'); m.textContent = t; m.className = 'sub2 ' + (bad ? 'down' : 'up'); };
  const password = () => { if (!$('bkpw').checked) return null; const p = $('bkpass').value; if (p.length < 6) throw new Error('Choose a password of at least 6 characters.'); return p; };
  const backup = async share => { try { await saveBackup(password(), share); msg(share ? 'Backup ready.' : 'Backup downloaded.'); render(); } catch (e) { if (e.name !== 'AbortError') msg(e.message, true); } };
  $('bkshare').onclick = () => backup(true); $('bkdl').onclick = () => backup(false);
  let pending = null;
  const restore = async (text, pw) => { try { await restoreFromText(text, pw); relinkByFields(); savePort(); saveComps(); saveWl(); toast('Backup restored.'); state.tab = 'home'; render(); } catch (e) { if (e.needPassword) { pending = text; $('bkrestpw').hidden = false; msg('This backup is password-protected — enter its password.'); } else msg(e.message, true); } };
  $('bkrest').onchange = async e => { const f = e.target.files[0]; if (f) await restore(await f.text()); };
  $('bkrestgo').onclick = () => restore(pending, $('bkrestpass').value);
  v.querySelectorAll('[data-snap]').forEach(b => b.onclick = async () => { const s = store.get('pt_autobak', [])[+b.dataset.snap]; if (s) await restore(s.d); });
  $('pinset').onclick = async () => { const a = $('pin1').value, b = $('pin2').value, m = $('pinmsg2'); if (!/^\d{4,12}$/.test(a)) { m.textContent = 'Use 4 to 12 digits.'; m.className = 'sub2 down'; return; } if (a !== b) { m.textContent = 'The two PINs don’t match.'; m.className = 'sub2 down'; return; } await setPin(a); $('lockbtn').hidden = false; toast('Lock is on.'); renderSettings(v); };
  const off = $('pinoff'); if (off) off.onclick = () => { if (off.dataset.arm === '1') { store.del('pt_lock'); $('lockbtn').hidden = true; renderSettings(v); } else { off.dataset.arm = '1'; off.textContent = 'Tap again to turn off'; } };
  const lm = $('lockmin'); if (lm) lm.onchange = () => { prefs.lockMin = +lm.value; savePrefs(); };
  $('erasego').onclick = () => {
    if ($('erase').value.trim() !== 'ERASE') { toast('Type ERASE (capital letters) first.'); return; }
    snapshotNow(); ['pt_lots', 'pt_sales', 'pt_expenses', 'pt_porthist', 'pt_comps', 'pt_pop', 'pt_watch', 'pt_targets', 'pt_owned', 'pt_preds', 'pt_prefs'].forEach(k => store.del(k));
    initState(); if (store.get('pt_latest', null)) applyLatest(store.get('pt_latest')); state.tab = 'home'; render(); toast('Your data was erased. A safety copy is still in Backup & Security.');
  };
}

// ---------- CSV import (Collectr / Card Ladder) ----------
function parseCsv(text) {
  text = text.replace(/^﻿/, ''); const first = text.split(/\r?\n/)[0] || '';
  const delim = [',', '\t', ';'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], f = '', q = false;
  const endRow = () => { row.push(f); f = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true; else if (ch === delim) { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; endRow(); } else f += ch;
  }
  endRow(); return rows;
}
const COLS = {
  name: ['product name', 'card name', 'name', 'card', 'item', 'description', 'title', 'product'], set: ['set name', 'set', 'series', 'group', 'expansion', 'category'],
  num: ['card number', 'number', 'card #', '#', 'no', 'card no'], qty: ['quantity', 'qty', 'count', 'owned', 'amount'],
  value: ['market price', 'market value', 'current value', 'current price', 'estimated value', 'latest price', 'price', 'value', 'market', 'current'],
  cost: ['purchase price', 'price bought', 'bought price', 'bought', 'acquisition price', 'price paid', 'cost basis', 'cost', 'paid', 'purchase cost', 'buy price'],
  grade: ['grade', 'grading', 'condition', 'grade company', 'grader'], variance: ['variance', 'variant', 'printing', 'finish'],
  override: ['price override', 'override'], date: ['date added', 'date purchased', 'purchase date', 'date bought', 'date acquired']
};
function mapHeaders(h) {
  const lc = h.map(x => x.trim().toLowerCase()), m = {}, used = () => Object.values(m);
  for (const [k, names] of Object.entries(COLS)) for (const n of names) { const i = lc.indexOf(n); if (i >= 0 && !used().includes(i)) { m[k] = i; break; } }
  for (const [k, names] of Object.entries(COLS)) if (m[k] == null) for (const n of names) { if (n.length < 4) continue; const i = lc.findIndex((x, j) => x.includes(n) && !used().includes(j)); if (i >= 0) { m[k] = i; break; } }
  return m;
}
const toNum = x => { const n = parseFloat(String(x ?? '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; };
const itemKey = it => [it.name, it.set, it.num, it.grade].map(x => String(x || '').toLowerCase()).join('|');
function importCsv(text, src) {
  const rows = parseCsv(text); if (rows.length < 2) throw new Error('That file looks empty.');
  if (rows.length > 20000) throw new Error('That file is too large.');
  const m = mapHeaders(rows[0]); if (m.name == null) throw new Error('Couldn’t find a card-name column. Columns in the file: ' + rows[0].join(', '));
  const get = (r, k) => m[k] == null ? '' : (r[m[k]] ?? '').trim();
  const items = rows.slice(1).map(r => {
    const name = get(r, 'name'); if (!name) return null; const hashNum = (name.match(/#\s*([A-Za-z0-9-]+)/) || [])[1], grade = get(r, 'grade'), ov = toNum(get(r, 'override')), cost = toNum(get(r, 'cost')), d = get(r, 'date').slice(0, 10);
    return { name: name.slice(0, 200), set: get(r, 'set').slice(0, 200), num: normNum(get(r, 'num') || hashNum), variance: get(r, 'variance'), grade: /^ungraded$/i.test(grade) ? '' : grade.slice(0, 40),
      qty: Math.max(0, toNum(get(r, 'qty')) ?? 1) || 1, value: ov > 0 ? ov : toNum(get(r, 'value')), cost: cost > 0 ? cost : null, date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : today() };   // a 0 cost in an export means "not entered"
  }).filter(Boolean);
  if (!items.length) throw new Error('No card rows found in that file.');
  const oldCost = {}; for (const l of port.lots) if (l.src === src && l.cost != null) oldCost[itemKey(l)] = l.cost;
  port.lots = port.lots.filter(l => l.src !== src); let linked = 0;
  for (const it of items) {
    const cardId = findCard(it.name, it.num, it.set, it.variance); if (cardId) linked++;
    port.lots.push({ uid: uid(), cardId, name: it.name, set: it.set, num: it.num, grade: it.grade, qty: it.qty, cost: it.cost ?? oldCost[itemKey(it)] ?? null, val: it.value, pin: false, date: it.date, src, kind: 'card', status: 'hold', ask: null });
  }
  savePort();
  return { n: items.length, linked, mapped: Object.fromEntries(Object.entries(m).map(([k, i]) => [k, rows[0][i]])) };
}
