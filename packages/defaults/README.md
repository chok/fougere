# @fougere/defaults
> The conventional boot
`bootApp()` and `resolveStorage()` — **the single** place that reads `sources:`. It names no
engine: the config imports the adapters it uses, and memory, the fallback for an app that
declares no source, is the only one it brings.

`statementOf(root)` is what every boot starts from: the `fronds.ts` the project wrote, or the one
`@fougere/compiler` writes from the sources — an optional peer, imported only then. Where a build
already wrote it and the compiler is not installed, that one boots.

## Installation
```bash
pnpm add @fougere/defaults
```

---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://fougere.dev/).
