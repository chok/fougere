/**
 * The panel, as one file with no dependency.
 *
 * Inline on purpose: this package ships no framework and no build step, and a dev tool that
 * needs `npm install` before it shows anything is a dev tool nobody opens. The page reads
 * its own origin — the door that served it also serves its events — so there is no address
 * to configure and no CORS to arrange.
 *
 * FOUR views, and the number is a decision. Six grew one tab at a time, each with its own
 * empty state and its own caveat, and the result read as noise rather than as an answer.
 * They fold along what a reader actually asks:
 *
 *   Calls     what happened, and did it hold — the screen that IS the argument
 *   Refused   what did not, from two sources, since one of them is never a call
 *   Activity  what the process did along the way — logs and statements are one stream,
 *             both chronological, both uncorrelated to a call; two tabs said that twice
 *   Served    what it would answer if asked, filled before anything is called
 *
 * Traces lost its tab: it spoke for the receiving side only, and a trace already shows in a
 * call's detail. A tab that half-delivers is worse than a field that says what it knows.
 */
export function page(title: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — calls</title>
<style>
  :root {
    color-scheme: light dark;
    /* What the sticky header occupies — the one number two rules must agree on. */
    --head: 76px;
    --bg: #fbfbfd; --panel: #fff; --raise: #f4f4f8; --line: #e5e5ee; --ink: #16161d; --dim: #6f6f7e;
    --local: #0f7b34; --remote: #0a6f92; --system: #7040cf; --bad: #c3202c; --warn: #a06800;
    --r: 10px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0c0c10; --panel: #14141a; --raise: #1b1b23; --line: #26262f; --ink: #e9e9f2; --dim: #8b8b9b;
      /* Coloured text stays BELOW the ink in dark: #3fc9f6 read brighter than --ink and
         bloomed on OLED. */
      --local: #56b86a; --remote: #5ab4d8; --system: #a684e0; --bad: #f08078; --warn: #d4a944;
    }
  }
  * { box-sizing: border-box; }
  /* Three steps and no fourth: 11px for headers and chips, 12px for monospace, 13px for
     prose. The half-pixel scale that came before was tuned by hand, one tab at a time. */
  body { margin: 0; background: var(--bg); color: var(--ink);
    font: 0.8125rem/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.75rem;
    font-feature-settings: "liga" 0; }

  /* ── the shell: one bar, one row of tabs, one surface ───────────────────── */
  header { position: sticky; top: 0; z-index: 3; background: var(--bg);
    border-bottom: 1px solid var(--line); padding: 12px 20px 0; }
  .bar { display: flex; align-items: baseline; gap: 14px; }
  h1 { margin: 0; font-size: 0.9375rem; font-weight: 650; letter-spacing: -.01em; }
  h1 span { color: var(--dim); font-weight: 450; margin-left: 6px; }
  .vitals { margin-left: auto; display: flex; gap: 16px; color: var(--dim);
    font-variant-numeric: tabular-nums; font-size: 0.75rem; }
  .vitals i { font-style: normal; }
  .vitals b { color: var(--ink); font-weight: 600; }
  .dot { display: inline-block; width: 6px; height: 6px; border-radius: 99px;
    background: var(--dim); margin-right: 6px; vertical-align: middle; }
  .dot.on { background: var(--local); } .dot.off { background: var(--bad); }

  nav { display: flex; gap: 20px; margin-top: 10px; }
  nav a { padding: 0 0 9px; color: var(--dim); text-decoration: none; font-weight: 550;
    border-bottom: 2px solid transparent; margin-bottom: -1px; }
  nav a[aria-current="page"] { color: var(--ink); border-bottom-color: var(--ink); }
  nav a b { display: inline-block; margin-left: 5px; padding: 0 5px; border-radius: 99px;
    background: var(--bad); color: #fff; font-size: 10.5px; font-weight: 700; }

  /* Past this, an hour on the left and a verdict on the right stop being one glance. */
  main { padding: 14px 20px 60px; max-width: 1400px; }

  /* ── one visual system: every view is the same table ─────────────────────── */
  .pills { display: flex; gap: 5px; margin-bottom: 10px; }
  .pills button { font: inherit; font-size: 12px; padding: 3px 10px; border-radius: 99px;
    cursor: pointer; border: 1px solid var(--line); background: var(--panel); color: var(--dim); }
  .pills button[aria-pressed="true"] { color: var(--ink); border-color: var(--ink); }

  table { width: 100%; border-collapse: collapse; }
  /* Sticky under the bar: 400 rows and one scroll used to leave the columns unnamed. */
  th { position: sticky; top: var(--head); z-index: 2; background: var(--bg);
    text-align: left; font-size: 0.6875rem; font-weight: 550; color: var(--dim);
    padding: 6px 10px; box-shadow: inset 0 -1px var(--line); }
  td { padding: 5px 10px; vertical-align: baseline; }
  /* Zebra rather than borders: a 55%-transparent line on a dark ground was 2% contrast,
     so the densest view lost its rows exactly where it needed them most. */
  tbody tr:nth-child(even) { background: color-mix(in oklab, var(--raise) 55%, transparent); }
  tbody tr:hover { background: var(--raise); }
  tbody tr.pick { cursor: pointer; }
  tbody tr.fresh td { animation: in .6s ease-out; }
  /* Against --raise, not a hue: 14% of cyan is invisible on white and a flash on black. */
  @keyframes in { from { background: var(--raise); } }

  .lead { font-weight: 550; }
  .soft { color: var(--dim); }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tag { font-size: 0.6875rem; font-weight: 600; }
  .local { color: var(--local); } .remote { color: var(--remote); }
  .system { color: var(--system); } .unrouted, .failed, .error { color: var(--bad); }
  .warn { color: var(--warn); }
  /* The bar says HOW LONG, and its colour says how long too — the route is said in words
     beside it. Painting the route here spent three hues on a fact constant all session. */
  td.bar { width: 60px; padding-left: 0; }
  .meter { display: inline-block; height: 5px; border-radius: 3px; vertical-align: middle; }
  .meter.quick { background: var(--dim); opacity: .45; }
  .meter.warm { background: var(--warn); }
  .meter.slow { background: var(--bad); }
  .chip { font-size: .6875rem; font-weight: 650; padding: 1px 6px; border-radius: 5px;
    background: color-mix(in oklab, currentColor 14%, transparent); }

  /* One line, never a paragraph. A caveat is a footnote, not an apology. */
  .empty { padding: 64px 10px; text-align: center; color: var(--dim); }
  .note { margin: 14px 0 0; color: var(--dim); font-size: 12px; }
  code { background: var(--raise); border-radius: 4px; padding: 1px 5px; font-size: 12px; }

  /* The graph: SVG, no library. A node is a frond, an edge is a call that was made. */
  .shape { width: 100%; height: min(62vh, 520px); display: block; }
  .shape text { font: 12px ui-sans-serif, system-ui, sans-serif; fill: var(--ink); }
  .shape .sub { font-size: 10.5px; fill: var(--dim); }
  .shape .node { fill: var(--panel); stroke: var(--line); stroke-width: 1.5; cursor: pointer; }
  .shape .node.here { stroke: var(--ink); }
  .shape .node.off { stroke: var(--bad); stroke-dasharray: 4 3; }
  .shape .edge { fill: none; stroke: currentColor; opacity: .55; }
  .shape .edge.dead { stroke-dasharray: 5 4; opacity: .4; }
  .shape g.pick:hover .node { fill: var(--raise); }
  .legend { display: flex; gap: 18px; color: var(--dim); font-size: 0.75rem; margin-top: 6px; }
  /* The most structural thing on this tab was the smallest text on the page. */
  h2.frond { font-size: 0.8125rem; font-weight: 650; margin: 24px 0 8px;
    display: flex; align-items: baseline; gap: 8px; }

  aside { position: fixed; inset: 0 0 0 auto; width: min(420px, 100%); background: var(--panel);
    border-left: 1px solid var(--line); padding: 18px 20px; overflow: auto;
    transform: translateX(100%); transition: transform .16s ease-out; z-index: 4; }
  aside[open] { transform: none; }
  aside h2 { margin: 0 0 14px; font-size: 13.5px; }
  aside dl { display: grid; grid-template-columns: auto 1fr; gap: 5px 14px; margin: 0; }
  aside dt { color: var(--dim); font-size: 12.5px; }
  aside dd { margin: 0; word-break: break-all; }
  aside button { position: absolute; top: 12px; right: 16px; background: none; border: none;
    color: var(--dim); font-size: 17px; cursor: pointer; }
</style>
</head>
<body>
<header>
  <div class="bar">
    <h1>${title}<span id="where"></span></h1>
    <div class="vitals">
      <span>in flight <b id="inflight">0</b></span>
      <span>calls <b id="total">0</b><i id="dropped" class="failed"></i></span>
      <span><i class="dot" id="dot"></i><span id="live">connecting</span></span>
    </div>
  </div>
  <nav id="nav">
    <a href="#calls" aria-current="page">Calls</a>
    <a href="#refused">Refused</a>
    <a href="#activity">Activity</a>
    <a href="#shape">Shape</a>
    <a href="#served">Served</a>
  </nav>
</header>
<main id="main"></main>
<aside id="detail"><button id="close" aria-label="close">×</button><div id="body"></div></aside>

<script>
const state = { calls: [], errors: [], logs: [], queries: [], model: null,
                cursors: {}, view: 'calls', filter: 'all', kind: 'all', fronds: [] };
const main = document.getElementById('main');

const el = (tag, attrs = {}, html = '') => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null) node.setAttribute(k, v);
  if (html) node.innerHTML = html;
  return node;
};
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clock = (at) => new Date(at).toTimeString().slice(0, 8);
const routeOf = (c) => c.route ?? 'unrouted';
/** What colour is FOR on this page: how much a call cost, not where it ran. */
const costOf = (ms) => (ms >= 1000 ? 'slow' : ms >= 100 ? 'warm' : 'quick');

/** Every view is this table. One rhythm, so the eye moves the same way on each tab. */
function table(head, rows) {
  const t = el('table', {}, '<thead><tr>' + head.map((h) => '<th' + (h.num ? ' class="num"' : '')
    + (h.w ? ' style="width:' + h.w + '"' : '') + '>' + h.label + '</th>').join('') + '</tr></thead>');
  const body = el('tbody');
  for (const row of rows) body.append(row);
  t.append(body);

  return t;
}
const empty = (line) => el('div', { class: 'empty' }, line);
const note = (line) => el('p', { class: 'note' }, line);

// ── Calls ────────────────────────────────────────────────────────────────────
/** One filter row, wherever a view has a dimension worth narrowing. */
function pills(options, held, set) {
  const row = el('div', { class: 'pills' });
  for (const one of options) {
    const b = el('button', { 'aria-pressed': String(held === one) }, one);
    b.onclick = () => { set(one); draw(); };
    row.append(b);
  }

  return row;
}

function calls() {
  const kept = state.calls.filter((c) => state.filter === 'all' || routeOf(c) === state.filter);
  const bar = pills(['all', 'local', 'remote', 'system'], state.filter, (v) => { state.filter = v; });

  if (kept.length === 0) {
    return [bar, empty('Nothing dispatched yet — call an operation and it lands here.')];
  }

  // The recent window, not the session's high-water mark: one 4-second migration at boot
  // and every bar after it was 2px for good.
  const slowest = Math.max(1, ...kept.slice(-100).map((c) => c.ms ?? 0));

  // One frond, one word repeated 400 times, 112px stolen from what the eye scans.
  const many = new Set(state.calls.map((c) => c.frond)).size > 1;

  const rows = kept.slice(-400).reverse().map((c) => {
    const route = routeOf(c);
    const width = c.ms ? Math.max(2, Math.round((c.ms / slowest) * 56)) : 0;
    // Cleared as it is drawn: the flag marks the first render of a call, and a redraw is
    // not a new call. Left set, every SSE arrival re-animated on every redraw — and pull()
    // redraws up to three times a second, so the whole table strobed.
    const arrived = c.fresh;
    c.fresh = false;
    const row = el('tr', { class: 'pick' + (arrived ? ' fresh' : '') },
      '<td class="soft mono">' + clock(c.startedAt) + '</td>'
      + (many ? '<td class="soft">' + esc(c.frond ?? '—') + '</td>' : '')
      + '<td class="lead">' + esc(c.entity + '.' + c.operation)
        + (c.surface ? '<span class="soft">/' + esc(c.surface) + '</span>' : '')
        + (c.verdict === 'failed' ? ' <span class="chip failed">' + esc(c.refusal?.code ?? 'failed') + '</span>' : '')
        + (c.verdict === 'running' ? ' <span class="chip warn">running</span>' : '') + '</td>'
      + '<td class="soft">' + route + '</td>'
      + '<td class="num">' + (c.ms === undefined ? '' : c.ms + 'ms') + '</td>'
      + '<td class="bar">' + (width ? '<span class="meter ' + costOf(c.ms) + '" style="width:'
        + width + 'px"></span>' : '') + '</td>'
      + '');
    row.onclick = () => show(c);
    return row;
  });

  return [bar, table([{ label: 'time', w: '9ch' }, ...(many ? [{ label: 'frond', w: '10ch' }] : []),
    { label: 'operation' }, { label: 'route', w: '9ch' }, { label: 'took', num: true, w: '8ch' },
    { label: '', w: '60px' }], rows)];
}

// ── Refused ──────────────────────────────────────────────────────────────────
function refused() {
  if (state.errors.length === 0) {
    return [empty('Nothing refused.'),
      note('Two sources feed this: what a call carried, and what was logged at <code>error</code> outside any call — so a storage that would not open shows here too.')];
  }

  const rows = [];
  for (const one of [...state.errors].sort((a, b) => b.lastAt - a.lastAt)) {
    rows.push(el('tr', {},
      '<td class="soft mono">' + clock(one.lastAt) + '</td>'
      + '<td class="failed tag">' + esc(one.code) + '</td>'
      + '<td class="lead">' + esc(one.entity ? one.entity + '.' + one.operation : one.from) + '</td>'
      + '<td>' + esc(one.message) + '</td>'
      + '<td class="num soft">' + (one.count > 1 ? '×' + one.count : '') + '</td>'));

    // The reason a dispatch beats a span here: which field was refused, and why.
    for (const f of one.fields) {
      rows.push(el('tr', {}, '<td></td><td></td><td class="soft mono">' + esc(f.path) + '</td>'
        + '<td class="soft" colspan="2">' + esc(f.message) + '</td>'));
    }
  }

  return [table([{ label: 'time', w: '4.5rem' }, { label: 'code', w: '11rem' },
    { label: 'where', w: '13rem' }, { label: 'message' }, { label: '', num: true, w: '4rem' }], rows)];
}

// ── Activity ─────────────────────────────────────────────────────────────────
function activity() {
  // Logs and statements are one stream: both chronological, both uncorrelated to a call.
  // Two tabs said that twice and let the eye believe they were different kinds of fact.
  const stream = [
    ...state.logs.map((l) => ({ at: l.at, kind: l.level, what: l.message, detail: l.args.join(' '), from: l.name })),
    ...state.queries.map((q) => ({ at: q.at, kind: 'query', what: q.sql, from: q.storage,
      detail: q.parameters + (q.parameters === 1 ? ' param' : ' params'), ms: q.ms, failed: q.failed })),
  ].sort((a, b) => a.at - b.at);

  const bar = pills(['all', 'query', 'log', 'error'], state.kind, (v) => { state.kind = v; });
  const shown = state.kind === 'all' ? stream
    : state.kind === 'query' ? stream.filter((o) => o.kind === 'query')
    : state.kind === 'error' ? stream.filter((o) => o.kind === 'error')
    : stream.filter((o) => o.kind !== 'query');

  if (stream.length === 0) {
    return [bar, empty('Nothing written and nothing read, yet.'),
      note('Statements need <code>@fougere/adapter-sql</code>; log lines below the level in force never reach here — <code>FOUGERE_LOG_LEVEL=debug</code> lowers it.')];
  }

  const slowest = Math.max(1, ...state.queries.map((q) => q.ms));
  const rows = shown.slice(-500).reverse().map((one) => {
    const tone = one.kind === 'query' ? (one.failed ? 'failed' : 'local')
      : one.kind === 'error' ? 'error' : one.kind === 'warn' ? 'warn' : 'soft';
    const width = one.ms ? Math.max(2, Math.round((one.ms / slowest) * 40)) : 0;
    return el('tr', {},
      '<td class="soft mono">' + clock(one.at) + '</td>'
      + '<td class="tag ' + tone + '">' + one.kind + '</td>'
      + '<td class="soft">' + esc(one.from) + '</td>'
      + '<td class="' + (one.kind === 'query' ? 'mono' : '') + '">'
        + esc(one.what.length > 150 ? one.what.slice(0, 150) + '…' : one.what)
        + (one.detail ? ' <span class="soft">' + esc(one.detail) + '</span>' : '') + '</td>'
      + '<td class="num soft">' + (one.ms === undefined ? '' : one.ms + 'ms')
        + (width ? '<span class="meter local" style="width:' + width + 'px"></span>' : '') + '</td>');
  });

  return [bar, table([{ label: 'time', w: '9ch' }, { label: 'kind', w: '7ch' },
    { label: 'from', w: '14ch' }, { label: 'what' }, { label: 'took', num: true, w: '8ch' }], rows),
    note('Chronological. Tying a line or a statement to the call it happened inside needs an async context this package does not open — so it is not claimed.')];
}

// ── Served ───────────────────────────────────────────────────────────────────
function served() {
  if (!state.model || state.model.fronds.length === 0) return [empty('This process hosts no frond.')];

  const out = [];
  for (const frond of state.model.fronds) {
    // Declared against observed. Nowhere else can this line be drawn: elsewhere the
    // placement is not the developer's to declare, so there is only ever one value.
    const seen = new Set(state.calls.filter((c) => c.frond === frond.name && c.route).map((c) => c.route));
    const observed = seen.size === 0 ? null : [...seen].join(' + ');
    const off = observed !== null && !seen.has(frond.declared);
    out.push(el('h2', { class: 'frond' },
      esc(frond.name) + ' <span class="chip ' + frond.declared + '">' + frond.declared + '</span>'
      + (frond.at ? ' <span class="soft mono">' + esc(frond.at) + '</span>' : '')
      + ' <span class="' + (off ? 'failed' : 'soft') + '">· observed '
      + (observed === null ? 'nothing yet' : observed) + (off ? ' — they disagree' : '') + '</span>'
      + (frond.entities.length ? ' <span class="soft">· ' + esc(frond.entities.join(', ')) + '</span>' : '')));

    out.push(table([{ label: 'operation' }, { label: 'kind', w: '6rem' }, { label: 'in → out', w: '14rem' },
      { label: 'parameters' }, { label: 'served by', w: '12rem' }],
      frond.operations.map((op) => el('tr', {},
        '<td class="lead">' + esc(op.address) + '</td>'
        + '<td><span class="tag ' + op.kind + '">' + op.kind + '</span></td>'
        + '<td class="soft">' + esc((op.input ?? '—') + ' → ' + (op.output ?? '—')
          + (op.cardinality ? ' (' + op.cardinality + ')' : '')) + '</td>'
        + '<td class="soft mono">' + esc(op.parameters.map((p) => p.name + '←' + p.binding).join('  ') || '—') + '</td>'
        + '<td class="soft">' + esc((op.adapters.join(', ') || 'no adapter') + ' · ' + (op.surfaces.join(', ') || '—')) + '</td>'))));
  }

  return out;
}

// ── Shape ────────────────────────────────────────────────────────────────────
/**
 * What this process is arranged as — DECLARED and OBSERVED on one picture.
 *
 * Both halves are already on this page: the model says where a call is meant to go, the
 * ring says where it went. Nobody else can draw the pair, because elsewhere the placement
 * is not the developer's to declare — there is only ever one value, so there is nothing to
 * disagree with.
 *
 * One process's view, and it says so: a frond hosted elsewhere is a node with no inside.
 */
function shape() {
  if (!state.model || state.model.fronds.length === 0) return [empty('This process hosts no frond.')];

  const seenOf = (name) => {
    const mine = state.calls.filter((c) => c.frond === name);
    const routes = new Set(mine.filter((c) => c.route).map((c) => c.route));
    return { count: mine.length, failed: mine.filter((c) => c.verdict === 'failed').length, routes };
  };

  const here = state.model.fronds.filter((f) => f.declared === 'local');
  const away = state.model.fronds.filter((f) => f.declared === 'remote');
  const W = 900, ROW = 74, TOP = 34;
  const H = TOP + Math.max(here.length, away.length, 1) * ROW + 20;
  const svg = el('svg', { class: 'shape', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMin meet' });

  const box = (x, y, frond, side) => {
    const seen = seenOf(frond.name);
    const off = seen.routes.size > 0 && !seen.routes.has(frond.declared);
    const g = el('g', { class: 'pick' });
    g.innerHTML =
      '<rect class="node ' + (side === 'here' ? 'here' : '') + (off ? ' off' : '') + '" x="' + x + '" y="' + y
        + '" width="230" height="52" rx="9"/>'
      + '<text x="' + (x + 14) + '" y="' + (y + 22) + '">' + esc(frond.name) + '</text>'
      + '<text class="sub" x="' + (x + 14) + '" y="' + (y + 39) + '">'
        + frond.operations.length + ' op' + (frond.operations.length === 1 ? '' : 's')
        + (frond.at ? ' · ' + esc(frond.at.split('://').pop()) : '')
        + (seen.count ? ' · ' + seen.count + ' called' : '') + '</text>'
      + (off ? '<text class="sub" x="' + (x + 216) + '" y="' + (y + 22) + '" text-anchor="end" fill="var(--bad)">≠</text>' : '');
    g.onclick = () => { state.view = 'served'; location.hash = 'served'; };
    return g;
  };

  here.forEach((frond, i) => svg.append(box(30, TOP + i * ROW, frond, 'here')));
  away.forEach((frond, i) => {
    const y = TOP + i * ROW;
    svg.append(box(W - 260, y, frond, 'away'));

    // One edge per declared remote, drawn from what was OBSERVED: solid when calls crossed,
    // dashed when the line exists and nothing has used it.
    const seen = seenOf(frond.name);
    const from = TOP + Math.min(i, Math.max(0, here.length - 1)) * ROW + 26;
    const tone = seen.failed > 0 ? 'var(--bad)' : seen.count > 0 ? 'var(--remote)' : 'var(--dim)';
    svg.insertAdjacentHTML('afterbegin',
      '<path class="edge' + (seen.count ? '' : ' dead') + '" style="color:' + tone + '" '
      + 'stroke-width="' + (seen.count ? Math.min(6, 1.5 + Math.log2(seen.count + 1)) : 1.5) + '" '
      + 'd="M 260 ' + from + ' C ' + (W / 2) + ' ' + from + ', ' + (W / 2) + ' ' + (y + 26) + ', ' + (W - 260) + ' ' + (y + 26) + '"/>'
      + '<text class="sub" x="' + (W / 2) + '" y="' + ((from + y + 26) / 2 - 6) + '" text-anchor="middle">'
      + (seen.count ? seen.count + ' call' + (seen.count === 1 ? '' : 's') + (seen.failed ? ' · ' + seen.failed + ' refused' : '') : 'never called')
      + '</text>');
  });

  const legend = el('div', { class: 'legend' },
    '<span><b class="local">solid</b> — hosted here</span>'
    + '<span><b class="remote">line</b> — a call that crossed a process</span>'
    + '<span><b class="failed">≠</b> — declared and observed disagree</span>');

  return [svg, legend,
    away.length === 0 ? note('Everything runs in this process. A <code>remotes:</code> line is what puts a frond on the right.')
      : note('This is one process. A frond on the right runs elsewhere, so its own panel holds what happened inside it.')];
}

// ── the shell ────────────────────────────────────────────────────────────────
function draw() {
  const views = { calls, refused, activity, shape, served };
  main.replaceChildren(...views[state.view]());
  document.getElementById('total').textContent = String(state.calls.length);

  const refusals = state.errors.reduce((n, one) => n + one.count, 0);
  for (const link of document.querySelectorAll('#nav a')) {
    const view = link.hash.slice(1);
    if (view === state.view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
    // The one badge on the bar: what is wrong finds the eye without a tab of its own.
    if (view === 'refused') link.innerHTML = 'Refused' + (refusals ? ' <b>' + refusals + '</b>' : '');
  }
}

function show(call) {
  const op = state.model?.fronds.flatMap((f) => f.operations)
    .find((one) => one.address === call.entity + '.' + call.operation);
  const rows = [
    ['route', routeOf(call)],
    ['verdict', call.verdict === 'failed' ? (call.refusal?.code ?? 'failed') : call.verdict],
    ['took', call.ms === undefined ? 'unsettled' : call.ms + 'ms'],
    ['frond', call.frond ?? '—'],
    ['surface', call.surface ?? '—'],
    ['caller', call.caller ?? 'unsigned'],
    ['trace', call.trace ?? 'none on this side'],
  ];
  if (call.refusal) rows.push(['refusal', (call.refusal.code ? call.refusal.code + ' — ' : '') + call.refusal.message]);
  if (op) {
    rows.push(['kind', op.kind], ['handler', op.handler], ['file', op.file]);
    if (op.description) rows.push(['purpose', op.description]);
  }

  document.getElementById('body').innerHTML =
    '<h2>' + esc(call.entity + '.' + call.operation) + '</h2><dl>'
    + rows.map(([k, v]) => '<dt>' + k + '</dt><dd class="' + (k === 'trace' || k === 'file' ? 'mono' : '') + '">'
      + esc(v) + '</dd>').join('') + '</dl>';
  document.getElementById('detail').setAttribute('open', '');
}

document.getElementById('close').onclick = () => document.getElementById('detail').removeAttribute('open');
addEventListener('hashchange', () => { state.view = location.hash.slice(1) || 'calls'; draw(); });
state.view = location.hash.slice(1) || 'calls';


fetch('./model.json').then((a) => a.json()).then((m) => { state.model = m; draw(); });

function pull() {
  for (const name of ['logs', 'errors', 'queries']) {
    fetch('./' + name + '.json?since=' + (state.cursors[name] ?? 0))
      .then((a) => a.json())
      .then((page) => {
        if (!page.lines || page.lines.length === 0) return;
        state.cursors[name] = page.cursor;
        if (name === 'errors') {
          // A group is mutated in place and re-numbered, so it comes back with its count.
          for (const g of page.lines) {
            const at = state.errors.findIndex((one) => one.key === g.key);
            if (at === -1) state.errors.push(g); else state.errors[at] = g;
          }
        } else state[name].push(...page.lines);
        // Only what is being looked at, plus the badge: three rings answering every second
        // redrew the table three times a second for nothing.
        if (state.view === name || state.view === 'activity' || name === 'errors') draw();
      })
      .catch(() => {});
  }
}
setInterval(pull, 1000);
pull();

const events = new EventSource('./events');
events.addEventListener('open', () => {
  document.getElementById('live').textContent = 'live';
  document.getElementById('dot').className = 'dot on';
});
events.addEventListener('error', () => {
  document.getElementById('live').textContent = 'disconnected';
  document.getElementById('dot').className = 'dot off';
});
events.addEventListener('hello', (m) => {
  const held = JSON.parse(m.data);
  state.fronds = held.fronds ?? [];
  document.getElementById('where').textContent = state.fronds.length ? ' · ' + state.fronds.join(', ') : '';
  state.calls = held.calls;
  draw();
});
events.addEventListener('call', (m) => {
  const call = JSON.parse(m.data);
  call.fresh = true;
  state.calls.push(call);
  draw();
});
events.addEventListener('vitals', (m) => {
  const vitals = JSON.parse(m.data);
  document.getElementById('inflight').textContent = String(vitals.inFlight);
  // The ring's own promise — "an absence is named rather than left to look like a quiet
  // period" — kept by the only view that can keep it.
  document.getElementById('dropped').textContent = vitals.dropped ? ' +' + vitals.dropped + ' dropped' : '';
});

draw();
</script>
</body>
</html>`;
}
