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
  schema-sql/          Entity → Kysely tables (SQLite/PG/MySQL/MSSQL)
  schema-graphql/      Entity → Pothos types/inputs/CRUD
  schema-rest/         REST projection
  container/           Container interface (zero deps)
  container-fougere/   Implementation — type-based DI, AST scan
  core/                Scanner, bootstrap, call contract, doublures, Crud, binding
  transport/http/      JSON-RPC 2.0 wire (serve + client subpath)
  app/nuxt/            `@fougere/nuxt` — client primitives + server surface
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
**La validation juge, le storage réalise** : the façade judges client input (unknown keys → `Unknown field`); handlers write freely through the ORM, which realizes lifecycle rules — by calling `applyCreate`/`applyUpdate` (`schema/src/projections/lifecycle.ts`), the one realization every storage shares. Refusing is still the judge's: `update: 'forbidden'` lives in `validateFields`, patch mode.

**Repository(Entity)** — where an entity's queries are named. `EntityOrm` is a port (five generic gestures); "the readings of the last hour" is not one, so it used to be spelled at the call site inside the calculation it feeds. `repositories/` and `services/` were already scanned as providers; what is new is the **default**: every entity gets `{ orm }` registered under `ReadingRepository`, so a handler may ask for one before anyone writes the file, and a declared class wins under the same key. Same shape either way — `repo.orm` exists in both, which is what makes the convention true. Not a door: a repository has no façade, so a judge still belongs in the handler.

**Prefab ops** — `Crud(Post)` gives the five typed CRUD ops. `Crud(Post, { list: PostCard })` names the view **one op** emits: a declaration only, the handler keeps its full-row ORM so judges still read every field, and the façade projects each result onto its view. `Crud(Post, PostPublic)` is the handler-wide form and does scope the injected ORM.

**Operation contract, three producers** — the façade consumes `OperationContract` and nothing else, so the scan is a convenience, not a dependency. A prefab **declares** (`Crud.__ops`, runtime, survives a scan that resolved nothing), the scan **derives** from source, `frond.config.ts` **states** (`operations: { archive: { binding: [...] } }`) and wins over both. Config also *creates* an op neither producer found — the only answer for a method inherited from an **installed** base class, which the workspace-only heritage scan cannot see. `input`, `binding` and `description` — `description` being the method's own doc sentence, which the scan reads from the AST (`handler-parser.ts`, `docSentenceOf`) and the identity card carries. `OperationContract.output` is read by the façade too (`bootstrap.ts:295`, under `__opOutputs` and above `__output`), so one contract answers all three doors.

**Call contract** (`core/src/call.ts`) — a Frond call is a value `(entity, op, invocation)`. `createLocalRunner` executes locally; `createAppRunner` follows the topology (local façades + remote doublures). Transports move the value, never reshape it. In-process = direct memory execution, no RPC. Browser-safe surface: `@fougere/core/contract`.

**`Emit<T>` / `Fact<T>`** (`core/src/emit.ts`) — every other call names ONE recipient; an emission names a **subject**. `Emit<PostPublished>` is a constructor dependency resolved by type like `EntityOrm<Post>`, and accepting a `Fact<T>` IS the subscription — no topic, no register call, the scan reads the signature. It is a **resolver, not a channel**: it answers *who*, then hands over to the door that already exists, which is why nothing is durable (a resolver holds nothing) and why a subscriber keeps its judge, its binding and its middlewares. Dispatch is not delivery; a ring is refused (`AsyncLocalStorage`, a chain not a depth), a diamond is legal. Across a repository, `onEmit` carries the fact out under its name and `app.deliver` brings one in; the identity card's `facts` list carries the SHAPE so `fougere sync` writes the class the subscriber used to copy by hand.

**Nuxt primitives** — `useQuery`/`useCommand` (a command on X revalidates mounted queries on X), `useFormFor` (contract, not rendering; local judge = remote judge), `useCurrentUser`, `invoke` (server dual, state via async context). Metadata = the imported entity class, nothing serialized to the client.

**Validation** — `@cfworker/json-schema` (edge-safe). `Entity.validate(input)` → `{ success, data }` | `{ success: false, errors: [{path, message}] }`.

## Conventions

- TypeScript strict, ESM, ES2022, Node16 resolution ; pnpm ; vitest ; no decorators, no Zod
- **TS 7 (native tsc) at the root** ; `packages/core` pins TS 5.9 — the scanner uses the compiler JS API, dropped in TS 7 (exit: oxc-parser, planned)
- **`.vue` files are not type-checked** ; `typecheck` is `tsc -p fronds`, which covers the Frond and stops at the SFC. `vue-tsc` would cover them but requires `typescript/lib/tsc` — a path the native tsc no longer exports, and its `>=5.0.0` peer range does not say so. Adding it means lowering TS *and* carrying a pinned Nuxt dependency graph to keep it green. Rejected 2026-08-06; revisit when vue-tsc runs on TS 7.
- `"types": ["node"]` explicit in tsconfig.base — TS 7 dropped automatic @types
- Field detection via `__brand === 'fougere_field'`
- `resolveStorage()` (`@fougere/runtime`) is the **single** place that defaults a missing db path — never recompute it elsewhere
- `graphql` deduplicated across the workspace (override + hoist)
- `better-sqlite3` bindings may need `npx prebuild-install` in its pnpm dir
- Commits: title + 1-3 lines. Never `git add -A` (parallel sessions)
- **Everything committed to this repository is in English** — commit messages, PR bodies, code comments, doc comments, test names, `README.md`, `CLAUDE.md`. The repository is public and its readers are not assumed to read French. The one exception is `site/content/fr/`, which is a translation target and French by design; `site/content/en/` is its pair, and the two move together. Private design notes live outside this repo and are not covered by this rule.

## Known issues

Fact — where — state. The reasoning lives in the notes, not here.

- **The shape is now held on three paths, and the entry that said otherwise was stale.** `guardStorage` (`core/src/egress.ts:183`, since 1544d10, 2026-07-29) judges every write through the ORM port; the façade judges client input; and the DDL now emits `CHECK` for `oneOf`/`min`/`max` (`schema-sql/src/check.ts`), so `orm.client` and any writer that is not us — raw SQL, another process, a human at a prompt — meets the bound too. `pattern`/`format` stay at the façade on purpose: regex dialects diverge, and a constraint that means something different per engine is worse than none.
- **The façade hands on the value it parsed** — `bootstrap.ts:344` rebuilds the invocation around `result.data`, so a handler receives a `Date` where the field declares one and `boundary.in.decode` earns its call. Proven by `tests/contract-boundary.test.ts` (`decoded: input.when instanceof Date`). The entry that stood here said the opposite, quoting a line number that had moved.
- **The `boundary` axis has two spellings and only one of them fails loudly.** The ALIAS form (`boundary: 'isoDate'`) resolves in `declaredBoundary` and **throws** `Unknown boundary alias` (`schema/src/field/boundary.ts:104`) — loud and local, exactly as `projections/card.ts:22` promises. The DIRECT form (`boundary: { in: { decode: 'celsius' } }`) resolves in `resolveBoundary` and falls back to `identityDecoder`/`identityEncoder` (`boundary.ts:127`) — no throw, no warning, and four readers convert as identity (`entity.ts:214`, `projections/validation.ts:168`, `projections/encode.ts:19`, `schema-graphql/src/pothos.ts:199`). So `card.ts:22` is accurate about the word it uses — *alias* — and says nothing about the other form. It matters where naming a codec instead of shipping a closure is the whole point: a frond declares `{decode: 'celsius'}`, the consumer never registered it, and the value arrives unconverted while the card says it was converted — the same silent loss this repo measured on Remult (`validate: [null, null]`). `demos/rust-frond` is not exposed: its only boundary is `{in: 'closed'}`, a permission facet that converts as identity by design.
- **Seeding is one declaration now** (`core/src/seed.ts`) : `orderSeeds` (Kahn, like `orderTables`) and `runSeeds` (the loop, with its storage fallback). `boot()` had no order at all and the Nuxt module generated a second loop into its Nitro plugin — the one that runs when you open the app, and the one that had lost the fallback. Both call core. Remaining: a seed cycle is not satisfiable by ordering, so its members keep scan order and fail at the driver.
- **Heritage resolution is workspace-only** (`core/src/handler-parser.ts`) : from an *installed* app it finds nothing and says nothing. Security consequence closed — a prefab declares its ops at runtime (`Crud.__ops`), proven by `tests/crud-contract.test.ts`. An **escape hatch** now exists — state the contract in `frond.config.ts` (`tests/config-contract.test.ts`). The silence is closed (f78c510, 2026-08-07) : the parse returns a PAIR — its methods, and the base classes it could not open — so `heritage-unresolved` reaches the boot as a `WRN` naming the clause and the remedy. A warning and not a refusal, because an installed base class with no operation is ordinary and the boot cannot decide between the two. Same run records `directory-unreadable` and `handler-parse-failed`; `ENOENT` stays silent on purpose, an absent convention directory being the convention. `ScanResult.diagnostics` is the one place they live, and `PARSER_VERSION` moved to 4 because the pair travels through the scan cache.
- **`OperationContract.output` now has three readers, the façade included** : the scan fills it from the return type (`scanner.ts:193`), REST (`schema-rest/src/routes.ts:212`), GraphQL (`schema-graphql/src/pothos.ts`, `resolveOutputType`) and the façade (`bootstrap.ts:295`) all read it, and `crudOps` declares it (`core/src/crud.ts`). It gives the FIELDS and does not close the view — only an explicit `__opOutputs` closes — so a presenter's computed fields still ride out of `list(): Promise<Post[]>`. **Re-measured** on `demos/multi-frond/remote-blog` (2026-08-07, ten ops, two entities): `kind` 10/10, `input` 4/10, `output` **8/10** (the two `delete` ops name none — a boolean is not a shape), `description` 0/10 because both handlers are bare `Crud(E)` with no sentence to carry. An earlier version of this entry said `output` had no reader, then that the façade was not one; both were wrong, and the second quoted a line number that had moved.
- **Only the identity card reads an operation's `description`.** The sentence now travels (scan → contract → `rpc.discover`), but the two surfaces that could publish it do not: `schema-graphql/src/pothos.ts` sets no Pothos `description` and `schema-rest/src/routes.ts` emits no `summary` — zero occurrences in either. So a GraphQL explorer shows undocumented fields and the REST routes cannot produce a usable OpenAPI, while the sentence sits one field away. Same gap in three projections, one cause.
- **`CrudViews` is typed on the five CRUD names** (`core/src/crud.ts:46-49`), so a custom op cannot name its output view — while `bootstrap.ts:231` would already honour any op name. One line to widen; the type is what blocks, not the machinery.
- **`remotes:` names one address per frond, so the same frond cannot be deployed twice.** The key is the frond *name* — a type — while a deployment has *instances* (three sensor nodes running the same domain). A consumer reaches one of them and can never designate among them. Today's answer is modelling, not topology: make the node a datum (a `Node` entity) and let one instance aggregate the others, so `remotes:` names only the aggregator. Blocking the day a consumer must address a specific instance. Not implemented.
- **A named surface serves nothing when the frond is remote** (`core/src/bootstrap.ts`, `facadeFor`) : a surface key resolves in the local container only, so a consumer cannot expose a restricted version of a remote frond — its `public` door answers NOT_FOUND on everything. True of all three doors. The coherent answer is composition (the consumer's `public` calls the remote's `public`), not shipped.
- **A split receiver trusts the `state` it is handed** (`transport/http/src/server.ts`) : identity read straight off the wire. `serve()` binds loopback by DEFAULT and `hosts: [...]` widens it (`transport/http/src/serve.ts`) — it used to refuse outright, which blocked the one case that legitimately diverges (a container must bind `0.0.0.0` or the port mapping never lands). `host` must still be a member of `hosts`, so a widened list is not a blank cheque. Deferred 2026-07-25 : the answer is frond-level auth, not a link secret — a shared secret says a process may call, never which user it speaks for. A link secret was tried and removed on 2026-08-06 for exactly that reason; do not reintroduce one.
- **A presenter is handed the page, never a row** (`core/src/egress.ts:147-154`) : one pass per computed FIELD over every row, and a return whose length differs from the row count is refused — so a field that reads issues one query for the page. One place does it, the façade : REST dropped its copy and GraphQL READS the computed value rather than recomputing it (`schema-graphql/src/pothos.ts:537`), so the three doors answer the same thing at the same cost. What the shape cannot force is the body — `Promise.all(rows.map(...))` inside a computed field still issues N reads, and nothing says so.
- **A collector in the wrong frond hands the request BODY to the parameter that wanted a user** (`core/src/binding.ts:90`) : the binding plan is computed from the frond's OWN collector set (`bootstrap.ts:167`), so a handler in `blog` never binds to a collector declared in `identity` — in one process, before any topology. `computeBindingPlan` then falls through to branch 4, "Everything else — body", and the parameter carries what the caller typed. Proven by `tests/collector-frond.test.ts` : `state.user` says `reader`, the body says `admin`, the handler receives `admin`. **Read it as a privilege escalation, not as a topology nuisance** : a handler that writes `if (user.role !== 'admin') throw` is judging a claim the caller made about themselves, and the guard reads as if it held. Scope — a **custom** op whose parameter is an entity type its frond has no collector for : the op declares no input contract, so the façade validates nothing ; a CRUD op takes its input from the entity and is untouched, and the repo's two real collectors sit in the consuming frond. A trap, not an open hole. The entry that stood here said "under a split … silently loses it" : both halves were wrong — no split is needed, and nothing is lost, it is **substituted**. Keep collectors in the consuming frond.
- **`BindingPlan.optional` is written four times and read nowhere** (`core/src/binding.ts:65,74,87,95` — `resolveArgs` consults no branch). So `user?: User` and `user: User | null` behave identically at runtime and differ only in what the type admits : when the collector is missing, the value that arrives is neither a `User` nor `null`. The convention below spells the second, which is the one where the arriving value violates its own declared type — the advice about aliases stays true, its example no longer does.
- **Two writes cannot be made one, and the only way to try turns the judge off.** There is no transaction anywhere in `packages/` (zero occurrences), and `EntityOrm` is five gestures over ONE entity with no unit of work (`core/src/orm.ts:85-91`). So "debit A and credit B, or neither" has a single answer today: `orm.client` — and every judge sits on the ORM's own methods, so a statement issued through the client meets none of them (`orm.ts:93` says exactly that: *"a value the entity refuses lands in the table without a word"*). **Read it as a hole in the guarantee, not as missing sugar** : the one place where several entities change together is the one place `guardStorage` does not run. The scope stays honest — `productOrm.client` reaches the products, not the whole database — but the judge is off either way. What is missing has a name, the aggregate: a boundary that changes together. `unique` covers "not the same pair twice"; it does not cover this.
- **A stored fact is neither judged nor versioned, and that is where the missing time axis costs most.** Keeping a domain event is one line — `class Event extends entity({ type: text(), payload: json() })` — so durability is not the problem. `json()` admits any shape forever, and nothing records which version of the code wrote the row: the card carries `x-fougere-version: 1` (`schema/src/projections/card.ts:113`), which versions the DESCRIPTOR FORMAT and never an entity's contract. `delta()` proposes `createTable` / `addColumn` / `addConstraint` / `createIndex` and nothing else (`schema-sql/src/diff.ts:45-49`) — a type never changes, a column never leaves. A row can be rewritten by hand when the shape moves; **a log cannot**, which is why this bites in event sourcing before it bites anywhere else. `migration = diff(describe(A), describe(B))` is designed and not written, and it would answer both halves.
- The signature parser is AST-only : type aliases are invisible — spell `User | null`, not `type CurrentUser = ...`
- Nitro's prod trace misses lazily-loaded packages under pnpm — `jiti` and core's pinned TS 5.9 are re-added by hand in `site/Dockerfile`, and the icon collections are listed for the server bundle in `site/nuxt.config.ts`. `drizzle-orm` used to head this list; the ORM is Kysely now and needs no such treatment (the entry naming drizzle was stale — the Dockerfile itself says so).
- `graphql` dual ESM/CJS hazard in tests — use `schema.getTypeMap()`, not `printSchema()`
