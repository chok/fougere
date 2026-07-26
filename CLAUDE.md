# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this

Fougere is a TypeScript framework built around two ideas:

1. **Single-schema** — one Entity class (`class Post extends entity({...})`) generates validation, DB tables (Kysely), GraphQL types (Pothos), form contracts, and API surfaces.
2. **The gradient** — a Frond (business hexagon: entities + handlers + collectors + seeds) runs in-process or in its own process behind JSON-RPC, with **identical user code**. `remotes: { blog: 'http://...' }` in `fougere.config.ts` is the whole topology statement.

The reference documentation is the site's (`site/content/`, en/fr): entities and the 4 axes, views, handlers, collectors, errors, seeds, the client primitives, the gradient, surfaces, deployment. The design doctrine lives in `concepts/` — philosophy, the Frond, and the shortest path (application graph, the three degrees, teaching refusals, CI delta).

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
  schema-sql/          Entity → Kysely tables (SQLite/PostgreSQL/MySQL/SQL Server), ORM realization of lifecycle rules
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

**Core flow:** Entity → adapters (SQL, GraphQL, REST, forms). The schema is the source of truth; adapters read fields via `Entity.getFields()`.

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

- ~~`db: 'sqlite'` (string) in fougere.config.ts → `:memory:` on the Nuxt side~~ — **résolu** : `resolveStorage()` (`@fougere/runtime`) est l'unique point qui défaute un path absent (`setupSqlite` → `fougere.db`) ; le module Nuxt recalculait ce défaut à sa façon et le contredisait (`:memory:` codé en dur). `generateBootPlugin` (`packages/fougere-nuxt/src/module.ts`) passe désormais `db` tel quel à `resolveStorage`, comme `fougereApp.ts` le fait déjà — un seul défaut, un seul endroit. Le fichier reste le défaut partout, mémoire seulement sur opt-in explicite (`path: ':memory:'`).
- Nitro prod build does not trace `drizzle-orm` under pnpm — see `site/Dockerfile` (pnpm deploy) and `site/content/*/docs/6.infra/3.deployment.md`
- `graphql` dual ESM/CJS hazard in tests — schema-graphql tests use `schema.getTypeMap()` instead of `printSchema()`
- The signature parser is AST-only (no type checker) : type aliases in handler signatures are invisible — spell `User | null`, not `type CurrentUser = ...`
- **The scan cache is keyed on source, not on parser version** : `.fougere/scan-cache.json` (`core/src/scan-cache.ts`) stores parse results under `<file>:<suffix>` with a content hash of **that file only**. Change the parser — or a base class the file inherits from — and every unchanged handler keeps returning its **stale parse**, silently. Cost a real diagnosis: after adding `ParsedMethod.inherited`, `list(limit)` still looked broken until `rm -rf .fougere`. Two open consequences : an app upgrading Fougere keeps the previous parse semantics until something touches each handler file, and a workspace edit to `Crud()` does not invalidate the handlers that extend it. A parser-version stamp in the cache envelope would close both.
- **Heritage resolution is workspace-only** : `resolveSpecifier` (`core/src/handler-parser.ts`) maps `@fougere/x` to `<workspaceRoot>/packages/x/src`, and `findWorkspaceRoot` walks up to the `pnpm-workspace.yaml`. Inside this repo (demos, site, tests) it resolves ; from an **installed** app it falls back to the app root, finds nothing, and **says nothing**. The security consequence is closed: a prefab handler declares its ops at runtime (`Crud.__ops`), so the judge never depends on the scan — `tests/crud-contract.test.ts` boots a project outside any workspace to prove it. What remains open is the silence itself: a method inherited from a *published* base class that declares no `__ops` gets no contract, so it is simply **absent from the façade, without a word**. State the unresolved heritage clause at boot ; a `.d.ts` strategy only if a real published base class appears.
- Collectors register per-frond : under a split, a handler depending on another frond's collector silently loses it — keep collectors in the frond that consumes them (frontière à trancher)
- **Nothing judges a value on its way OUT of the domain, so malformed rows persist silently.** Verified 2026-07-25 on an installed app: a handler writing through the ORM (the doctrinal server path — `orm` realises, never judges) stored `status: 'n-importe-quoi'` on a `oneOf('draft','published')`, `contact: 'pas-un-email'` on an `email()`, and `score: 'texte'` on a `number()`. All read back unchanged. The DB is a **weak judge**: it catches nullability and (outside SQLite) column types — never a `oneOf`, a format or a range, since the DDL emits no `CHECK`. So the gap is structural, not a SQLite artefact. **The frame (user's, 2026-07-25): in an onion model the client and the database are both OUTSIDE — writing to storage and answering a client are the same act, the domain emitting a value through a port.** Hence one concept, two facets: (1) judge the value once, before any projection — judging after would fail the client view, which legitimately lacks its `writeOnly` fields ; (2) project per audience, `boundary.out` meaning "closed to THAT audience" (storage sees everything, `passwordHash` included). Stakes differ even though the act is one (a bad value shown is a wrong screen, a bad value stored is corruption). **Hexagonal theory is explicit about where the check goes**: the domain validates before calling the port, the persistence adapter only translates — so this belongs in `core`, on the domain side of `EntityOrm`, never in `schema-sql`. And the premise "nobody does this" is false: Sequelize sends no SQL at all when validation fails, Mongoose registers a `pre('save')` hook by default, ActiveRecord validates on `save` ; Django deliberately does not. Fougere owns its schema like an ActiveRecord but behaved at the port like a thin query builder that knows nothing. **The fix needs no new axis** — `'closed'` is the null conversion (the absorbing element), not a permission of another nature ; what is wrong is `boundary`'s claimed SCOPE, since its header says `in` covers "a DB row" and `out` "storage" while the ORM applies no boundary at all and the doctrine puts storage conversion in the adapter. Correct that header, then index the judge by the situation (who speaks, which moment) — a judge whose situation is not "a client speaks" simply does not read a client-only axis. Nothing implemented.
- **A split receiver trusts the `state` it is handed** (`transport/http/src/server.ts`) : `state` carries user/session, and it is read straight off the wire. What holds today is the `127.0.0.1` default of `serve()` (`ServeCommand` exposes no `host` at all), so only the same machine can talk — but that is an unwritten default, not a guarantee, and `host: '0.0.0.0'` opens a full identity bypass **without a word**. Deliberately deferred (2026-07-25) : the answer is frond-level auth with a real mechanism, not a shared secret on the link. Until then, do not document nor ship a non-loopback `serve()`.
