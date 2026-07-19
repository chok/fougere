# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this

Fougere is a TypeScript framework built around two ideas:

1. **Single-schema** — one Entity class (`class Post extends entity({...})`) generates validation, DB tables (Drizzle), GraphQL types (Pothos), form contracts, and API surfaces.
2. **The gradient** — a Frond (business hexagon: entities + handlers + collectors + seeds) runs in-process or in its own process behind JSON-RPC, with **identical user code**. `remotes: { blog: 'http://...' }` in `fougere.config.ts` is the whole topology statement.

The reference documentation is the site's (`site/content/`, en/fr): entities and the 4 axes, views, handlers, collectors, errors, seeds, the client primitives, the gradient, surfaces, deployment.

## Commands

```bash
# Install
pnpm install

# Build all packages (required before demos if dist/ is missing)
pnpm -r build

# Run all tests
pnpm -r test

# Single package / single file
pnpm -C packages/schema test
pnpm -C packages/schema vitest run tests/entity.test.ts
pnpm -C packages/schema typecheck

# The Fougere site — vitrine + docs + blog Frond, built with Fougere
pnpm -C site dev                   # :3000

# Flagship demo — Nuxt blog (primitives + gradient)
pnpm -C demos/nuxt-blog dev:blog   # the blog Frond alone in its process (:4100)
pnpm -C demos/nuxt-blog dev        # the Nuxt app (:3000), consumes it via remotes
# Comment `remotes:` in demos/nuxt-blog/fougere.config.ts → same app in-process

# Other demos
pnpm -C demos/schema-ecommerce dev # Apollo Server on :4000
pnpm -C demos/container-basics dev # DI container demo
pnpm -C demos/core-scanner dev     # Auto-scanning fronds demo
```

## Monorepo layout

```
packages/
  schema/              @fougere/schema — entity() factory, field vocabulary, 4 axes, validation
  schema-drizzle/      Entity → Drizzle SQLite tables, ORM realization of lifecycle rules
  schema-graphql/      Entity → Pothos GraphQL types/inputs/CRUD
  schema-rest/         REST projection
  container/           Container interface (zero deps)
  container-fougere/   Container implementation (type-based DI, AST scan)
  core/                Scanner, bootstrap, call contract (FrondCall/runners), doublures, Crud, binding
  transport/http/      @fougere/transport-http — JSON-RPC 2.0 wire (serve + client subpath)
  fougere-nuxt/        @fougere/nuxt — the client primitives + server surface (see below)
  http/                @fougere/http — HttpRouter, middleware
  auth-better/         Auth (better-auth translation layer)
  cli/ cli-ui/         CLI
  decorators/          @config sugar
site/                  Le site de Fougere (vitrine + docs Nuxt Content en/fr + blog Frond), construit avec Fougere — voir site/README.md
demos/
  nuxt-blog/           FLAGSHIP — primitives, auth, draft→publish, lived split (serve-blog.mjs)
  schema-ecommerce/    SQLite + Apollo Server
  container-basics/ core-scanner/ multi-frond/ crud-auto/ auth-better/
```

## Architecture

**Core flow:** Entity → adapters (Drizzle, GraphQL, REST, forms). The schema is the source of truth; adapters read fields via `Entity.getFields()`.

**Field = 4 axes**: `shape` (JSON Schema — the shape IS JSON Schema), `role` (primary, ref…), `lifecycle` (who writes the value, at which moment: create `{value}|'now'|{generate}|'optional'`, update `'now'|'forbidden'`), `boundary` (readOnly/writeOnly — io projections `inputFields`/`outputFields`). **La validation juge, le storage réalise** : the façade judges client input (unknown keys refused — `Unknown field`); handlers write freely through the ORM, which realizes lifecycle rules.

**Call contract** (`core/src/call.ts`): a Frond call is a value `(entity, op, invocation)`. `createLocalRunner` executes strictly locally; `createAppRunner` follows the topology (local façades + remote doublures). Transports move the value, never reshape it. No RPC without travel: in-process = direct memory execution. Browser-safe surface: `@fougere/core/contract` subpath.

**Nuxt primitives** (`@fougere/nuxt`): `useQuery`/`useCommand` (the couple — a command on X revalidates mounted queries on X), `useFormFor` (contract, not rendering; local judge = remote judge), `useCurrentUser` (session resolved once server-side, hydrated), `invoke` (server dual, state via async context). Metadata = the imported entity class — nothing serialized to the client.

**Validation** engine is `@cfworker/json-schema` (edge-safe) — the field `shape` is the schema. `Entity.validate(input)` → `{ success, data }` | `{ success: false, errors: [{path, message}] }`.

## Conventions

- TypeScript strict, ESM, ES2022 target, Node16 module resolution
- **TypeScript 7 (native tsc) at the root** ; `packages/core` pins its own TS 5.9 dependency — the scanner uses the compiler JS API, which TS 7 no longer ships (exit: oxc-parser, planned)
- `"types": ["node"]` is explicit in tsconfig.base — TS 7 dropped automatic @types inclusion
- Package manager: pnpm ; test runner: vitest ; no decorators, no Zod
- Field detection via `__brand === 'fougere_field'` on class instance properties
- `graphql` deduplicated across workspace (override in root package.json, hoist in .npmrc)
- `better-sqlite3` native bindings may need: `cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npx prebuild-install`
- Commits : titre + 1-3 lignes de body. Jamais `git add -A` (sessions parallèles possibles dans l'arbre)

## Known issues

- `db: 'sqlite'` (string) in fougere.config.ts → **`:memory:`** on the Nuxt side : la DB est resemée à chaque reload Nitro (les users auth disparaissent) ; en split, les posts vivent dans le fichier du host → split-brain. Décision en attente : défaut fichier. Le site utilise la forme objet (`{ dialect: 'sqlite', path: '…' }`) pour l'esquiver.
- Nitro prod build does not trace `drizzle-orm` under pnpm — see `site/Dockerfile` (pnpm deploy) and `site/content/*/docs/6.infra/3.deployment.md`
- `graphql` dual ESM/CJS hazard in tests — schema-graphql tests use `schema.getTypeMap()` instead of `printSchema()`
- The signature parser is AST-only (no type checker) : type aliases in handler signatures are invisible — spell `User | null`, not `type CurrentUser = ...`
- Collectors register per-frond : under a split, a handler depending on another frond's collector silently loses it — keep collectors in the frond that consumes them (frontière à trancher)
