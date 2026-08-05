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
site/                  The Fougere site, built with Fougere — see site/README.md
demos/
  nuxt-blog/           FLAGSHIP — primitives, auth, draft→publish, lived split
  schema-ecommerce/    SQLite + Apollo Server
  container-basics/ core-scanner/ multi-frond/ crud-auto/ auth-better/
```

## Architecture

**Core flow:** Entity → adapters (SQL, GraphQL, REST, forms). The schema is the source of truth; adapters read `Entity.getFields()`.

**Entity declarations** — the 2nd arg of `entity()` is what the entity states about *itself*: `unique` (field groups unique together, realized as a table constraint by `schema-sql`) and `hints` (per-adapter, per-field). One object, not a growing parameter list. A derivation that drops a member of a unique group drops the group.

**Field = 4 axes** — `shape` (the shape IS JSON Schema), `role` (primary, ref…), `lifecycle` (who writes the value and when: create `{value}|'now'|{generate}|'optional'`, update `'now'|'forbidden'`), `boundary` (readOnly/writeOnly → `inputFields`/`outputFields`).
**La validation juge, le storage réalise** : the façade judges client input (unknown keys → `Unknown field`); handlers write freely through the ORM, which realizes lifecycle rules.

**Prefab ops** — `Crud(Post)` gives the five typed CRUD ops. `Crud(Post, { list: PostCard })` names the view **one op** emits: a declaration only, the handler keeps its full-row ORM so judges still read every field, and the façade projects each result onto its view. `Crud(Post, PostPublic)` is the handler-wide form and does scope the injected ORM.

**Operation contract, three producers** — the façade consumes `OperationContract` and nothing else, so the scan is a convenience, not a dependency. A prefab **declares** (`Crud.__ops`, runtime, survives a scan that resolved nothing), the scan **derives** from source, `frond.config.ts` **states** (`operations: { archive: { binding: [...] } }`) and wins over both. Config also *creates* an op neither producer found — the only answer for a method inherited from an **installed** base class, which the workspace-only heritage scan cannot see. `input`, `binding` and `description` — `description` being the method's own doc sentence, which the scan reads from the AST (`handler-parser.ts`, `docSentenceOf`) and the identity card carries. `OperationContract.output` is read by the projections but not by the façade, which still goes through `__opOutputs`/`__output` — see Known issues.

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
- Commits: title + 1-3 lines. Never `git add -A` (parallel sessions)

## Known issues

Fact — where — state. The reasoning lives in the notes, not here.

- **The shape is now held on three paths, and the entry that said otherwise was stale.** `guardStorage` (`core/src/egress.ts:183`, since 1544d10, 2026-07-29) judges every write through the ORM port; the façade judges client input; and the DDL now emits `CHECK` for `oneOf`/`min`/`max` (`schema-sql/src/check.ts`), so `orm.client` and any writer that is not us — raw SQL, another process, a human at a prompt — meets the bound too. `pattern`/`format` stay at the façade on purpose: regex dialects diverge, and a constraint that means something different per engine is worse than none.
- **The façade throws away the value it parsed.** `core/src/bootstrap.ts:231` keeps only `result.success` ; `binding.ts:135` pushes the raw body. So the handler receives the wire form (a `string` where the field declares `Date`), and `boundary.in.decode` runs on every call for nothing. Prerequisite to the entry above.
- **Seeding is one declaration now** (`core/src/seed.ts`) : `orderSeeds` (Kahn, like `orderTables`) and `runSeeds` (the loop, with its storage fallback). `boot()` had no order at all and the Nuxt module generated a second loop into its Nitro plugin — the one that runs when you open the app, and the one that had lost the fallback. Both call core. Remaining: a seed cycle is not satisfiable by ordering, so its members keep scan order and fail at the driver.
- **Heritage resolution is workspace-only** (`core/src/handler-parser.ts`) : from an *installed* app it finds nothing and says nothing. Security consequence closed — a prefab declares its ops at runtime (`Crud.__ops`), proven by `tests/crud-contract.test.ts`. An **escape hatch** now exists — state the contract in `frond.config.ts` (`tests/config-contract.test.ts`). What remains : the silence. A method inherited from a *published* base class with no `__ops` and no config entry is still absent from the façade without a word. State the unresolved clause at boot.
- **`OperationContract.output` is read by the projections, not by the façade** : the scan fills it from the return type (`scanner.ts:193`), REST reads it (`schema-rest/src/routes.ts:212`) and GraphQL now does too (`schema-graphql/src/pothos.ts`, `resolveOutputType`). The façade still projects through `__opOutputs`/`outputOverride`/`__output`. (An earlier entry here claimed it had NO reader — that was wrong, REST always did.) Wiring the façade is the remaining half, with one trap: if the return type made the view *closed*, `list(): Promise<Post[]>` would stop receiving presenter fields. So it should give the FIELDS; only an explicit `__opOutputs` closes.
- **Only the identity card reads an operation's `description`.** The sentence now travels (scan → contract → `rpc.discover`), but the two surfaces that could publish it do not: `schema-graphql/src/pothos.ts` sets no Pothos `description` and `schema-rest/src/routes.ts` emits no `summary` — zero occurrences in either. So a GraphQL explorer shows undocumented fields and the REST routes cannot produce a usable OpenAPI, while the sentence sits one field away. Same gap in three projections, one cause.
- **`CrudViews` is typed on the five CRUD names** (`core/src/crud.ts:46-49`), so a custom op cannot name its output view — while `bootstrap.ts:231` would already honour any op name. One line to widen; the type is what blocks, not the machinery.
- **`remotes:` names one address per frond, so the same frond cannot be deployed twice.** The key is the frond *name* — a type — while a deployment has *instances* (three sensor nodes running the same domain). A consumer reaches one of them and can never designate among them. Today's answer is modelling, not topology: make the node a datum (a `Node` entity) and let one instance aggregate the others, so `remotes:` names only the aggregator. Blocking the day a consumer must address a specific instance. Not implemented.
- **A named surface serves nothing when the frond is remote** (`core/src/bootstrap.ts`, `facadeFor`) : a surface key resolves in the local container only, so a consumer cannot expose a restricted version of a remote frond — its `public` door answers NOT_FOUND on everything. True of all three doors. The coherent answer is composition (the consumer's `public` calls the remote's `public`), not shipped.
- **A split receiver trusts the `state` it is handed** (`transport/http/src/server.ts`) : identity read straight off the wire. Held only by the `127.0.0.1` default of `serve()` — unwritten, not guaranteed. Deferred 2026-07-25 : the answer is frond-level auth, not a link secret. Do not ship a non-loopback `serve()`.
- **A presenter costs one read per row, on every door** (`core/src/egress.ts`) : the façade applies it now, so a computed field doing I/O is an N+1 on `useQuery` as much as on GraphQL. Name a view for the op (`Crud(P, { list: Card })`) to close it, or batch in the handler.
- **Collectors register per-frond** : under a split, a handler depending on another frond's collector silently loses it. Keep collectors in the consuming frond.
- The signature parser is AST-only : type aliases are invisible — spell `User | null`, not `type CurrentUser = ...`
- Nitro prod build does not trace `drizzle-orm` under pnpm — see `site/Dockerfile`
- `graphql` dual ESM/CJS hazard in tests — use `schema.getTypeMap()`, not `printSchema()`
