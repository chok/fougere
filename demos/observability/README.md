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
are ordinary, and its identity card publishes a door with no schema.

## What comes out

A `cart.checkout` produces five spans across three processes:

```
shop:cart.checkout
  ├─ shop:product.list      →  catalog:product.list
  └─ shop:shipment.quote    →  shipping:shipment.quote
```

The caller's span **contains** the receiver's, so the difference between the two is what
the wire cost — a number neither process can measure alone.

| signal | what to look at |
|---|---|
| traces | the tree above, and every log line it produced |
| metrics | `fougere_operation_duration_seconds` — rate, errors and latency in one histogram |
| | `fougere_operations_active` — saturation |
| | `fougere_fronds` / `fougere_calls_total` — the service graph, discovered |
| logs | every line carries the trace of the call it was written inside |

The topology is **observed, never declared**: a Frond this process scanned runs here, a Frond
it called without having scanned runs elsewhere. `remotes:` is not read for it — a config key
states an intent, a Frond that answered a call is a fact.

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
