#!/usr/bin/env python3
"""PokéTicker price engine.

Runs once a day in GitHub Actions (or by hand). It downloads every Pokémon set's products and prices from
tcgcsv.com (a daily copy of TCGplayer's catalog), keeps a rolling price history, works out 1/7/30-day changes
and a volatility figure, and writes small JSON files the app loads:

    latest.json        every card / sealed product with its current price and recent changes
    hist/<set>.json    daily price history per set (loaded only when a card page is opened)
    meta.json          when the data was produced, counts, source timestamp

Only the standard library is used, so it runs anywhere with Python 3.8+.
Be polite to the source: identifiable User-Agent, ~250 ms between requests, once per day.
"""
import argparse, datetime, json, math, os, re, sys, time, urllib.error, urllib.request

UA = 'PokeTicker/1.0 (personal price tracker; +https://github.com/DuskwardStudio/PokeTicker)'
BASE = 'https://tcgcsv.com/tcgplayer/3'          # category 3 = Pokémon
MIN_CARD = 0.25                                  # ignore card rows cheaper than this (noise)
HIST_MIN = 1.00                                  # keep price history for rows worth at least this
HIST_DAYS = 400                                  # rolling history window
FIELDS = ['id', 's', 'n', 'num', 'r', 'k', 'sub', 'p', 'l', 'm', 'h', 'd1', 'd7', 'd30', 'vol', 'np']

PROMO_RE = re.compile(r"promo|trainer kit|jumbo|mcdonald|battle academy|prize pack|trick or trade|kids wb|pop series|"
                      r"world championship|league|deck exclusives|blister exclusives|burger king|first partner|"
                      r"miscellaneous|energies|my first battle|classic$|southeast asia|sample|countdown|player placement|"
                      r"nintendo|alternate art|professor program|pikachu world", re.I)
SUB_CODES = {'normal': 'n', 'holofoil': 'h', 'reverse holofoil': 'r', '1st edition': '1', '1st edition holofoil': '1h',
             'unlimited': 'u', 'unlimited holofoil': 'uh', '1st edition normal': '1n'}


def log(*a):
    print(*a, flush=True)


def fetch(url, tries=4, pause=0.25, as_text=False):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read()
            time.sleep(pause)
            return raw.decode('utf-8', 'replace').strip() if as_text else json.loads(raw)
        except Exception as e:  # network hiccup, 5xx, bad JSON ...
            last = e
            time.sleep(2 * (i + 1))
    raise RuntimeError('%s: %s' % (url, last))


def era_of(date, name):
    """Group a set into the eras PokéTicker shows (by release date; promo-style sets go to 'Promos & Other')."""
    if PROMO_RE.search(name):
        return 'Promos & Other'
    d = (date or '')[:10]
    for limit, era in (('2003-06-01', 'Wizards of the Coast Era'), ('2007-04-01', 'EX Era (Ruby & Sapphire)'),
                       ('2009-12-01', 'Diamond & Pearl / Platinum'), ('2011-03-01', 'HeartGold & SoulSilver'),
                       ('2013-12-01', 'Black & White'), ('2016-12-01', 'XY'), ('2019-11-01', 'Sun & Moon'),
                       ('2023-03-01', 'Sword & Shield'), ('2025-09-01', 'Scarlet & Violet')):
        if d < limit:
            return era
    return 'Mega Evolution'


def sub_code(sub):
    s = (sub or '').strip().lower()
    return SUB_CODES.get(s) or (re.sub(r'[^a-z0-9]', '', s)[:6] or 'x')


def rnd(x, n=2):
    return None if x is None else round(float(x), n)


def load_json(path, default):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default


def dump_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, separators=(',', ':'), ensure_ascii=False)


# ---------- history math ----------
def pct_change(series, dates, today_idx, days):
    """% change between the latest value and the value `days` days earlier (nearest older point)."""
    cur = series[today_idx]
    if cur is None:
        return None
    t_today = datetime.date.fromisoformat(dates[today_idx])
    for j in range(today_idx - 1, -1, -1):
        v = series[j]
        if v is None or v <= 0:
            continue
        age = (t_today - datetime.date.fromisoformat(dates[j])).days
        if age >= days:
            return round((cur - v) / v * 100, 1)
    return None


def volatility(series, dates):
    rs = []
    prev_v, prev_t = None, None
    for v, d in zip(series, dates):
        if v is None or v <= 0:
            continue
        t = datetime.date.fromisoformat(d)
        if prev_v:
            dt = max(1, (t - prev_t).days)
            rs.append(math.log(v / prev_v) / math.sqrt(dt))
        prev_v, prev_t = v, t
    if len(rs) < 5:
        return None
    mean = sum(rs) / len(rs)
    sd = math.sqrt(sum((x - mean) ** 2 for x in rs) / (len(rs) - 1))
    return round(max(0.04, min(0.6, sd * math.sqrt(30))), 3)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--prev', default='prev', help='folder holding the previous run (meta.json, hist/)')
    ap.add_argument('--out', default='out', help='folder to write the new files into')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--limit-groups', type=int, default=0, help='testing: only process N sets')
    args = ap.parse_args()

    src_updated = fetch('https://tcgcsv.com/last-updated.txt', as_text=True)
    prev_meta = load_json(os.path.join(args.prev, 'meta.json'), {})
    if prev_meta.get('srcUpdated') == src_updated and not args.force:
        log('Source unchanged since the last run (%s). Nothing to do.' % src_updated)
        os.makedirs(args.out, exist_ok=True)
        open(os.path.join(args.out, '.skip'), 'w').close()
        return 0
    data_date = src_updated[:10]                       # the day these prices describe (UTC)
    log('Source updated %s -> building snapshot for %s' % (src_updated, data_date))

    groups = fetch(BASE + '/groups')['results']
    groups.sort(key=lambda g: (g.get('publishedOn') or '', g['groupId']))
    if args.limit_groups:
        groups = groups[-args.limit_groups:]

    sets, items, hist_files, n_hist_points = [], [], {}, 0
    for gi, g in enumerate(groups):
        gid = g['groupId']
        try:
            products = {p['productId']: p for p in fetch('%s/%d/products' % (BASE, gid))['results']}
            prices = fetch('%s/%d/prices' % (BASE, gid))['results']
        except Exception as e:
            log('  skip group %s (%s): %s' % (gid, g['name'], str(e)[:100]))
            continue
        by_pid = {}
        for row in prices:
            if row.get('marketPrice'):
                by_pid.setdefault(row['productId'], []).append(row)
        rel = (g.get('publishedOn') or '')[:10]
        set_idx = len(sets)
        group_items = []
        for pid, rows in by_pid.items():
            p = products.get(pid)
            if not p:
                continue
            ext = {e['name']: e['value'] for e in p.get('extendedData', [])}
            number, rarity = ext.get('Number', ''), ext.get('Rarity', '')
            is_card = bool(number)
            if not is_card and p['name'].startswith('Code Card'):
                continue
            for r in rows:
                m = r['marketPrice']
                if is_card and m < MIN_CARD:
                    continue
                sub = r.get('subTypeName') or ''
                low = r.get('lowPrice')
                if low is not None and low > m * 1.02:    # a "lowest listing" above the market price is a data quirk
                    low = None
                item_id = '%d-%s' % (pid, sub_code(sub))
                group_items.append({
                    'id': item_id, 's': set_idx, 'n': p['name'], 'num': number, 'r': rarity, 'k': 0 if is_card else 1,
                    'sub': sub if len(rows) > 1 else '', 'p': rnd(m), 'l': rnd(low), 'm': rnd(r.get('midPrice')), 'h': rnd(r.get('highPrice')),
                })
        if not group_items:
            sets.append({'id': 'g%d' % gid, 'n': g['name'], 'a': g.get('abbreviation') or '', 'd': rel, 'e': era_of(rel, g['name']), 'c': 0})
            continue

        # ---- history shard for this set ----
        shard = load_json(os.path.join(args.prev, 'hist', '%d.json' % gid), {'d': [], 's': {}})
        dates, series = shard.get('d', []), shard.get('s', {})
        if dates and dates[-1] == data_date:
            dates = dates[:-1]
            for k in series:
                series[k] = series[k][:-1]
        # (re)extend every existing series to the new date
        today_vals = {it['id']: it['p'] for it in group_items}
        dates.append(data_date)
        for k in list(series):
            series[k].append(today_vals.get(k))
        for it in group_items:
            if it['id'] not in series and it['p'] >= HIST_MIN:
                series[it['id']] = [None] * (len(dates) - 1) + [it['p']]
        # trim the window and drop dead series
        if len(dates) > HIST_DAYS:
            cut = len(dates) - HIST_DAYS
            dates = dates[cut:]
            for k in series:
                series[k] = series[k][cut:]
        series = {k: v for k, v in series.items() if any(x is not None for x in v[-45:])}
        ti = len(dates) - 1
        for it in group_items:
            s = series.get(it['id'])
            np_ = sum(1 for x in s if x is not None) if s else 0
            it['d1'] = pct_change(s, dates, ti, 1) if s else None
            it['d7'] = pct_change(s, dates, ti, 7) if s else None
            it['d30'] = pct_change(s, dates, ti, 30) if s else None
            it['vol'] = volatility(s, dates) if s else None
            it['np'] = np_
        if series:
            hist_files[gid] = {'d': dates, 's': {k: [rnd(x) for x in v] for k, v in series.items()}}
            n_hist_points += sum(len(v) for v in series.values())
        sets.append({'id': 'g%d' % gid, 'n': g['name'], 'a': g.get('abbreviation') or '', 'd': rel, 'e': era_of(rel, g['name']), 'c': len(group_items)})
        items.extend(group_items)
        if (gi + 1) % 25 == 0:
            log('  %d/%d sets, %d items' % (gi + 1, len(groups), len(items)))

    if not items:
        log('No items produced — refusing to publish an empty snapshot.')
        return 2

    latest = {'v': 2, 'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'srcUpdated': src_updated, 'date': data_date,
              'sets': sets, 'f': FIELDS, 'i': [[it.get(f) for f in FIELDS] for it in items]}
    os.makedirs(args.out, exist_ok=True)
    dump_json(os.path.join(args.out, 'latest.json'), latest)
    for gid, shard in hist_files.items():
        dump_json(os.path.join(args.out, 'hist', '%d.json' % gid), shard)
    meta = {'updated': latest['updated'], 'srcUpdated': src_updated, 'date': data_date, 'sets': len(sets), 'items': len(items),
            'histSets': len(hist_files), 'histPoints': n_hist_points, 'source': 'tcgcsv.com (TCGplayer market prices, USD)'}
    dump_json(os.path.join(args.out, 'meta.json'), meta)
    log('Done: %d sets, %d items, %d history series points. latest.json = %.1f KB' % (len(sets), len(items), n_hist_points, os.path.getsize(os.path.join(args.out, 'latest.json')) / 1024))

    # ---- optional phone digest through ntfy.sh (only when NTFY_TOPIC is set as a secret) ----
    topic = os.environ.get('NTFY_TOPIC', '').strip()
    if topic:
        try:
            movers = [(it['d1'], it) for it in items if it.get('d1') is not None and it['p'] >= 10 and it['np'] >= 2 and it['k'] == 0]
            movers.sort(key=lambda x: x[0])
            lines = []
            for ch, it in reversed(movers[-5:]):
                lines.append('UP %+.0f%%  %s  $%.2f (%s)' % (ch, it['n'], it['p'], sets[it['s']]['n']))
            for ch, it in movers[:5]:
                lines.append('DOWN %+.0f%%  %s  $%.2f (%s)' % (ch, it['n'], it['p'], sets[it['s']]['n']))
            if lines:
                req = urllib.request.Request('https://ntfy.sh/' + topic, data='\n'.join(lines).encode('utf-8'),
                                             headers={'Title': 'PokeTicker daily movers (%s)' % data_date, 'Tags': 'chart_with_upwards_trend', 'User-Agent': UA})
                urllib.request.urlopen(req, timeout=30).read()
                log('Sent daily digest to ntfy.')
        except Exception as e:
            log('ntfy digest failed (ignored): %s' % e)
    return 0


if __name__ == '__main__':
    sys.exit(main())
