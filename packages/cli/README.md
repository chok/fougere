# @fougere/cli
> The Fougere CLI
Compose a workspace (`new`), serve a frond on its own (`serve`), call an operation
(`call`), inspect its effective contract (`explain`), read the application graph (`graph`).

The CLI is itself a Fougere app: its commands ride on the call contract.

```bash
fougere explain Post.publish
fougere explain Post.publish --json
```

`explain` reads the scanner's resolved operation contract: kind, input/output, parameter
bindings and collectors, surfaces/adapters, Frond and local/remote placement. It does not
boot the target application, so introspection does not run migrations or seeds.

## Installation
```bash
pnpm add @fougere/cli
```

---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://fougere.dev/) (en/fr).
