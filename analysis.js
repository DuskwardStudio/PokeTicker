'use strict';
// ===== PokéTicker analysis: prices, search, outlook, idea scores, sold-price comps, portfolio and shop math =====
const ERA_ORDER = ['Mega Evolution', 'Scarlet & Violet', 'Sword & Shield', 'Sun & Moon', 'XY', 'Black & White', 'HeartGold & SoulSilver', 'Diamond & Pearl / Platinum', 'EX Era (Ruby & Sapphire)', 'Wizards of the Coast Era', 'Promos & Other'];

// ---------- prices ----------
function getRows() {
  if (state.rows) return state.rows;
  const rows = []; for (const [id, c] of Object.entries(state.cards)) if (c.p > 0) rows.push({ id, c, price: c.p });
  state.rows = rows; return rows;
}
const latestPrice = id => { const c = state.cards[id]; return c ? c.p : null; };
function prevPrice(id) { const c = state.cards[id]; return c && c.pf && c.pf.d1 != null ? c.p / (1 + c.pf.d1 / 100) : null; }
const perfOf = (id, price, c) => { const f = (c || state.cards[id] || {}).pf || {}; return { d1: f.d1 ?? null, d7: f.d7 ?? null, d30: f.d30 ?? null, vol: f.vol ?? null, np: f.np || 0 }; };
const cardTitle = c => c.n + (c.sub ? ` · ${c.sub}` : '');
const ticker = (id, c) => (c.ab || c.sid.replace(/^g/, 'G')).toUpperCase() + '-' + String(c.num || c.pid).split('/')[0];
function searchCards(q, opts = {}) {
  const toks = String(q || '').toLowerCase().split(/\s+/).filter(Boolean); if (!toks.length) return [];
  const out = [];
  for (const r of getRows()) {
    const c = r.c; if (opts.kind != null && c.k !== opts.kind) continue;
    const h = c._h || (c._h = (c.n + ' ' + c.sub + ' ' + c.s + ' ' + c.num + ' ' + c.r).toLowerCase());
    let ok = true; for (const t of toks) if (!h.includes(t)) { ok = false; break; }
    if (ok) out.push(r);
  }
  const starts = r => r.c.n.toLowerCase().startsWith(toks[0]) ? 1 : 0;
  out.sort((x, y) => (starts(y) - starts(x)) || (y.price - x.price));
  return out.slice(0, opts.limit || 12);
}
function groupIndex(ids, k = 10) {   // value of the k priciest cards in a group, and its 1-day move
  const cur = ids.map(id => state.cards[id]).filter(c => c && c.p > 0).sort((a, b) => b.p - a.p).slice(0, k);
  if (!cur.length) return null;
  const now = cur.reduce((t, c) => t + c.p, 0), before = cur.reduce((t, c) => t + (c.pf.d1 != null ? c.p / (1 + c.pf.d1 / 100) : c.p), 0);
  return { value: now, chg: cur.some(c => c.pf.d1 != null) && before > 0 ? (now - before) / before * 100 : null };
}

// ---------- outlook: rough "what if I buy today" projections ----------
// A rule-of-thumb model, not a forecast anyone can guarantee. It combines (1) how old the set is, (2) this month's move, (3) your own
// sold-price log, and (4) how bumpy the price has been. Each day its top ideas are saved and graded later (the "track record").
const FAVS = /charizard|pikachu|umbreon|eevee|espeon|sylveon|vaporeon|jolteon|flareon|glaceon|leafeon|\bmew\b|mewtwo|gengar|lugia|rayquaza|gardevoir|greninja|lucario|mimikyu|dragonite|blastoise|venusaur|snorlax/i;
const CHASE_RAR = /special illustration|hyper|secret|ultra|illustration rare|shiny|gold|crown|ace spec|mega attack/i;
const releaseMs = c => c.rel ? new Date(c.rel + 'T12:00:00').getTime() : null;
function lifecycle(m, chase, sealed) {   // assumed typical monthly price drift for something of this age
  const t = sealed
    ? [[3, -0.03, 'brand-new product — sealed usually dips while it is still easy to find'], [12, -0.005, 'still in print — sealed prices usually stay flat'], [24, 0.015, 'going out of print — sealed prices often start to climb'], [9999, 0.02, 'out of print for a while — sealed prices tend to keep rising']]
    : chase
      ? [[3, -0.04, 'brand-new set — chase cards usually slide as packs get opened'], [8, -0.015, 'a few months old — prices often keep easing toward a bottom'], [14, 0.005, 'about a year old — prices often bottom out around now'], [30, 0.015, 'older set nearing the end of its print run — prices often creep up'], [9999, 0.01, 'long out-of-print set — prices tend to rise slowly']]
      : [[3, -0.06, 'brand-new set — everyday cards usually lose value fast'], [8, -0.03, 'everyday cards keep losing value for the first months'], [14, -0.01, 'everyday cards rarely gain much'], [30, 0, 'everyday cards stay flat'], [9999, 0.003, 'everyday cards barely move']];
  for (const [lim, d, txt] of t) if (m < lim) return { d, txt };
}
function outlook(id, price, c, pf) {
  if (!(price > 0)) return null;
  const why = [], rel = releaseMs(c), sealed = !!c.k, chase = !sealed && (CHASE_RAR.test(c.r || '') || price >= 25);
  let drift = 0;
  if (rel) { const lc = lifecycle(Math.max(0, (Date.now() - rel) / (30.44 * DAY)), chase, sealed); drift = lc.d; why.push(lc.txt); }
  if (chase && FAVS.test(c.n)) { drift += 0.005; why.push('fan-favorite Pokémon'); }
  const d30 = pf.d30 != null ? Math.max(-30, Math.min(30, pf.d30)) / 100 : 0;
  if (Math.abs(d30) >= 0.05) why.push(d30 > 0 ? `up ${(d30 * 100).toFixed(0)}% this month — momentum can carry a bit further` : `down ${(-d30 * 100).toFixed(0)}% this month — could be an entry point, or could keep sliding`);
  const fv = fairValue({ cardId: id, name: c.n, set: c.s, num: c.num }, 'Raw'); let pull = 0;
  if (fv && !fv.stale) { pull = Math.max(-0.3, Math.min(0.3, (fv.fv - price) / price)) * 0.5; if (Math.abs(pull) > 0.02) why.push(`your sold prices say it’s worth about ${usd(fv.fv)}`); }
  const own = pf.vol != null, vol = own ? Math.max(0.04, Math.min(0.6, pf.vol)) : (sealed ? 0.07 : chase ? 0.14 : 0.10);
  const out = { why, vol, quality: own && pf.np >= 14 ? 'fair' : 'rough' };
  for (const h of [30, 90, 180]) {
    const mo = h / 30, mom = d30 * (h === 30 ? 0.25 : h === 90 ? 0.12 : 0.06), r = Math.pow(1 + drift, mo) - 1 + mom + pull * (h === 30 ? 0.4 : 1), sg = vol * Math.sqrt(mo);
    out[h] = { pct: r * 100, base: price * (1 + r), lo: price * Math.max(0.05, 1 + r - sg), hi: price * (1 + r + sg) };
  }
  return out;
}
const outlookWord = p => p >= 8 ? ['May rise', 'up'] : p <= -8 ? ['May fall', 'down'] : ['Likely flat', 'flat'];

// ---------- idea score ----------
const IDEA_MIN = 28;   // below this a card is not worth showing as an idea
function scoreIdea(r) {
  const c = r.c, pf = perfOf(r.id, r.price, c), why = []; let score = 0;
  const { d1, d7, d30 } = pf;
  if (d30 != null && d30 <= -5) { score += Math.min(30, -d30); why.push(`${pct(d30)} vs 30D`); }
  if (d30 != null && d30 <= -10 && d1 != null && d1 >= 0) { score += 10; why.push('price stabilizing'); }
  let floor = null;
  if (c.pr && c.pr.l > 0) { floor = (r.price - c.pr.l) / r.price * 100; if (floor >= 15) { score += Math.min(15, floor / 3); why.push(`listings ${floor.toFixed(0)}% under market`); } }
  const fvc = fairValue({ cardId: r.id, name: c.n, set: c.s, num: c.num }, 'Raw');
  if (fvc && !fvc.stale && r.price < fvc.fv * 0.92) { const gap = (fvc.fv - r.price) / fvc.fv * 100; score += Math.min(35, gap * 1.2); why.push(`${gap.toFixed(0)}% below your sold prices (${usd(fvc.fv)})`); }
  const spike = (d1 != null && d1 > 35) || (d7 != null && d7 > 60);
  if (spike) { score -= 30; why.push('⚠ spiking — chasing risk'); }
  if (pf.np < 3) score *= 0.5;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const ol = outlook(r.id, r.price, c, pf), olScore = ol ? Math.max(0, Math.min(100, (ol[90].pct + 10) * 3)) : 0;
  const idea = Math.max(0, Math.round(0.55 * score + 0.45 * olScore - (spike ? 20 : 0)));
  return { ...r, pf, floor, spike, why, score, ol, idea };
}
// every day the top ideas and their guesses are saved, then graded after 30 and 90 days
function logPredictions() {
  if (!state.eng) return;
  const day = state.eng.date; if (preds.list.length && preds.list[preds.list.length - 1].d === day) return;
  const picks = getRows().filter(r => r.price >= 3 && !r.c.k).map(scoreIdea).sort((x, y) => y.idea - x.idea).slice(0, 40);
  for (const r of picks) preds.list.push({ d: day, id: r.id, p: r.price, p30: r.ol ? Math.round(r.ol[30].pct * 10) / 10 : null, p90: r.ol ? Math.round(r.ol[90].pct * 10) / 10 : null });
  preds.list = preds.list.slice(-4000); store.set('pt_preds', preds.list);
}
function trackRecord() {
  const out = { n30: 0, hit30: 0, n90: 0, hit90: 0, miss: [] }, now = Date.now();
  for (const p of preds.list) {
    const age = (now - new Date(p.d + 'T12:00:00').getTime()) / DAY, cur = latestPrice(p.id); if (cur == null || !(p.p > 0)) continue;
    const act = (cur - p.p) / p.p * 100;
    if (age >= 30 && p.p30 != null) { out.n30++; if ((p.p30 >= 0) === (act >= 0)) out.hit30++; out.miss.push(Math.abs(act - p.p30)); }
    if (age >= 90 && p.p90 != null) { out.n90++; if ((p.p90 >= 0) === (act >= 0)) out.hit90++; }
  }
  out.medMiss = out.miss.length ? median(out.miss) : null; return out;
}

// ---------- sold-price comps: your own price data ----------
const GRADES = ['Raw', 'PSA 10', 'PSA 9', 'PSA 8', 'PSA 7', 'PSA 6', 'PSA 5', 'BGS 10', 'BGS 9.5', 'BGS 9', 'CGC 10', 'CGC 9.5', 'CGC 9', 'SGC 10', 'SGC 9.5', 'TAG 10', 'ACE 10'];
const SOURCES = ['eBay', '130point', 'Card Ladder', 'PriceCharting', 'TCGplayer', 'Whatnot', 'Local / in person', 'Other'];
function gradeKey(g) { const m = String(g || '').match(/\b(PSA|BGS|CGC|SGC|TAG|ACE)\s*(\d+(?:\.\d)?)/i); return m ? `${m[1].toUpperCase()} ${m[2].replace(/\.0$/, '')}` : 'Raw'; }
const nkey = x => [x.name, x.set, normNum(x.num)].map(s => String(s || '').toLowerCase().trim()).join('|');
const sameCard = (a, b) => !!((a.cardId && a.cardId === b.cardId) || nkey(a) === nkey(b));
// fair value = median of your most recent sold comps (last 90 days if any, otherwise the latest ones, marked stale)
function fairValue(card, grade) {
  if (!comps || !comps.list.length) return null;
  const gk = gradeKey(grade), now = Date.now();
  const all = comps.list.filter(c => gradeKey(c.grade) === gk && sameCard(card, c)).sort((x, y) => y.date.localeCompare(x.date));
  if (!all.length) return null;
  const recent = all.filter(c => now - new Date(c.date + 'T12:00:00').getTime() <= 90 * DAY);
  const stale = recent.length < 1, use = (stale ? all : recent).slice(0, 7), prices = use.map(c => c.price);
  let trend = null;
  if (use.length >= 4) { const h = use.length >> 1, newer = median(prices.slice(0, h)), older = median(prices.slice(h)); if (older > 0) trend = (newer - older) / older * 100; }
  return { fv: median(prices), n: all.length, used: use.length, last: all[0], lo: Math.min(...prices), hi: Math.max(...prices), trend, stale, conf: use.length >= 5 ? 'high' : use.length >= 3 ? 'medium' : 'low' };
}
const MONTHS = 'JanFebMarAprMayJunJulAugSepOctNovDec';
function parseDateLoose(s) {
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad2(m[1])}-${pad2(m[2])}`;
  m = s.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?/i);
  if (m) {
    const mo = pad2(MONTHS.indexOf(m[1][0].toUpperCase() + m[1].slice(1, 3).toLowerCase()) / 3 + 1);
    const y = m[3] || String(new Date().getFullYear()); let iso = `${y}-${mo}-${pad2(m[2])}`;
    if (!m[3] && iso > today()) iso = `${+y - 1}-${mo}-${pad2(m[2])}`;
    return iso;
  }
  return null;
}
const DATE_RE = /\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?/gi;
// Understands one sale per line ("$412.50 10/15/2026") and also text copied from eBay's sold list ("Sold Oct 12, 2026 … PSA 10 … $1,299.00 … + $4.50 delivery").
function parseCompText(text) {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean), out = [];
  const gradeIn = s => { const m = s.match(/\b(PSA|BGS|CGC|SGC|TAG|ACE)\s*(\d+(?:\.\d)?)/i); return m ? gradeKey(m[0]) : null; };
  const isSoldHead = l => /^(sold|ended)\b/i.test(l) && parseDateLoose(l);
  const heads = lines.map((l, i) => isSoldHead(l) ? i : -1).filter(i => i >= 0);
  if (heads.length) {   // eBay-style blocks
    heads.forEach((h, k) => {
      const block = lines.slice(h, k + 1 < heads.length ? heads[k + 1] : lines.length).slice(0, 14), date = parseDateLoose(block[0]);
      let price = null, url = '';
      for (const l of block.slice(1)) {
        if (!url) { const u = l.match(/https?:\/\/\S+/); if (u) url = u[0]; }
        if (price == null) { const m = l.replace(/\+\s*\$[\d,.]+/g, ' ').match(/(?:^|\s)\$\s*([\d,]+(?:\.\d{1,2})?)/); if (m && !/shipping|delivery|postage/i.test(l.replace(m[0], ''))) price = parseFloat(m[1].replace(/,/g, '')); }
      }
      if (price > 0) out.push({ price, date: date <= today() ? date : today(), url, grade: gradeIn(block.join(' ')) });
    });
    if (out.length) return out;
  }
  for (const raw of lines) {   // one sale per line
    let line = raw; const url = (line.match(/https?:\/\/\S+/) || [''])[0]; line = line.replace(/https?:\/\/\S+/g, ' ');
    const date = parseDateLoose(line), grade = gradeIn(line); line = line.replace(DATE_RE, ' ');
    const pmatch = line.match(/\$\s*([\d,]+(?:\.\d{1,2})?)/) || line.match(/(\d[\d,]*(?:\.\d{1,2})?)/);
    const price = pmatch ? parseFloat(pmatch[1].replace(/,/g, '')) : NaN;
    if (price > 0) out.push({ price, date: date && date <= today() ? date : today(), url, grade });
  }
  return out;
}
function addComp(item, grade, price, date, source, url, note) {
  comps.list.push({ uid: uid(), cardId: item.cardId || null, name: item.name, set: item.set || '', num: item.num || '', grade: gradeKey(grade), price, date, source: source || 'Other', url: url || '', note: note || '' });
}

// ---------- portfolio ----------
function lotVal(l) {                 // your sold comps first (unless you pinned a value), then a typed/imported value, then the live price
  if (!l.pin) { const f = fairValue(l, l.grade); if (f && !f.stale) return { v: f.fv, src: 'comps', n: f.used }; }
  if (l.val != null) return { v: l.val, src: 'manual' };
  if (l.cardId) { const p = latestPrice(l.cardId); if (p != null) return { v: p, src: 'live' }; }
  return { v: null, src: null };
}
const lotEra = l => { const c = l.cardId && state.cards[l.cardId]; return c ? (c.k ? 'Sealed product' : c.ser) : (l.kind === 'sealed' ? 'Sealed product' : 'Other / unlinked'); };
function portSummary(filter) {
  let value = 0, invested = 0, plCost = 0, plVal = 0, day = 0, dayBase = 0, unpriced = 0, noCost = 0;
  const rows = port.lots.filter(filter || (() => true)).map(l => {
    const lv = lotVal(l), v = lv.v, hasCost = l.cost != null, costT = (l.cost || 0) * l.qty, valT = v == null ? null : v * l.qty;
    if (valT == null) unpriced++; else value += valT;
    if (hasCost) invested += costT; else noCost++;
    if (valT != null && hasCost) { plCost += costT; plVal += valT; }
    let dchg = null;
    if (lv.src === 'live' && l.cardId) { const pp = prevPrice(l.cardId), cp = latestPrice(l.cardId); if (pp != null && cp != null) { dchg = (cp - pp) * l.qty; day += dchg; dayBase += pp * l.qty; } }
    const pl = valT != null && hasCost ? valT - costT : null;
    return { l, v, src: lv.src, n: lv.n, costT, valT, pl, plPct: pl != null && costT > 0 ? pl / costT * 100 : null, dchg };
  });
  const realized = port.sales.reduce((t, s) => t + saleProfit(s), 0);
  return { rows, value, invested, unreal: plVal - plCost, unrealPct: plCost > 0 ? (plVal - plCost) / plCost * 100 : null, day, dayPct: dayBase > 0 ? day / dayBase * 100 : null, realized, unpriced, noCost };
}
function recordPort(s) {
  if (!port.lots.length) return; s = s || portSummary();
  const last = port.hist[port.hist.length - 1];
  if (last && last.d === today() && last.value === s.value && last.invested === s.invested) return;
  port.hist = port.hist.filter(x => x.d !== today()); port.hist.push({ d: today(), value: Math.round(s.value * 100) / 100, invested: Math.round(s.invested * 100) / 100 });
  port.hist = port.hist.slice(-1500); savePort();
}

// ---------- shop: sales, expenses ----------
const CHANNELS = ['eBay', 'TCGplayer', 'Whatnot', 'In person / card show', 'My website', 'Facebook / Discord', 'Other'];
const EXP_CATS = ['Shipping supplies', 'Postage', 'Grading fees', 'Card show / table fees', 'Travel', 'Software / subscriptions', 'Equipment', 'Other'];
const saleRevenue = s => (s.price || 0) * s.qty;
const saleProfit = s => s.cost != null ? saleRevenue(s) - s.cost * s.qty - (s.fee || 0) - (s.ship || 0) : 0;
const monthOf = d => String(d || '').slice(0, 7);
function shopReport(month) {   // month = 'YYYY-MM' or '' for all time
  const sales = port.sales.filter(s => !month || monthOf(s.date) === month), exp = port.exp.filter(e => !month || monthOf(e.date) === month);
  const rev = sales.reduce((t, s) => t + saleRevenue(s), 0), cogs = sales.reduce((t, s) => t + (s.cost || 0) * s.qty, 0), fees = sales.reduce((t, s) => t + (s.fee || 0), 0), ship = sales.reduce((t, s) => t + (s.ship || 0), 0);
  const expenses = exp.reduce((t, e) => t + (e.amount || 0), 0), net = rev - cogs - fees - ship - expenses;
  const byChannel = {}; sales.forEach(s => { const k = s.channel || 'Other'; (byChannel[k] ||= { n: 0, rev: 0, profit: 0 }); byChannel[k].n += s.qty; byChannel[k].rev += saleRevenue(s); byChannel[k].profit += saleProfit(s); });
  const unknownCost = sales.filter(s => s.cost == null).length;
  return { sales, exp, rev, cogs, fees, ship, expenses, net, margin: rev > 0 ? net / rev * 100 : null, byChannel, unknownCost, units: sales.reduce((t, s) => t + s.qty, 0) };
}
