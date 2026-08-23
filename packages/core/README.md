# @fougere/core
> The core — scan, call contract, façades
A frond call is a **value**: `(entity, op, invocation)`. `createLocalRunner` executes it
strictly locally; `createAppRunner` follows the topology (local façades, remote
stand-ins). Transports move the value — they never reshape it.

The façade judges the input, projects the output, and exposes only what a contract
declares. It also canonicalizes optional input before binding: omission is `undefined`,
JSON may omit its property, and an explicit `null` is never rewritten.

Node-free surface, for the browser: the `@fougere/core/contract` subpath.

## Installation
```bash
pnpm add @fougere/core
```

---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://chok.github.io/fougere/) (en/fr).
