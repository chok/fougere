# @fougere/calls
> The dev panel — a bounded log of what this process dispatched
An optional extension. It **watches** rather than participates: it subscribes to
`app.observe`, which is passive and swallows an observer's own failure, and the ring
holds no reference to a body.

```ts
extensions: [calls({ max: 500, panel: true })],
```

What it sees that a middleware cannot: a call refused **before** any handler — an unknown
route, an entity hosted elsewhere, a call arriving while the door drains — and the route
kind of every call, so a local execution and a hop to another process read the same way.
Beside the calls it keeps a bounded ring of log lines, of errors, and — when
`@fougere/adapter-sql` is installed — of the statements each call issued.

No port is opened unless `panel` says so. The ring is served as the `rpc.calls` operation,
and the reader is `fougere devtools` over `/_fougere/call`, like any other consumer. An app
that never installed this package answers
`Unknown rpc operation 'calls'. It serves discover.`

## Installation
```bash
pnpm add -D @fougere/calls
```

---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://fougere.dev/) (en/fr).
