# CLAUDE.md

Guidance for Claude Code working in this repository.

## What is this

Fougere is a TypeScript framework built on ONE idea, stated in the negative because that
is the form that can be checked: **the declaration names nothing outside itself** — no
table, no protocol, no host, no address. The two things this file used to call its two
ideas are its two readings, and calling them two hid the rule that produces both:

1. **Single-schema** — what the declaration does not name is *derived* from it: one Entity class (`class Post extends entity({...})`) generates validation, DB tables (Kysely), GraphQL types (Pothos), form contracts, API surfaces.
2. **The gradient** — what it does not name is *chosen outside* it: a Frond (entities + handlers + collectors + seeds) runs in-process or in its own process behind JSON-RPC, with **identical user code**. `remotes: { blog: 'http://...' }` in `fougere.config.ts` is the whole topology statement.

Reference docs: `site/content/` (en/fr).

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
pnpm -C demos/ports-swap dev        # stripe, then ogone, then the refusal — one handler
pnpm -C demos/config-reload dev     # one boot, a real SIGHUP, a drain — and what a re-read cannot change
pnpm -C demos/mirror-catalog dev    # two passes over a source that only answers ?page=&since=
pnpm -C demos/sse-live dev         # live fan-out to readers who are not trusted peers
pnpm -C demos/observability dev    # three processes; `pnpm load` (k6) and `pnpm signoz` beside it
pnpm -C demos/together-frame dev   # two writes that stand or fall as one — then uncomment `sources:`
pnpm -C demos/test-gradient test   # 53 tests, 44 of them from a one-line file
pnpm -C demos/test-gradient e2e    # the browser rung — a form that states no rule of its own
```

## Monorepo layout

A directory is a **family**; a family only exists when its name states an invariant.
The npm name repeats the family only when the bare word would be ambiguous — `sql`
alone could be a driver, `nuxt` could only ever be the Nuxt module.

```
packages/
  schema/              @fougere/schema        entity(), field vocabulary, 4 axes, validation
  container/           @fougere/container     type-based DI, zero deps
  core/                @fougere/core          the phases below, and what sits outside them
    src/descriptor/      what a frond is made of, whoever produced it: FrondDescriptor, the entries, Fronds
    src/scan/            the reading itself: scanner, handler-parser, its cache, and what a run could not do
    src/boot/            what createApp does with it: bootstrap, HandlerFacade, Emissions, AppLifecycle, seed,
                         remote, and what is BUILT from an app: its identity card, its runners
    src/dispatch/        what happens per call: Dispatcher, the route registry, the judges and projectors, argument resolution, InFlight
    src/wire/            what travels: the call, the invocation, the operation contract, its signature and
                         binding plan, errors, middleware
    src/contract/        the values a call is made of: Call, Invocation, RouteAddress, CallLog
    src/prefab/          what a user declares: Crud, Presenter, Collector, Repository, Mirror
    src/builtins/        what every app has without asking: the logger, the config service
    src/crypto/          one port, two realizations — node and webcrypto
    src/entry/           the three ways in: a facade, a dynamic facade, a transport
    src/*.ts             what belongs to no phase: the two published entry points, frond(), the storage port
                         and the frame that derives it (rows.ts),
                         emit, the effective operation model, the checkers
  http/                @fougere/http          the HttpRouter port + its express/fastify/hono adapters
  observability/       @fougere/observability optional: a span per op, the four signals, OTLP. Core holds none of it
  defaults/            @fougere/defaults      the conventional boot — the ONE place naming container+storage+transport
  cli/                 @fougere/cli           commands, scaffolding, and the terminal UI (src/ui.ts)
  testing/             @fougere/testing       cases derived from an entity, doubles derived from a port
  calls/               @fougere/calls         optional: a bounded ring of what this process dispatched, served as rpc.calls
  decorators/          @fougere/decorators    `@expose` — publishable, and imported by nobody in this repo

  adapter/                                    project the schema onto a target
    sql/               @fougere/adapter-sql       Entity → Kysely tables (SQLite/PG/MySQL/MSSQL)
    graphql/           @fougere/adapter-graphql   Entity → Pothos types/inputs/CRUD
    rest/              @fougere/adapter-rest      REST projection
    duckdb/            @fougere/adapter-duckdb    one SQL query across `sources:`
    memory/            @fougere/adapter-memory    rows in a Map — and the boot's fallback
    file/              @fougere/adapter-file      one JSON per row, a directory per entity

  app/                                        the front-end
    shared/            @fougere/app           useQuery/useCommand/useFormFor, framework-free
    nuxt/ next/ react/ svelte/ vite/          @fougere/nuxt, /next, /react, /svelte, /vite
    admin/             @fougere/admin         React Admin derived at runtime from the identity card

  transport/                                  move a call between processes
    http/              @fougere/transport-http    JSON-RPC 2.0 wire (serve + client subpath)

  auth/
    better/            @fougere/auth-better   better-auth translation layer

  entry/                                      the name a human types — holds no code
    fougere/           fougere                `npx fougere`
    create/            create-fougere         `npm create fougere`
site/                  The Fougere site, built with Fougere — see site/README.md
demos/
  nuxt-blog/           FLAGSHIP — primitives, auth, draft→publish, lived split
  schema-ecommerce/    SQLite + Apollo Server
  ports-swap/          one handler, two PSPs, and the `ports:` line that decides
  config-reload/       the config re-read under a running app, the drain, and what it refuses to change
  mirror-catalog/      a copy of rows the app cannot query, and what the second pass costs
  together-frame/      one frame, two realizations, and the config line that picks one
  observability/       three Fronds in three processes, one trace — and what the wire cost
  test-gradient/       what the declaration writes on its own, and the four rungs it runs at
  anchor-chain/        a path with two stops — which derivations hold rows, and which say nothing
  emit-multirepo/      two repositories, one fact, and the ~80-line carrier that is not Fougere's
  rust-frond/          the far side is not TypeScript, and the judge is still ours
  cloudflare-d1/       the edge rung — scan emitted, no tsc shipped
  admin-panel/ one-declaration/ express-blog/ next-blog/ sveltekit-blog/
  react-router-blog/ tanstack-blog/ multi-transport/ emit-fleet/ emit-split/
  container-basics/ core-scanner/ multi-frond/ crud-auto/ auth-better/
```

`pnpm-workspace.yaml` globs `packages/*` and `packages/*/*` rather than naming each
family — the list was a second copy of the tree, and it went stale the day a family
was added. A package's `tsconfig.json` extends the root by a relative path, so its
depth is encoded there: check it when a package moves families.

## Architecture

Entity → adapters (SQL, GraphQL, REST, forms). The schema is the source of truth; adapters
read `Entity.getFields()`. The reasoning behind each line below lives in
`fougere-notes/docs/notes/`, not here.

**A field has four axes** — `shape` (which IS JSON Schema), `role` (primary, ref…),
`lifecycle` (who writes the value and when), `boundary` (readOnly/writeOnly). A field is
recognized by its FORM: it states a `shape`. `new Field(field, key)` is the door, and a
shapeless entry is refused there.

**The façade judges, the storage realizes.** Client input goes through the façade (unknown
keys → `Unknown field`); handlers write freely through the storage, which applies
`applyCreate`/`applyUpdate` (`schema/src/axis/lifecycle/apply.ts`). Refusing stays the
judge's: `update: 'forbidden'` lives in `RowJudge`, patch mode.

**An entity states two things about itself** — `unique` and `adapters`, the 2nd argument of
`entity()`. A derivation that drops a member of a unique group drops the group.

**`adapters:` is addressed, and the effect is the adapter's to name.**
`FougereEntityAdapters` (`schema/src/entity/EntityAdapters.ts`) is an EMPTY interface an
adapter augments from outside, so `schema` learns no engine. `adapter/sql` is its only
reader (`adapter/sql/src/fields.ts`), and `columnType` is indexed BY ENGINE, so an engine
the entity did not name keeps what the shape would give. `EntityAdapterSet`
(`schema/src/entity/EntityAdapterSet.ts`) owns the two levels an entry is addressed by —
adapter name, then field name — and always exists, so `getAdapters()` is never `undefined`.
What the OPERATOR decides is not stated here: it belongs in `fougere.config.ts` beside
`remotes:`, `sources:` and `ports:`. Pinned by `adapter/sql/tests/adapters.test.ts`.

**The entry has a judge, and the adapter writes it as DATA.** `EntryJudge`
(`schema/src/judge/EntryJudge.ts`) takes a format and refuses what it does not admit;
`adapter/sql/src/adapter.schema.json` is that format, imported with `with { type: 'json' }`,
and `SqlField` is DERIVED from it. It is judged where the adapter READS
(`adapter/sql/src/table.ts`, `toTable`), not at `entity()`, because `entity()` runs at its
own module's evaluation. A name this process never loaded is SKIPPED: only the project can
tell it from a typo, which is what `fougere check` reports as `unknown-adapter`.

**A registry is an instance of `Registry<T>`** (`schema/src/lib/Registry.ts`). `Formats`,
`Generators` and the three of `Boundaries` are bare instances; `Sources` extends it to add
`open`. `resolve` throws and lists what the process answers; `find` returns `undefined` for
a caller that has its own words for the absence. `Clock` is not one: it registers nothing.

**`Repository(…entities)` — the arity is the declaration.** At ONE, the repository IS that
entity's storage and forwards all thirteen gestures. From TWO on it is an aggregate: no
default repository for any member, no forwarded gesture, and `ownersOf` refuses two
aggregates over one entity. `Crud` on an owned entity is refused at boot
(`refuseCrudOnOwned`). `Storage<E>` is not a word of user code
(`core/src/boot/ownership.ts`): a handler, a presenter and a collector are pointed at
`<E>Repository`. Pinned by `core/tests/aggregate.test.ts`.

**Turning the ring** — `reloadFougere()` (`app/shared/src/boot.ts`) builds the app again and
releases the previous one; it works because every door reaches the app through
`useFougereApp()` inside the request it serves. `app.dispose()` runs three levels in reverse
of construction: each extension's `down`, then `container.dispose()`, then
`CreateAppOptions.onDispose`. `app.drain(timeoutMs?)` closes the door and resolves once
running calls finish (counted in `dispatch/InFlight.ts`); it REJECTS on its deadline naming
what is left. A call arriving after the door closed gets `SERVICE_UNAVAILABLE`. Pinned by
`tests/dispose.test.ts` and `tests/drain.test.ts`.

**The ascent** — `boot/AppLifecycle.ts`. An `Extension` states `up` and `down`, handed in
through `CreateAppOptions.extensions`. A name already declared is REPLACED, not refused.
`migrating(storage.migrate)` and `seeding(report)` are ordinary members. The two halves
refuse in opposite ways: `up` stops at the first refusal, `down` releases every member and
sends the refusals together in an `AggregateError`. An extension belongs to the PROCESS, not
to a frond. Pinned by `tests/lifecycle.test.ts`.

**`rpc` is a registry, not an `if`** — `wire/call.ts`, `RPC_ENTITY`, served out of
`dispatch/RouteRegistry.ts`. `app.serveRpc(op, answer)` is how an optional package declares
a reading core does not hold, and a second declaration of one name is REFUSED. An app that
never installed `@fougere/observability` answers `Unknown rpc operation 'topology'. It
serves discover.` The report shapes live in core (`TopologyReport`, `FrondPlacement`, `Edge`)
because they cross a process boundary.

**The names the scan reads** — `scan/conventions.ts`. Everything else a frond states, it
states by its SHAPE; the eight convention directories and the import scope are the one place
a NAME is the declaration, and the only ones a project may restate (`conventions:` in
`fougere.config.ts`). The config is read BEFORE the aliases, because it names the scope they
are built from. `.fougere/` is the framework's working directory, not user vocabulary.
Pinned by `tests/conventions.test.ts`.

**Config, consulted vs consumed** — `boot/apply.ts`, `applyConfig`. A value CONSULTED at use
can move; a value CONSUMED to build something cannot. `logLevel` is the only consulted key
today, and every other difference is reported as `pending`. `Logger` holds NO level:
`setLogLevel` sets one threshold for the process. `FOUGERE_LOG_LEVEL` wins over the file. A
re-read needs `loadConfig(root, { fresh: true })` — a module is cached by its specifier.
Core catches no signal: a process belongs to its host. Pinned by `tests/log-level.test.ts`.

**Ports** — a class something already answers under, that a provider extends. Nothing
declares one: `boot/ports.ts`, `portBindings` reads the prototype chain at boot, so
`class StripePayment extends Payment` IS the registration. Two implementations REFUSE at
boot naming both; `ports: { Payment: 'StripePayment' }` settles it. Only the direct base
binds. A builtin is a port too: `class AuditLogger extends Logger` takes the `Logger` key
for that frond. Pinned by `tests/ports.test.ts`.

**Sources** — a place rows live, and the four gestures it owns: `storageFactory` (required),
`migrate?`, `transacted?`, `close?` (`core/src/source.ts`). What a source is MADE OF is not
there: `adapter/sql` states `dialect`, `db` and `sink` on its own `SqlSource`. The migration
is the source's own gesture; the router partitions and hands each source its `SourceView`.
`source:` names the ADAPTER and `dialect` stays SQL's. No `transacted` means a frame
compensates instead of transacting, and the boot says so per frame. Pinned by
`defaults/tests/sources.test.ts`.

**The thirteen gestures derive from four** — `core/src/rows.ts`, `storageOver(open)` over a
`Rows` (`get`/`has`/`set`/`delete`/`all`/`client`). `adapter/memory` is 37 lines and
`adapter/file` 105. `transacted` is deliberately not in the frame: a unit of work belongs to
an engine that has one. `all()` reading everything is what bounds a file source.

**Prefab ops** — `Crud(Post)` gives the five typed CRUD ops. `Crud(Post, { list: PostCard })`
names the view ONE op emits: the handler keeps its full-row storage, and the façade projects.
`Crud(Post, PostPublic)` is the handler-wide form and scopes the injected storage.

**A test states what it expects** — `@fougere/testing`. The CASES come from `RowRefusal`'s
closed set read against the four axes (`Cases`, in `@fougere/schema` because deriving them
reads the axes and nothing else), the DOUBLES from a port's prototype (`stubOf`), and the
LEVEL from where the file sits. `checkDoors` compares REST against GraphQL; `driftOf`
compares two `rpc.discover` cards through `Card.diff`.

**Operation contract, three producers** — the façade consumes `OperationContract` and
nothing else. A prefab DECLARES (`Crud.__ops`, runtime), the scan DERIVES from source,
`frond.config.ts` STATES and wins over both. Config also creates an op neither producer
found — the answer for a method inherited from an installed base class. `description` is the
method's own doc sentence, read from the AST (`scan/handler-parser.ts`, `docSentenceOf`).

**Call contract** (`core/src/wire/call.ts`) — a Frond call is a value `(entity, op,
invocation)`. `createLocalRunner` (`boot/runner.ts`) executes locally, `createAppRunner`
follows the topology, `identityCardOf` (`boot/card.ts`) answers `rpc.discover`. Transports
move the value, never reshape it. Browser-safe surface: `@fougere/core/contract`.

**`Emit<T>` / `Fact<T>`** (`core/src/emit.ts`, dispatched by `boot/Emissions.ts`) — every
other call names ONE recipient; an emission names a SUBJECT. Accepting a `Fact<T>` IS the
subscription — no topic, no register call. It is a resolver, not a channel: nothing is
durable, and a subscriber keeps its judge, its binding and its middlewares. A ring is
refused, a diamond is legal. Announcing returns once every subscriber has been HANDED the
fact; `app.deliver` waits for them all and REJECTS with an `AggregateError`. A fact is
judged strictly. Pinned by `tests/emit.test.ts`.

**A family cycle is a check** — `tools/cycle-check.mjs`, `pnpm arch:cycles`, run in CI beside
`pnpm arch`. `arch` asks what a file REACHES, this asks where it LIVES. It reports type-only
cycles too and marks what the emitted JS does not contain, and it prints the THIN SIDE
because that is what moves. It reads pairs, which is its ceiling. Three exceptions are stated
with their reason: `judge`↔`schema`, `projection`↔`schema`, `entity`↔`schema`.

**Nuxt primitives** — `useQuery`/`useCommand` (a command on X revalidates mounted queries on
X), `useFormFor` (contract, not rendering; local judge = remote judge), `useCurrentUser`,
`invoke` (server dual, state via async context). Metadata is the imported entity class.

**Validation** — `@cfworker/json-schema` (edge-safe). `Entity.validate(input)` →
`{ success, data }` | `{ success: false, errors: [{path, message}] }`.

## Conventions

- TypeScript strict, ESM, ES2022, Node16 resolution ; pnpm ; vitest ; no decorators, no Zod
- **`module` is `node20`, `moduleResolution` stays `Node16`** — `Node16` refuses an import
  attribute (TS2823), and an adapter states its entry format as a `.json` it imports.
  `resolveJsonModule` is on for the same reason.
- **TS 7 (native tsc) at the root** ; `packages/core` compiles and scans with
  `@typescript/typescript6` — measured ~25 % faster than 5.9 on the scan's program, same
  answer. `unstable/` is not a destination yet, and neither is oxc while the scan reads types.
- **`.vue` files are not type-checked** — `typecheck` is `tsc -p fronds` and stops at the SFC.
  `vue-tsc` needs `typescript/lib/tsc`, a path the native tsc no longer exports. Rejected
  2026-08-06; revisit when vue-tsc runs on TS 7.
- `"types": ["node"]` explicit in tsconfig.base — TS 7 dropped automatic @types
- `resolveStorage()` (`@fougere/defaults`) is the single place that defaults a missing db path
- `graphql` deduplicated across the workspace (override + hoist)
- `better-sqlite3` bindings may need `npx prebuild-install` in its pnpm dir
- **Measure before concluding.** On a design question, run the grep or the probe FIRST and
  answer with the number.
- **The code is meant to stand on its own.** If a comment is about to explain something,
  change the code instead. Measured: he writes 4-5 % comments across fifteen years, this
  repo was at 31-37 %. `fougere-notes/docs/notes/style-chok.md` holds the rest — how a tree
  is cut, how a thing is named, and the words to avoid.
- **Never cite a line number in this file.** A path plus a SYMBOL survives a refactor;
  `bootstrap.ts:295` survives neither an edit nor a move. Measured 2026-08-17: five of eleven
  line references already pointed at a blank line or an unrelated comment.
- **Probe the Known issues by commit recency**, not by how old an entry looks —
  `python3 scripts/stale-notes.py --since 7`. Measured over 31 entries: the six that were
  false all cited code touched in the last seven days.
- Commits: title + 1-3 lines. Never `git add -A` (parallel sessions)
- **Everything committed here is in English** — commit messages, PR bodies, comments, tests,
  `README.md`, `CLAUDE.md`. The one exception is `site/content/fr/`, a translation target.

## Known issues

Fact — where — state. The reasoning lives in `fougere-notes/docs/notes/`.

- **An un-augmented `adapters:` accepts anything, silently.** With no adapter in the program
  `EntityAdapters<TFields>` is `Partial<{}>`, which in TypeScript means "anything
  non-nullish". The RUNTIME half is closed since `EntryJudge`; what remains open is the type.
- **A seed cycle is not satisfiable by ordering** — `core/src/boot/seed.ts`, `orderSeeds`.
  Its members keep scan order and fail at the driver.
- **Nothing generates OpenAPI**, so `RouteDefinition.description` is read by nobody. The op's
  sentence has two readers, neither of them REST: `adapter/graphql/src/pothos.ts` and the
  CLI's `--help`.
- **`CrudViews` is typed on the five CRUD names** (`core/src/prefab/crud.ts`). Widening it to
  admit a custom op also admits `{ lst: Card }`, the typo the five names catch. Measured
  2026-08-24: zero custom ops want a closed view.
- **`remotes:` names one address per frond**, so the same frond cannot be deployed twice. The
  key is a frond NAME, a type, while a deployment has instances. Not implemented.
- **A named surface serves nothing when the frond is remote** — `boot/bootstrap.ts`,
  `facadeFor` resolves a surface key in the local container only. True of all three doors.
- **`expose` is a third membership mechanism, and the membership rule is blind to it.** The
  scan sets `e.exposed`/`h.exposed`, never `surfaces`. Three readers, one inside core
  (`effective-operation.ts`, `exposedAdapters`). `packages/decorators` holds the method-level
  `@expose` and is simply not wired yet — that is a state, not a defect.
- **The Nuxt codegen reads three members of the storage and drops the rest** —
  `app/nuxt/src/module.ts`, `generateBootPlugin`. So a `Together` always compensates and the
  connection is never closed. Same shape in `boot.ts`'s `BootOptions.db`.
- **The cross-source read is raw SQL while `ref()` already declares the join.** `orderBy`
  swallows a path in silence (`adapter/sql/src/crud.ts`). The next step is the two-source demo.
- **A computed field that reads still issues N queries.** The façade hands the presenter the
  PAGE (`dispatch/PresenterExecutor.ts`), so one query per page is possible, but
  `Promise.all(rows.map(...))` inside the field body is not refused.
- **`BindingPlan.optional` is written five times by core and ignored by `resolveArgs`.** Not a
  missing reader: making it refuse breaks four tests, two of which state the opposite policy
  on purpose. Closing it means choosing which door is right.
- **`storage.client` remains the anonymous multi-statement path, judge off** — everything else
  writes through a guarded port, `Together<[…]>` included.
- **A provider class named `<Entity>Storage` takes that entity's key**, silently. The name is
  already wrong by two rules, which is why nothing hits it; left as is.
- **`Mirror` writes two useful lines and 120 that belong to the port**
  (`core/src/prefab/mirror.ts`). `judgePage` exists because `StorageGuard` guards `create` and
  `update` and not `upsert`. Decided, not done: delete the prefab.
- **An announcement realizes a fact's `lifecycle.create`, and no typed emitter can use it.**
  `Emit<T>` names the ROW type where `created()` is required, so `announce({ id, title })` is a
  compile error. `PartialRow` is the wanted shape.
- **A nested object reports no path to the field that failed.** `Outer.validate({ addr: {
  street: 'a' } })` answers `path: 'addr'`. The inner path is computed and thrown away; a
  nested path wants segments, which eleven sites interpret as a flat string today.
- **A required field with no default is `NOT NULL` on a fresh table and NULLABLE on a migrated
  one** — `changeSQL` (`adapter/sql/src/diff.ts`). The refusal that names it lives on the
  other road (`planStep`), which only `fougere migrate` reaches.
- **`unique()` added to a live table never lands** — `delta()` proposes `createIndex` only for
  a column carrying `index`, and a sole `unique()` carries none. Not patchable as is:
  `CREATE UNIQUE INDEX` on a table holding duplicates fails.
- **A schema can say what it WAS, and the missing reader is the API.** `Card.diff`,
  `fougere freeze`, `fougere migrate --apply` are shipped; serving an old API version is not.
- **A stored fact is neither judged nor versioned.** `json()` admits any shape forever, and
  `x-fougere-version` versions the DESCRIPTOR FORMAT, never an entity's contract.
- **`flushMs: 0` is the only legal form on a Worker, and nothing says so.** `Beat.every`
  (`observability/src/Beat.ts`) defaults to 1000 ms, so an app built at module scope builds
  its exporter — and its `setInterval` — there. Cloudflare REFUSES that deployment:
  "Disallowed operation called within global scope", error 10021, measured 2026-08-23.
- **Nitro's prod trace misses lazily-loaded packages under pnpm**, which is why the hand-copy
  in `site/Dockerfile` exists.
- **Three free functions in `schema` are candidates nobody has judged** — `clean` decides
  nothing, `fieldsOf` and `schemaOf` are methods of an owner that now exists (`SchemaOrCard`).
- `graphql` dual ESM/CJS hazard in tests — use `schema.getTypeMap()`, not `printSchema()`

### Settled

One line each, kept because a past version of this file asserted the opposite.

- **A container key and the way to undo it are declared together** — `storageKeyOf` /
  `entityOfStorageKey` (`core/src/storage.ts`), the third pair beside `togetherKeyOf` and
  `emitKeyOf`. The dual asks whether the prefix names a SCANNED entity.
- A decision has ONE owner, instantiated on its subject when the subject can be held:
  `RowJudge.of(fields, opts).validate(row)`, `Card.fromSchema(Post)`, `FieldSet.of(f).primary`.
- **A registry is an instance of `Registry<T>`, not a class of statics.** An `Adapters`
  registry was built and reverted the same day (2026-09-04): a registry earns its place when a
  name arrives as DATA — `generate: 'ulid'`, `source: 'file'` — and `sql` arrives in an import.
- `Bundle` REFUSES two schemas claiming one registration key (`card/Bundle.ts`).
- `FieldSet.primary` refuses two primaries, naming both. The absence is answered, not defaulted.
- `heritage-unresolved` under an installed package was fixed before the entry describing it was
  written (`87b4738`). Remeasured 2026-08-28 against real tarballs: nothing reported.
- A registry that cannot say what it holds is not the owner: `Generators` registers its three
  builtins rather than switching on them.
- **A copy does not import, so no reader count can see it.** Measured 2026-08-25: nine
  hand-written copies of four declared functions, five of them divergent.
- The shape is held on three paths: the façade judges input, `StorageGuard` judges every write,
  and the DDL emits `CHECK` for `oneOf`/`min`/`max`. `pattern`/`format` stay at the façade.
- The façade hands on the value it PARSED (`boot/HandlerFacade.ts`, `judged`).
- The `boundary` axis has ONE door, `Boundary.of` — alias and codecs resolved eagerly.
- Two remotes serving one entity is REFUSED, naming both (`boot/remote.ts`, `claimedBy`).
- A split receiver ESTABLISHES its caller (`core/src/identity.ts`): `serve()` refuses to start
  beyond loopback with no `verify`. Do not reintroduce a link secret.
- An operation's input contract is read from PROVENANCE, and two candidates REFUSE rather than
  one being picked by parameter order.
- A collector in the wrong frond REFUSES THE BOOT (`core/src/verify.ts`).
- The two HTTP adapters agree on a middleware's return: the passthrough sentinel is
  `PASSTHROUGH` (`http/src/router.ts`), a symbol, not the legal value `data === null`.
- `@fronds/<name>` resolves in the scan; `fougere check` reports the relative form as
  `cross-frond-import`.
- `FougereError.details` is polymorphic on purpose — the shape belongs to the PAIR.
- The signature parser reads the CHECKER, so `type CurrentUser = User | undefined` binds like
  `user?: User`.
- `OperationContract.output` has three readers including the façade; it gives the FIELDS and
  does not close the view. `kind` is resolved by `core/src/effective-operation.ts`.
