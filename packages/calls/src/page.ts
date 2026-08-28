/**
 * The panel, as one file with no dependency.
 *
 * Inline on purpose: this package ships no framework and no build step of its own, and a
 * dev tool that needs `npm install` before it shows anything is a dev tool nobody opens.
 * The page reads its own origin — the door that served it also serves its events — so
 * there is no address to configure and no CORS to arrange.
 *
 * Three views, because three questions: what is happening now, what one call became across
 * processes, and what this process would answer if asked.
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
    --bg: #fbfbfd; --panel: #fff; --raise: #f4f4f8; --line: #e5e5ee; --ink: #16161d; --dim: #71717f;
    --local: #0f7b34; --remote: #0a6f92; --system: #7040cf; --bad: #c3202c; --run: #a06800;
    --radius: 10px;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0c0c10; --panel: #14141a; --raise: #1b1b23; --line: #26262f; --ink: #e9e9f2; --dim: #8c8c9c;
      --local: #46c15c; --remote: #3fc9f6; --system: #b98cf5; --bad: #ff8078; --run: #e6bb45;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink);
    font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }

  header { position: sticky; top: 0; z-index: 3; background: color-mix(in oklab, var(--bg) 86%, transparent);
    backdrop-filter: saturate(1.4) blur(10px); border-bottom: 1px solid var(--line); }
  .bar { display: flex; align-items: center; gap: 16px; padding: 12px 20px 0; flex-wrap: wrap; }
  h1 { margin: 0; font-size: 15px; font-weight: 650; letter-spacing: -.01em; }
  h1 span { color: var(--dim); font-weight: 450; }
  .vitals { display: flex; gap: 18px; margin-left: auto; color: var(--dim); font-variant-numeric: tabular-nums; }
  .vitals b { color: var(--ink); font-weight: 600; }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 99px; background: var(--dim); margin-right: 6px; }
  .dot.on { background: var(--local); box-shadow: 0 0 0 3px color-mix(in oklab, var(--local) 20%, transparent); }
  .dot.off { background: var(--bad); }
  nav { display: flex; gap: 2px; padding: 10px 20px 0; }
  nav a { padding: 7px 13px; border-radius: var(--radius) var(--radius) 0 0; color: var(--dim);
    text-decoration: none; font-weight: 550; font-size: 13px; border: 1px solid transparent; border-bottom: none; }
  nav a[aria-current="page"] { color: var(--ink); background: var(--panel); border-color: var(--line); }
  main { padding: 18px 20px 60px; }

  .pills { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
  .pills button { font: inherit; font-size: 12.5px; padding: 4px 11px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--line); background: var(--panel); color: var(--dim); }
  .pills button[aria-pressed="true"] { color: var(--ink); border-color: color-mix(in oklab, var(--ink) 32%, var(--line)); }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10.5px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase;
    color: var(--dim); padding: 6px 10px; border-bottom: 1px solid var(--line); }
  td { padding: 7px 10px; vertical-align: baseline; border-bottom: 1px solid color-mix(in oklab, var(--line) 55%, transparent); }
  tbody tr { cursor: pointer; }
  tbody tr:hover { background: var(--raise); }
  tbody tr.fresh { animation: in .6s ease-out; }
  @keyframes in { from { background: color-mix(in oklab, var(--remote) 14%, transparent); } }
  .op { font-weight: 550; }
  .soft { color: var(--dim); }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tag { display: inline-block; font-size: 11.5px; font-weight: 600; padding: 1px 8px; border-radius: 6px;
    background: color-mix(in oklab, currentColor 13%, transparent); }
  .local { color: var(--local); } .remote { color: var(--remote); }
  .system { color: var(--system); } .unrouted, .failed { color: var(--bad); }
  .query { color: var(--remote); } .command { color: var(--run); }
  .meter { display: inline-block; height: 6px; border-radius: 3px; background: currentColor; opacity: .32; margin-left: 8px; vertical-align: middle; }

  .empty { padding: 60px 10px; text-align: center; color: var(--dim); }
  .empty code { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 2px 6px; }
  .lost { color: var(--run); padding: 8px 10px; font-size: 13px; }

  .trace { border: 1px solid var(--line); background: var(--panel); border-radius: var(--radius); margin-bottom: 10px; overflow: hidden; }
  .trace > summary { padding: 9px 12px; cursor: pointer; display: flex; gap: 12px; align-items: baseline; }
  .trace > summary::marker { color: var(--dim); }
  .trace ol { list-style: none; margin: 0; padding: 4px 12px 12px; }
  .trace li { display: flex; gap: 10px; align-items: baseline; padding: 3px 0; }
  .span { height: 8px; border-radius: 4px; background: currentColor; opacity: .35; min-width: 3px; }

  .card { border: 1px solid var(--line); background: var(--panel); border-radius: var(--radius); padding: 14px 16px; margin-bottom: 12px; }
  .card h2 { margin: 0 0 2px; font-size: 14px; font-weight: 650; }
  .card p { margin: 0 0 10px; color: var(--dim); font-size: 13px; }
  .grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
  .served { border: 1px solid var(--line); border-radius: 8px; padding: 9px 11px; background: var(--bg); }
  .served b { font-weight: 600; }
  .served div { color: var(--dim); font-size: 12.5px; margin-top: 3px; }

  aside { position: fixed; inset: 0 0 0 auto; width: min(440px, 100%); background: var(--panel);
    border-left: 1px solid var(--line); padding: 18px 20px; overflow: auto; transform: translateX(100%);
    transition: transform .18s ease-out; z-index: 4; }
  aside[open] { transform: none; }
  aside dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 0; }
  aside dt { color: var(--dim); font-size: 12.5px; }
  aside dd { margin: 0; word-break: break-all; }
  aside button { position: absolute; top: 14px; right: 16px; background: none; border: none; color: var(--dim);
    font-size: 18px; cursor: pointer; }
</style>
</head>
<body>
<header>
  <div class="bar">
    <h1>${title} <span id="where"></span></h1>
    <div class="vitals">
      <span>in flight <b id="inflight">0</b></span>
      <span>calls <b id="total">0</b></span>
      <span><i class="dot" id="dot"></i><span id="live">connecting…</span></span>
    </div>
  </div>
  <nav id="nav">
    <a href="#flow" aria-current="page">Flow</a>
    <a href="#traces">Traces</a>
    <a href="#errors">Errors</a>
    <a href="#logs">Logs</a>
    <a href="#queries">Queries</a>
    <a href="#served">Served</a>
  </nav>
</header>
<main id="main"></main>
<aside id="detail"><button id="close" aria-label="close">×</button><div id="detailBody"></div></aside>

<script>
const state = { calls: [], model: null, logs: [], errors: [], queries: [], cursors: {}, view: 'flow', filter: 'all', slowest: 1, fronds: [] };
const main = document.getElementById('main');
const el = (tag, attrs = {}, html = '') => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (html) node.innerHTML = html;
  return node;
};
const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const routeOf = (call) => call.route ?? 'unrouted';
const verdictOf = (call) => call.verdict === 'failed' ? (call.refusal?.code ?? 'failed') : call.verdict;

// ── Flow ─────────────────────────────────────────────────────────────────────
function flow() {
  const kept = state.calls.filter((call) =>
    state.filter === 'all' ? true
    : state.filter === 'failed' ? call.verdict === 'failed'
    : routeOf(call) === state.filter);

  const pills = el('div', { class: 'pills' });
  for (const one of ['all', 'local', 'remote', 'system', 'failed']) {
    const button = el('button', { 'data-filter': one, 'aria-pressed': String(state.filter === one) }, one === 'failed' ? 'refused' : one);
    button.onclick = () => { state.filter = one; draw(); };
    pills.append(button);
  }

  if (kept.length === 0) {
    return [pills, el('div', { class: 'empty' },
      'Nothing dispatched yet. Call an operation — <code>fougere call</code>, a page, curl — and it lands here.')];
  }

  const table = el('table', {}, '<thead><tr><th>frond</th><th>operation</th><th>route</th>'
    + '<th class="num">took</th><th>verdict</th><th>trace</th></tr></thead>');
  const body = el('tbody');
  for (const call of kept.slice(-400).reverse()) {
    const route = routeOf(call);
    const width = call.ms ? Math.max(2, Math.round((call.ms / state.slowest) * 64)) : 0;
    const row = el('tr', call.fresh ? { class: 'fresh' } : {},
      '<td class="soft">' + esc(call.frond ?? '—') + '</td>'
      + '<td class="op">' + esc(call.entity + '.' + call.operation)
        + (call.surface ? '<span class="soft">/' + esc(call.surface) + '</span>' : '') + '</td>'
      + '<td><span class="tag ' + route + '">' + route + '</span></td>'
      + '<td class="num ' + route + '">' + (call.ms === undefined ? '' : call.ms + 'ms')
        + (width ? '<span class="meter" style="width:' + width + 'px"></span>' : '') + '</td>'
      + '<td class="' + call.verdict + '">' + esc(verdictOf(call)) + '</td>'
      + '<td class="mono soft" title="' + esc(call.trace ?? '') + '">' + esc(call.trace ? call.trace.slice(3, 11) : '') + '</td>');
    row.onclick = () => show(call);
    body.append(row);
  }
  table.append(body);

  return [pills, table];
}

// ── Traces ───────────────────────────────────────────────────────────────────
function traces() {
  const byTrace = new Map();
  for (const call of state.calls) {
    const key = call.trace ? call.trace.slice(3, 35) : null;
    if (!key) continue;
    if (!byTrace.has(key)) byTrace.set(key, []);
    byTrace.get(key).push(call);
  }

  if (byTrace.size === 0) {
    return [el('div', { class: 'empty' },
      'No trace yet. A traceparent travels on the invocation, so install <code>@fougere/observability</code> '
      + 'on the callers and one call across processes appears here as one line.')];
  }

  const out = [];
  for (const [key, calls] of [...byTrace.entries()].reverse().slice(0, 60)) {
    const sorted = calls.slice().sort((a, b) => a.startedAt - b.startedAt);
    const start = sorted[0].startedAt;
    const span = Math.max(1, ...sorted.map((call) => (call.startedAt - start) + (call.ms ?? 0)));
    const failed = sorted.some((call) => call.verdict === 'failed');

    const details = el('details', { class: 'trace', open: sorted.length > 1 ? 'open' : null });
    details.append(el('summary', {},
      '<span class="mono soft">' + esc(key.slice(0, 8)) + '</span>'
      + '<b>' + esc(sorted[0].entity + '.' + sorted[0].operation) + '</b>'
      + '<span class="soft">' + sorted.length + ' hop(s) · ' + span + 'ms</span>'
      + (failed ? '<span class="tag failed">refused</span>' : '')));

    const list = el('ol');
    for (const call of sorted) {
      const route = routeOf(call);
      const left = Math.round(((call.startedAt - start) / span) * 100);
      const width = Math.max(1, Math.round(((call.ms ?? 0) / span) * 100));
      list.append(el('li', {},
        '<span class="soft" style="width:6.5rem">' + esc(call.frond ?? '—') + '</span>'
        + '<span class="op" style="width:12rem">' + esc(call.entity + '.' + call.operation) + '</span>'
        + '<span class="tag ' + route + '" style="width:5.5rem">' + route + '</span>'
        + '<span style="flex:1"><span class="span ' + route + '" style="margin-left:' + left + '%;width:' + width + '%"></span></span>'
        + '<span class="num soft" style="width:4rem">' + (call.ms ?? 0) + 'ms</span>'));
    }
    details.append(list);
    out.push(details);
  }

  return out;
}

// ── Served ───────────────────────────────────────────────────────────────────
function served() {
  if (!state.model || state.model.fronds.length === 0) {
    return [el('div', { class: 'empty' }, 'This process hosts no frond.')];
  }

  return state.model.fronds.map((frond) => {
    const card = el('div', { class: 'card' });
    card.append(el('h2', {}, esc(frond.name)));
    card.append(el('p', {}, frond.entities.length
      ? esc(frond.entities.join(', '))
      : 'no entity — handlers only'));

    // Declared against observed. The config says where a call GOES; the ring says where it
    // WENT. Nobody else can show this line: elsewhere the placement is not the developer's
    // to declare, so there is only ever one value.
    const seen = new Set(state.calls
      .filter((call) => call.frond === frond.name && call.route)
      .map((call) => call.route));
    const observed = seen.size === 0 ? null : [...seen].join(' + ');
    const disagrees = observed !== null && !seen.has(frond.declared);
    card.append(el('p', { class: disagrees ? 'failed' : 'soft' },
      'declared <b>' + frond.declared + '</b>' + (frond.at ? ' ' + esc(frond.at) : '')
      + ' · observed ' + (observed === null ? '<i>nothing called yet</i>' : '<b>' + observed + '</b>')
      + (disagrees ? ' — they disagree' : '')));

    const grid = el('div', { class: 'grid' });
    for (const op of frond.operations) {
      const io = [op.input ? 'takes ' + esc(op.input) : null,
                  op.output ? 'gives ' + esc(op.output) + (op.cardinality ? ' (' + op.cardinality + ')' : '') : null]
        .filter(Boolean).join(' · ');
      grid.append(el('div', { class: 'served' },
        '<b>' + esc(op.address) + '</b> <span class="tag ' + op.kind + '">' + op.kind + '</span>'
        + '<span class="tag ' + op.placement + '">' + op.placement + '</span>'
        + (op.description ? '<div>' + esc(op.description) + '</div>' : '')
        + (io ? '<div>' + io + '</div>' : '')
        + '<div>' + (op.parameters.map((one) => esc(one.name) + ' ← ' + one.binding).join(', ') || 'no parameter') + '</div>'
        + '<div>' + (op.adapters.join(', ') || 'no adapter') + ' · ' + (op.surfaces.join(', ') || 'no surface') + '</div>'));
    }
    card.append(grid);

    return card;
  });
}

// ── Errors ───────────────────────────────────────────────────────────────────
function errors() {
  if (state.errors.length === 0) {
    return [el('div', { class: 'empty' },
      'Nothing refused. This screen has two sources — what a call carried, and what was '
      + 'logged at <code>error</code> outside any call — so a boot that failed shows here too.')];
  }

  const out = [];
  for (const one of [...state.errors].sort((a, b) => b.lastAt - a.lastAt)) {
    const card = el('div', { class: 'card' });
    const where = one.entity ? esc(one.entity + '.' + one.operation) : esc(one.code);
    card.append(el('h2', {},
      '<span class="tag failed">' + esc(one.code) + '</span> ' + where
      + (one.count > 1 ? ' <span class="soft">×' + one.count + '</span>' : '')
      + '<span class="tag ' + (one.from === 'log' ? 'system' : 'remote') + '">' + one.from + '</span>'));
    card.append(el('p', {}, esc(one.message)));

    // The whole reason this source beats a span: a span keeps the code, this keeps which
    // field was refused and why.
    if (one.fields.length > 0) {
      const grid = el('div', { class: 'grid' });
      for (const field of one.fields) {
        grid.append(el('div', { class: 'served' }, '<b>' + esc(field.path) + '</b><div>' + esc(field.message) + '</div>'));
      }
      card.append(grid);
    }
    out.push(card);
  }

  return out;
}

// ── Logs ─────────────────────────────────────────────────────────────────────
function logs() {
  if (state.logs.length === 0) {
    return [el('div', { class: 'empty' },
      'No line yet. The threshold filters before this panel sees anything — '
      + '<code>FOUGERE_LOG_LEVEL=debug</code> lowers it. Lines written before this extension '
      + 'was mounted (the scan, the seeding) are already gone.')];
  }

  const table = el('table', {}, '<thead><tr><th>level</th><th>logger</th><th>message</th></tr></thead>');
  const body = el('tbody');
  for (const line of state.logs.slice(-400).reverse()) {
    const tone = line.level === 'error' ? 'failed' : line.level === 'warn' ? 'command' : 'soft';
    body.append(el('tr', {},
      '<td><span class="tag ' + tone + '">' + line.level + '</span></td>'
      + '<td class="soft mono">' + esc(line.name) + '</td>'
      + '<td>' + esc(line.message)
        + (line.args.length ? ' <span class="soft mono">' + esc(line.args.join(' ')) + '</span>' : '') + '</td>'));
  }
  table.append(body);

  // Said in the screen, not left to be discovered: no async context, no correlation.
  return [el('p', { class: 'soft' }, 'Chronological. Tying a line to the call it was written '
    + 'inside needs an async context this package does not open.'), table];
}

// ── Queries ──────────────────────────────────────────────────────────────────
function queries() {
  if (state.queries.length === 0) {
    return [el('div', { class: 'empty' },
      'No statement seen. Either nothing has read the database yet, or this process has no '
      + 'SQL storage — <code>@fougere/adapter-sql</code> is what reports them.')];
  }

  const slowest = Math.max(1, ...state.queries.map((one) => one.ms));
  const table = el('table', {}, '<thead><tr><th>storage</th><th>statement</th>'
    + '<th class="num">params</th><th class="num">took</th></tr></thead>');
  const body = el('tbody');
  for (const one of state.queries.slice(-400).reverse()) {
    const width = Math.max(2, Math.round((one.ms / slowest) * 64));
    body.append(el('tr', one.failed ? { class: 'failed' } : {},
      '<td class="soft">' + esc(one.storage) + '</td>'
      + '<td class="mono">' + esc(one.sql.length > 160 ? one.sql.slice(0, 160) + '…' : one.sql) + '</td>'
      + '<td class="num soft">' + one.parameters + '</td>'
      + '<td class="num">' + one.ms + 'ms<span class="meter local" style="width:' + width + 'px"></span></td>'));
  }
  table.append(body);

  // The values are user data nobody chose to expose — the rule the call log states for a body.
  return [el('p', { class: 'soft' }, 'Parameters are counted, never shown.'), table];
}

// ── the shell ────────────────────────────────────────────────────────────────
function draw() {
  const views = { flow, traces, served, errors, logs, queries };
  main.replaceChildren(...views[state.view]());
  document.getElementById('total').textContent = String(state.calls.length);
  for (const link of document.querySelectorAll('#nav a')) {
    if (link.hash.slice(1) === state.view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const lost = document.getElementById('lostLine');
  if (lost) main.append(lost);
}

function show(call) {
  const op = state.model?.fronds
    .flatMap((frond) => frond.operations)
    .find((one) => one.address === call.entity + '.' + call.operation);
  const rows = [
    ['operation', call.entity + '.' + call.operation],
    ['frond', call.frond ?? '—'],
    ['route', routeOf(call)],
    ['verdict', verdictOf(call)],
    ['took', call.ms === undefined ? 'unsettled' : call.ms + 'ms'],
    ['surface', call.surface ?? '—'],
    ['caller', call.caller ?? 'unsigned'],
    ['trace', call.trace ?? '—'],
    ['seq', call.seq],
  ];
  if (call.refusal) rows.push(['refusal', (call.refusal.code ? call.refusal.code + ' — ' : '') + call.refusal.message]);
  if (op) {
    rows.push(['kind', op.kind], ['handler', op.handler], ['file', op.file]);
    if (op.description) rows.push(['purpose', op.description]);
  }

  document.getElementById('detailBody').innerHTML =
    '<h2 style="margin:0 0 12px;font-size:14px">' + esc(call.entity + '.' + call.operation) + '</h2><dl>'
    + rows.map(([key, value]) => '<dt>' + key + '</dt><dd class="' + (key === 'trace' || key === 'file' ? 'mono' : '') + '">' + esc(value) + '</dd>').join('')
    + '</dl>';
  document.getElementById('detail').setAttribute('open', '');
}

document.getElementById('close').onclick = () => document.getElementById('detail').removeAttribute('open');
addEventListener('hashchange', () => { state.view = location.hash.slice(1) || 'flow'; draw(); });
state.view = location.hash.slice(1) || 'flow';

const remember = (calls) => {
  for (const call of calls) if (call.ms && call.ms > state.slowest) state.slowest = call.ms;
};

fetch('./model.json').then((answer) => answer.json()).then((model) => { state.model = model; draw(); });

// The three other rings are polled, not pushed: they fill far faster than calls do, and a
// frame per statement would spend the panel's budget on redrawing rather than on being read.
function pull() {
  for (const name of ['logs', 'errors', 'queries']) {
    fetch('./' + name + '.json?since=' + (state.cursors[name] ?? 0))
      .then((answer) => answer.json())
      .then((page) => {
        if (!page.lines || page.lines.length === 0) return;
        state.cursors[name] = page.cursor;
        // Errors are GROUPS: one that grew comes back with a higher count, so it replaces
        // rather than piling up beside itself.
        if (name === 'errors') {
          for (const group of page.lines) {
            const at = state.errors.findIndex((one) => one.key === group.key);
            if (at === -1) state.errors.push(group); else state.errors[at] = group;
          }
        } else {
          state[name].push(...page.lines);
        }
        if (state.view === name) draw();
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
events.addEventListener('hello', (message) => {
  const held = JSON.parse(message.data);
  state.fronds = held.fronds ?? [];
  document.getElementById('where').textContent = state.fronds.length ? '· ' + state.fronds.join(', ') : '';
  state.calls = held.calls;
  remember(state.calls);
  draw();
});
events.addEventListener('call', (message) => {
  const call = JSON.parse(message.data);
  call.fresh = true;
  state.calls.push(call);
  remember([call]);
  draw();
});
events.addEventListener('vitals', (message) => {
  const vitals = JSON.parse(message.data);
  document.getElementById('inflight').textContent = String(vitals.inFlight);
  let lost = document.getElementById('lostLine');
  if (!vitals.dropped) { lost?.remove(); return; }
  if (!lost) { lost = document.createElement('div'); lost.id = 'lostLine'; lost.className = 'lost'; main.append(lost); }
  lost.textContent = vitals.dropped + ' call(s) dropped — the ring is smaller than this traffic';
});

draw();
</script>
</body>
</html>`;
}
