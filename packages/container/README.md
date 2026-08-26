# @fougere/container
> Fougere's DI container
Resolution **by type**, never by parameter name: the AST scan reads the constructor
signature and wires what it asks for. Nested scopes, one per frond. Zero dependencies.

It is small on purpose. The scan already knows the graph — every class and every
dependency is read from source before boot — so there is almost nothing left to bind
late: a Map with a parent chain, a scope, and a resolver of last resort for a frond
that lives in another process.

## Installation
```bash
pnpm add @fougere/container
```

---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://fougere.dev/) (en/fr).
