# @fougere/transport-http
> The call contract, on the wire
JSON-RPC 2.0, one route: `POST /_fougere/call`. `serve()` hosts a frond in its own
process; `createHttpTransport()` calls it from another.

No RPC without travel: in-process, a call stays a direct memory execution.

## Installation
```bash
pnpm add @fougere/transport-http
```

---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://fougere.dev/) (en/fr).
