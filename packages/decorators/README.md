# @fougere/decorators
> The configuration sugar
`@expose` — a decorator states a **fact**; it never changes the runtime in a
non-obvious way. On a class it marks a handler as served; on a method it marks one
operation. `isExposed(cls)` and `getExposedMethods(cls)` read what was stated.

Everything it says can be said in `frond.config.ts` instead, which is why nothing in
this repository imports it.

## Installation
```bash
pnpm add @fougere/decorators
```

---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://fougere.dev/) (en/fr).
