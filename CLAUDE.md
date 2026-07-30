# CLAUDE.md

Guidance for Claude Code working in this repository.

## What is this

Fougere is a TypeScript framework built on two ideas:

1. **Single-schema** — one Entity class (`class Post extends entity({...})`) generates validation, DB tables (Kysely), GraphQL types (Pothos), form contracts, API surfaces.
2. **The gradient** — a Frond (entities + handlers + collectors + seeds) runs in-process or in its own process behind JSON-RPC, with **identical user code**. `remotes: { blog: 'http://...' }` in `fougere.config.ts` is the whole topology statement.

Reference docs: `site/content/` (en/fr). Design doctrine: `concepts/`.

## Commands

```bash
pnpm install
pnpm -r build                      # required before demos if dist/ is missing
pnpm -r test
pnpm -r typecheck                  # covers site/fronds + demos/*/fronds

pnpm -C packages/schema test
pnpm -C packages/schema vitest run tests/entity.test.ts

pnpm -C site dev                   # :3000 — vitrine + docs + blog Frond
pnpm -C demos/nuxt-blog dev:blog   # blog Frond alone in its process (:4100)
pnpm -C demos/nuxt-blog dev        # Nuxt app (:3000), consumes it via remotes
                                   # comment `remotes:` → same app in-process
pnpm -C demos/schema-ecommerce dev # Apollo Server on :4000
pnpm -C demos/container-basics dev
pnpm -C demos/core-scanner dev
```

## Monorepo layout

```
packages/
  schema/              entity() factory, field vocabulary, 4 axes, validation
  schema-sql/          Entity → Kysely tables (SQLite/PG/MySQL/MSSQL), realizes lifecycle rules
  schema-graphql/      Entity → Pothos types/inputs/CRUD
  schema-rest/         REST projection
  container/           Container interface (zero deps)
  container-fougere/   Implementation — type-based DI, AST scan
  core/                Scanner, bootstrap, call contract, doublures, Crud, binding
  transport/http/      JSON-RPC 2.0 wire (serve + client subpath)
  fougere-nuxt/        Client primitives + server surface
  http/                HttpRouter, middleware
  auth-better/         better-auth translation layer
  cli/ cli-ui/  decorators/
site/                  Le site de Fougere, construit avec Fougere — voir site/README.md
demos/
  nuxt-blog/           FLAGSHIP — primitives, auth, draft→publish, lived split
  schema-ecommerce/    SQLite + Apollo Server
  container-basics/ core-scanner/ multi-frond/ crud-auto/ auth-better/
```

## Architecture

**Core flow:** Entity → adapters (SQL, GraphQL, REST, forms). The schema is the source of truth; adapters read `Entity.getFields()`.

**Field = 4 axes** — `shape` (the shape IS JSON Schema), `role` (primary, ref…), `lifecycle` (who writes the value and when: create `{value}|'now'|{generate}|'optional'`, update `'now'|'forbidden'`), `boundary` (readOnly/writeOnly → `inputFields`/`outputFields`).
**La validation juge, le storage réalise** : the façade judges client input (unknown keys → `Unknown field`); handlers write freely through the ORM, which realizes lifecycle rules.

**Prefab ops** — `Crud(Post)` gives the five typed CRUD ops. `Crud(Post, { list: PostCard })` names the view **one op** emits: a declaration only, the handler keeps its full-row ORM so judges still read every field, and the façade projects each result onto its view. `Crud(Post, PostPublic)` is the handler-wide form and does scope the injected ORM.

**Operation contract, three producers** — the façade consumes `OperationContract` and nothing else, so the scan is a convenience, not a dependency. A prefab **declares** (`Crud.__ops`, runtime, survives a scan that resolved nothing), the scan **derives** from source, `frond.config.ts` **states** (`operations: { archive: { binding: [...] } }`) and wins over both. Config also *creates* an op neither producer found — the only answer for a method inherited from an **installed** base class, which the workspace-only heritage scan cannot see. `input` and `binding` only: `OperationContract.output` has no reader (the scan fills it, the façade projects through `__opOutputs`/`__output`).

**Call contract** (`core/src/call.ts`) — a Frond call is a value `(entity, op, invocation)`. `createLocalRunner` executes locally; `createAppRunner` follows the topology (local façades + remote doublures). Transports move the value, never reshape it. In-process = direct memory execution, no RPC. Browser-safe surface: `@fougere/core/contract`.

**Nuxt primitives** — `useQuery`/`useCommand` (a command on X revalidates mounted queries on X), `useFormFor` (contract, not rendering; local judge = remote judge), `useCurrentUser`, `invoke` (server dual, state via async context). Metadata = the imported entity class, nothing serialized to the client.

**Validation** — `@cfworker/json-schema` (edge-safe). `Entity.validate(input)` → `{ success, data }` | `{ success: false, errors: [{path, message}] }`.

## Conventions

- TypeScript strict, ESM, ES2022, Node16 resolution ; pnpm ; vitest ; no decorators, no Zod
- **TS 7 (native tsc) at the root** ; `packages/core` pins TS 5.9 — the scanner uses the compiler JS API, dropped in TS 7 (exit: oxc-parser, planned)
- `"types": ["node"]` explicit in tsconfig.base — TS 7 dropped automatic @types
- Field detection via `__brand === 'fougere_field'`
- `resolveStorage()` (`@fougere/runtime`) is the **single** place that defaults a missing db path — never recompute it elsewhere
- `graphql` deduplicated across the workspace (override + hoist)
- `better-sqlite3` bindings may need `npx prebuild-install` in its pnpm dir
- Commits : titre + 1-3 lignes. Jamais `git add -A` (sessions parallèles)

## Known issues

Fact — where — state. The reasoning lives in the notes, not here.

- **Nothing judges a value leaving the domain.** A `oneOf`/`email`/`number` violation written through the ORM persists silently (2026-07-25) — the DB catches only nullability and column type, the DDL emits no `CHECK`. The judge belongs in `core`, domain side of `EntityOrm`, never in `schema-sql`. Not implemented. (The *conversion* half is done — see `schema-sql/src/values.ts`.)
- **The façade throws away the value it parsed.** `core/src/bootstrap.ts:231` keeps only `result.success` ; `binding.ts:135` pushes the raw body. So the handler receives the wire form (a `string` where the field declares `Date`), and `boundary.in.decode` runs on every call for nothing. Prerequisite to the entry above.
- **`role.unique` / `role.index` are never realized.** No vocabulary word produces them, no DDL emits them ; only `describe`/`reconstruct` carry them — a portable card promises uniqueness nothing enforces.
- **Seed order in the Nuxt module is not a topological sort** (`fougere-nuxt/src/module.ts:55`) : a pairwise comparator, which violates dependency order on most initial orderings. `schema-sql` has a real one.
- **The scan cache is keyed on source, not parser version** (`core/src/scan-cache.ts`) : change the parser, or a base class a file inherits from, and unchanged handlers keep returning a **stale parse**, silently. Cost a real diagnosis (`rm -rf .fougere`). A version stamp in the envelope closes it.
- **Heritage resolution is workspace-only** (`core/src/handler-parser.ts`) : from an *installed* app it finds nothing and says nothing. Security consequence closed — a prefab declares its ops at runtime (`Crud.__ops`), proven by `tests/crud-contract.test.ts`. An **escape hatch** now exists — state the contract in `frond.config.ts` (`tests/config-contract.test.ts`). What remains : the silence. A method inherited from a *published* base class with no `__ops` and no config entry is still absent from the façade without a word. State the unresolved clause at boot.
- **`OperationContract.output` has no reader** : the scan fills it from the return type (`scanner.ts:196`), the façade projects through `__opOutputs`/`outputOverride`/`__output` instead. A declared slot nothing interprets — same shape as `role.unique`. Either wire it into `outputFieldsFor` (a semantic change: every op's return type would become its egress view) or drop it.
- **A split receiver trusts the `state` it is handed** (`transport/http/src/server.ts`) : identity read straight off the wire. Held only by the `127.0.0.1` default of `serve()` — unwritten, not guaranteed. Deferred 2026-07-25 : the answer is frond-level auth, not a link secret. Do not ship a non-loopback `serve()`.
- **Collectors register per-frond** : under a split, a handler depending on another frond's collector silently loses it. Keep collectors in the consuming frond.
- The signature parser is AST-only : type aliases are invisible — spell `User | null`, not `type CurrentUser = ...`
- Nitro prod build does not trace `drizzle-orm` under pnpm — see `site/Dockerfile`
- `graphql` dual ESM/CJS hazard in tests — use `schema.getTypeMap()`, not `printSchema()`
