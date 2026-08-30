# @fougere/observability
> One span per operation, and the four signals derived from it
Optional in the strong sense: core holds no tracing code at all, only a `trace` field on
the invocation that it carries and never reads. An app that does not install this pays
nothing.

```ts
extensions: [observability({ service: 'blog', otlp: 'http://localhost:4318' })],
```

The parent rides the **invocation**, not a header — so the trace crosses whatever the
topology became, and the difference between the two spans of a split call is what the wire
cost. Rate, errors and duration are one metric (a histogram of durations, dimensioned by
the op and by its verdict); saturation is counted by the middleware. OTLP over HTTP in the
JSON encoding — no protobuf, no dependency.

`rpc.topology` is declared here, not by core: an app that never installed this refuses the
op by name, which is the whole degradation a reader needs.

## Installation
```bash
pnpm add @fougere/observability
```

---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://fougere.dev/) (en/fr).
