# observability — three Fronds, three processes, one trace

```
load ──▶ shop :4200 ──▶ catalog  :4100
                    └─▶ shipping :4300
```

```bash
pnpm dev      # the three processes
pnpm load     # k6 against the shop, in stages
pnpm signoz   # a collector, to see any of it
```

## What the domain code says about being observed

Nothing. `CartHandler` asks for its two neighbours by type:

```ts
constructor(
  private productHandler: ProductHandler,
  private shipmentHandler: ShipmentHandler,
) {}
```

No address, no client, no span, no metric. Comment out `remotes:` in `src/main.ts` and the
same file runs against local Fronds — one span instead of three, and nothing else changes.

The whole wiring is `src/observe.ts`, the same eleven lines in each process, differing only
by a service name. `shipping` carries **no entity at all**: operations about no stored row
are ordinary, and its identity card publishes a facade with no schema.

## What comes out

A `cart.checkout` produces five spans across three processes:

```
shop:cart.checkout
  ├─ shop:product.list      →  catalog:product.list
  └─ shop:shipment.quote    →  shipping:shipment.quote
```

The caller's span **contains** the receiver's, so the difference between the two is what
the wire cost — a number neither process can measure alone. That subtraction is now the
span's own: `selfMs` is its duration minus what its observed children account for, so
`shop:cart.checkout` reports several milliseconds and almost no self. It is not slow. It is
waiting, and a column of durations cannot tell the two apart.

Every operation also says how many statements ran under it, and their time is taken out of
its own. That much runs always. What does **not** is a span per query:

```bash
SPAN_PER_STATEMENT=1 pnpm dev
```

```
item.listOneByOne   [0.54ms, self 0.47ms, 4 statements]     ← the default, one span

item.listOneByOne   [0.54ms, self 0.47ms, 4 statements]     ← and with it, five
  items.select      [0.01ms]
  items.select      [0.01ms]
  items.select      [0.01ms]
  items.select      [0.01ms]
```

The count **detects** — it is in the metrics, it costs one span, and one query per row shows
up in it as surely as in a trace. The detail **explains**, and it is turned on over the
operation the count named. A backend charges per span, and a page of forty rows is forty of
them; what decides is the volume, not the CPU, which is 658 ns against a 14 µs query.

| signal | what to look at |
|---|---|
| traces | the tree above, its statements, and every log line it produced |
| metrics | `fougere_operation_duration_seconds` — rate, errors and latency in one histogram |
| | `fougere_operation_self_seconds` — the same, with what it waited for taken out |
| | `fougere_operation_statements_total` — against the call count, statements per call |
| | `fougere_operations_active` — saturation |
| | `fougere_fronds` / `fougere_calls_total` — the service graph, discovered |
| logs | every line carries the trace of the call it was written inside |

One query per row is what an N+1 looks like in that last one, and `statementsOf`
(`@fougere/testing`) is the same count in a test, where it can be refused before it ships.

The `fronds` and `edges` of `rpc.topology` are **observed, never declared**: a Frond this
process scanned and hosts runs here, a Frond it called runs elsewhere. `remotes:` is not read
for either — a config key states an intent, a Frond that answered a call is a fact.

Its `declared` half is the other question, and it counts nothing. Ask the shop **before any
load** and the observed half knows one Frond, because nothing has answered yet; `declared`
already names catalog and shipping. Kill `shipping` and the difference is the whole point —
observed drops it, declared keeps it, so a node that is down is a dead edge instead of an
absence.

## Why the load comes in stages

`load.js` ramps to 5 users, holds, spikes to 30, holds, drains. A flat rate draws flat lines
and there is nothing to read in them; the spike is what makes latency, saturation and error
rate say something.

About 5 % of the load calls `product.reserve`, which refuses on purpose — a dashboard needs a
real error rate. `cart.report` sleeps unevenly, so the latency histogram has two clouds
instead of one bump: a p95 hides that, a heatmap cannot.

## The collector

Any OTLP backend reads this as-is. `pnpm signoz` brings one up through Foundry (UI on
`:8080`, OTLP on `:4318`); install `foundryctl` first:

```bash
curl -fsSL https://signoz.io/foundry.sh | bash
```

Jaeger, Tempo, Datadog, Honeycomb all take the same payload. Switching between two of them
while this demo was being written changed **two URL strings** — no instrumentation, no span
field, no metric. Point `OTLP_URL` at yours.

Without a collector the demo still runs; it says so once and carries on.
