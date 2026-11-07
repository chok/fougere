# conventions — every name a project may change

```
scope       @fronds     → @shop
fronds      fronds/     → domains/
entities    entities/   → models/
handlers    handlers/   → endpoints/
services    services/   → providers/
seeds       seeds/      → fixtures/
rules       rules/      → logic/
vocabulary  vocabulary/ → terms/
extensions  extensions/ → plugins/
versions    versions/   → history/
```

```bash
pnpm dev         # boots, and each line says what its directory did
pnpm typecheck   # reads domains/ and resolves @shop/*
```

The tools read the same names:

```bash
pnpm exec fougere check            # finds both fronds
pnpm exec fougere build            # compiles domains/, logic/ and terms/
pnpm exec fougere serve catalog    # starts what build wrote
pnpm exec fougere freeze v2        # writes under history/
pnpm exec fougere call order.place --productId fern
```

## Two files

`fougere.config.ts` states what differs, and the scan, the boot and the CLI follow it.

TypeScript reads none of that. `@fougere/core/tsconfig` says `fronds` and `@fronds`, so
`tsconfig.json` says `domains` and `@shop`. `dirs` asks nothing of it. `@fronds/facade` keeps its
name whatever the scope.

## See it break

Delete `include` from `tsconfig.json` and write a type error under `domains/`: `pnpm typecheck`
passes, having read none of it. Delete the `@shop/*` line instead and it refuses every import.

Rename `domains/orders/endpoints/` on disk without touching the config and `order.place` refuses:
`Nothing here answers at 'order'.`

## What does not follow yet

`@fougere/vite` and `@fougere/next` read the defaults. Nuxt reads the config.
