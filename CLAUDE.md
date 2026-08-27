# CLAUDE.md

Guidance for Claude Code working in this repository.

## What is this

Fougere is a TypeScript framework built on ONE idea, stated in the negative because that
is the form that can be checked: **the declaration names nothing outside itself** — no
table, no protocol, no host, no address. The two things this file used to call its two
ideas are its two readings, and calling them two hid the rule that produces both:

1. **Single-schema** — what the declaration does not name is *derived* from it: one Entity class (`class Post extends entity({...})`) generates validation, DB tables (Kysely), GraphQL types (Pothos), form contracts, API surfaces.
2. **The gradient** — what it does not name is *chosen outside* it: a Frond (entities + handlers + collectors + seeds) runs in-process or in its own process behind JSON-RPC, with **identical user code**. `remotes: { blog: 'http://...' }` in `fougere.config.ts` is the whole topology statement.

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
  core/                @fougere/core          the four phases below, and what sits outside them
    src/scan/            what a scan run finds: scanner, handler-parser, its cache, the descriptors
    src/boot/            what createApp does with it: bootstrap, HandlerFacade, Emissions, Lifecycle, binding, egress, seed, remote
    src/wire/            what travels: the call, the invocation, the operation contract, errors, middleware
    src/prefab/          what a user declares: Crud, Presenter, Collector, Repository, Mirror
    src/*.ts             what belongs to no phase: the two published entry points, the ORM port, emit, the checkers
  http/                @fougere/http          the HttpRouter port + its express/fastify/hono adapters
  observability/       @fougere/observability optional: a span per op, the four signals, OTLP. Core holds none of it
  defaults/            @fougere/defaults      the conventional boot — the ONE place naming container+storage+transport
  cli/                 @fougere/cli           commands, scaffolding, and the terminal UI (src/ui.ts)
  testing/             @fougere/testing       cases derived from an entity, doubles derived from a port

  adapter/                                    project the schema onto a target
    sql/               @fougere/adapter-sql       Entity → Kysely tables (SQLite/PG/MySQL/MSSQL)
    graphql/           @fougere/adapter-graphql   Entity → Pothos types/inputs/CRUD
    rest/              @fougere/adapter-rest      REST projection
    duckdb/            @fougere/adapter-duckdb    one SQL query across `sources:`

  app/                                        the front-end
    shared/            @fougere/app           useQuery/useCommand/useFormFor, framework-free
    nuxt/ next/ react/ svelte/ vite/          @fougere/nuxt, /next, /react, /svelte, /vite

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
  container-basics/ core-scanner/ multi-frond/ crud-auto/ auth-better/
```

`pnpm-workspace.yaml` globs `packages/*` and `packages/*/*` rather than naming each
family — the list was a second copy of the tree, and it went stale the day a family
was added. A package's `tsconfig.json` extends the root by a relative path, so its
depth is encoded there: check it when a package moves families.

## Architecture

**Core flow:** Entity → adapters (SQL, GraphQL, REST, forms). The schema is the source of truth; adapters read `Entity.getFields()`.

**Entity declarations** — the 2nd arg of `entity()` is what the entity states about *itself*: `unique` (field groups unique together, realized as a table constraint by `adapter/sql`) and `adapters` (per-adapter, per-field). One object, not a growing parameter list. A derivation that drops a member of a unique group drops the group.

**What an entity states for an adapter is ADDRESSED, and the effect is the adapter's to name.** `FougereEntityAdapters` (`schema/src/EntityAdapters.ts`) is an EMPTY interface an adapter augments from outside, so `schema` learns no engine and no column type. `adapter/sql` is its only reader today (`adapter/sql/src/fields.ts`, `SqlFields`/`SqlField`) and states the rule in its shape: `columnType` is indexed BY ENGINE, so an engine the entity did not name keeps what the shape would have given — `columnTypeFor` (`adapter/sql/src/dialect.ts`) is one `??`, and the four `Dialect`s learn nothing. Measured on `demos/schema-ecommerce`, whose `Product.description` names `pg` and `mysql`: SQLite still emits `text` and the demo still boots. The key is NOT named for an effect — `overrides` was tried and reverted (2026-08-27): `schema` cannot guarantee any effect below the field, and an effect has no OWNER, so a second spelling of it has nothing to be distinguished by — `adapter/rest` already says `overrides:` for a two-level map of its own. A key named for its ADDRESS reuses cleanly: `adapters:` is also a `FougereConfig` key (which adapters the app serves), and the two never meet because the owner is the object the key sits in — the entity here, the app there. So the key names the level `schema` OWNS, under one rule — **every name is its owner plus what it is addressed by**: `EntityAdapters` (an entity, keyed by adapter), `SqlFields` (sql, keyed by field), `SqlField` (one entry) — and `SqlFields` names what sql holds, addressed by field. **What the operator decides is not stated here** — it belongs in `fougere.config.ts` beside `remotes:` (where a CALL goes), `sources:` (where a ROW is) and `ports:` (who performs an ACTION); the line is ownership, not force: an entity owns the shape of its own column, an operator owns the address, the source and the actor. Vocabulary would be sugar over the same landing (`tsvector()` writing `adapters.sql`), and it buys one thing the bare entry cannot: a word RECEIVES the field, so it can refuse `tsvector()` on a `number()`. Not built — `vocabulary()` is not exported, and a `Field` does not retain its key, which is exactly what an entry is addressed by. Pinned by `adapter/sql/tests/adapters.test.ts`. **The structure has an owner**: `EntityAdapterSet` (`schema/src/EntityAdapters.ts`) owns the two levels an entry is ADDRESSED by — adapter name, then field name — and judges nothing below them, because a field's entry is the adapter's shape. That is what makes a refusal possible at all: `adapters: { sql: 'tsvector' }` type-checks whenever no adapter is in the program, and the two hand-written walks it replaced (`deriveHints`, and `SchemaDefinition.merged` re-spelling the same guard) each swallowed it silently.

**Field = 4 axes** — `shape` (the shape IS JSON Schema), `role` (primary, ref…), `lifecycle` (who writes the value and when: create `{value}|'now'|{generate}|'optional'`, update `'now'|'forbidden'`), `boundary` (readOnly/writeOnly → `Visibility.input`/`Visibility.output`).
**La validation juge, le storage réalise** : the façade judges client input (unknown keys → `Unknown field`); handlers write freely through the ORM, which realizes lifecycle rules — by calling `applyCreate`/`applyUpdate` (`schema/src/axis/lifecycle/apply.ts`), the one realization every storage shares. Refusing is still the judge's: `update: 'forbidden'` lives in `RowJudge`, patch mode.

**Repository(…entities)** — who OWNS an entity's storage, and where its questions are named. **The arity is the declaration**, second reading of what `orm.ts` states for `EntityOrm` against `Together`. At ONE, the repository IS that entity's storage: `RepositoryBase` forwards all thirteen gestures over a `protected orm`, so the default the boot registers under `ReadingRepository` can be the guarded port ITSELF — the `{ orm }` wrapper that used to sit there existed to make `repo.orm` true in both forms, back when `.orm` was the way in. Same shape either way, which is what makes the convention true. From TWO on it is an **aggregate**: it owns them, and three things follow from the SHAPE rather than from a rule — no default repository for any member (`boot/bootstrap.ts`, skipping every one, not just the key's namesake, which was the whole hole), no forwarded gesture (which `T` would `create` write to?), and `ownersOf` refusing two aggregates over one entity. The one thing the shape refuses LAZILY is said out loud instead: `Crud` on an owned entity resolves `<E>Repository`, which does not exist, and measured that let the app BOOT CLEAN and answer every request with the container's sentence — so `refuseCrudOnOwned` names it at boot, recognizing the handler by FORM (`list` + `findById` on the prototype) exactly as the façade does. That is what gives a rule spanning two tables a home at last: `withdraw` compares a balance to a sum in ordinary TypeScript, and nothing else can write those tables. **`EntityOrm<E>` is not a word of the user's vocabulary** — `boot/ownership.ts`, `refuseOrmInUserCode`: a handler, a presenter and a collector are refused by name and pointed at `<E>Repository` (`RepositoryOf<E>` is its other spelling, read by `depKeyOf` like `EntityOrm<E>`), while a HOLDER may name the port of what its prefab was built on, which covers `Mirror` without naming it. A door judges and projects; a holder keeps the storage. **The boundary is not the unit of work**: deriving the frame from the membership would make a read-only aggregate carry one — refusals included — and put `Together<[A, B], [Mirror]>` out of reach, so a frame is ASKED FOR. Not a door: a repository has no façade, so a judge about who may act still belongs in the handler. Pinned by `tests/aggregate.test.ts`.

**Turning the ring** — a value the config CONSUMED cannot move under what it built, so the thing is built again: `reloadFougere()` (`app/shared/src/boot.ts`) instantiates the app and releases the previous one. It works because every door reaches the app through `useFougereApp()` INSIDE the request it serves and none holds it across two — measured, ten call sites, all per-request. Releasing is `app.dispose()`, and it is THREE levels in reverse of construction: every extension's `down` (built last), then `container.dispose()`, then `CreateAppOptions.onDispose` (a resource handed IN — a storage connection is the one case, and `ResolvedStorage.close` declares it beside the opening; NOT an extension, because it was opened before the container and therefore closes after it). A scope now disposes the SCOPES it opened, deepest first: they were registered as VALUES under `frond:<name>` and a value is not the container's to dispose, so every provider of every frond — and every surface scope — was never released at all. **A running call finishes on the OLD app**: `app.drain(timeoutMs?)` closes the door and resolves once the running calls are done, counted in `boot/inflight.ts` at `HandlerFacade.wrap` — the one path all three projections and the wire share, so one count covers them. `drain` REJECTS on its deadline naming what is left rather than resolving as if it had worked, because its caller is about to close a storage connection under whatever remains. A call arriving after the door closed is refused (`SERVICE_UNAVAILABLE`): the handle already points at the new app, so that caller kept a reference across the turn. Waiting and releasing stay two gestures — a test releases at once, a host turning the ring drains first. Pinned by `tests/dispose.test.ts`, `tests/drain.test.ts`, and container's *a scope closes what it opened*.

**The ascent, named** — `boot/Lifecycle.ts`. `dispose` always had a shape (reverse order, only what the container built); the way UP had four call sites under one word, `afterBoot`, with TWO senses — the storage's (migrations) and the host's (seeding, which REPLACED what the framework would have done) — and the Nuxt module GENERATED a third into its Nitro plugin. One declaration read by four copies is the disease this file already records for seeding, and it produced the same defect: the copy that runs when you open a Nuxt app had lost the storage fallback. So the pair is one value: an `Extension` states `up` and `down`, handed in through `CreateAppOptions.extensions`, run by `createApp` before it returns and by `dispose` in reverse. **A name already declared is REPLACED, not refused** — the delta rule `applyDashboardExtensions` states for widgets, and the only way a host can say "the seeding, but mine" without the framework guessing it from a position in a list. Two members are the framework's own and are ordinary members: `migrating(storage.migrate)` and `seeding(report)`. The two halves refuse in OPPOSITE ways, on purpose: `up` stops at the first refusal (a seed that assumes a migration must not run when it did not; a half-started app must not be handed out), `down` releases every member and sends the refusals together in an `AggregateError` (a release that abandons the rest leaks everything after it — the same answer `app.deliver` gives). `up` is also the one point in the boot that may AWAIT, which is where a provider that must OPEN something belongs. **An extension is not a frond and cannot become one**: a frond has entities and may move behind `remotes:`, an extension belongs to the PROCESS — `@fougere/observability` reads `app.fronds` and its state is a module's (`AsyncLocalStorage`, the sink list, the in-flight count), so moved it would report the observer instead of the observed. Pinned by `tests/lifecycle.test.ts`.

**`rpc` is a registry, not an `if`** — `wire/call.ts`, `runnerFor`. The reserved entity is the door for what an app says about ITSELF, never about a row, and `discover` is registered in it like anything else (`bootstrap.ts`, last line before the return) so ONE refusal names what IS served. `app.serveRpc(op, answer)` is how an optional package declares a reading core does not hold, and a second declaration of one name is REFUSED (the winner would depend on wiring order — the reason `ports:` refuses two implementations). This is what lets `@fougere/observability` serve `rpc.topology`: an app that never installed it answers `Unknown rpc operation 'topology'. It serves discover.`, which is the whole degradation a reader needs. The REPORT's shape lives in core (`TopologyReport`/`FrondPlacement`/`Edge`, exported through `contract.ts`) for the reason `SignedCall` does: it crosses a process boundary, and putting a wire shape beside its producer had already produced a hand-copied duplicate. Nothing in it is declared — a frond is `remote` because it ANSWERED a call nobody hosts, deliberately not read from `remotes:`, because a config key states an intent and the two disagree exactly when something is misconfigured. Read by `@fougere/admin`'s Topology page, the one screen in that panel the card cannot answer.

**The names the scan READS** — `scan/conventions.ts`. Everything else a frond states, it states by its SHAPE; the seven convention directories and the import scope are the one place where a NAME is the declaration, which is why they are the only ones a project may restate (`conventions:` in `fougere.config.ts`, only what differs). Two defects made this one change: `FougereConfig.frondsDir` was declared and read by NOBODY — five packages spelled `'fronds'` in their own literal, and the Nuxt module's homonym `FougereModuleOptions.frondsDir` always carried its default into `optionsOverride`, so a key from the file was overwritten by a key nothing read — and `FROND_DIRS` claimed in its own comment to be *"every directory `scanFrond` reads"* while `scanFrond` re-spelled six literals and the Nuxt module was its only reader. So the list is DERIVED now (`frondDirsOf`, `providerDirsOf`) and the producer consumes it: a source its own origin does not read is not a source, it is one more copy presenting itself as the original. **The order is the whole mechanism**: the config is read BEFORE the aliases, because it names the scope they are built from — measured, 0 of 16 `fougere.config.ts` in the repo import `@fronds/*`, which is what makes the inversion safe and is the invariant to keep. `ProjectScan` never loaded the config at all, so `check`/`graph`/`build`/`freeze` would have ignored the declaration. The scope reaches `FrondSource.package`, and a writer of a name reads THAT rather than rebuilding a prefix (`imports.ts`, whose refusal message used to print a remedy it had assembled itself). Not covered: `.fougere/` is the FRAMEWORK's working directory, not the user's vocabulary — 11 hardcoded spellings and four independent readers of `remotes.json`, which wants a constant, not a config key. Pinned by `tests/conventions.test.ts`, whose last case scans the same tree WITHOUT the declaration and finds nothing.

**Config, consulted vs consumed** — `boot/apply.ts`, `applyConfig` is THE answer to "what does a re-read change in a running app". A value CONSULTED at use can move; a value CONSUMED to build something cannot, without rebuilding what it built. `logLevel` is the only consulted key today and the function reports every other difference as `pending` rather than ignoring it. The list of consulted keys is not declared: a key is consulted when `applyConfig` does something with it. `Logger` holds NO level — `setLogLevel` sets one threshold for the process, read at every emission, so a handler keeps the object it was handed and a `child()` obeys too (both used to copy, so there was no place where the level WAS). `FOUGERE_LOG_LEVEL` still wins over the file, the CLI speaking. **Core catches no signal** — a process belongs to its host, and the logger runs on Workers where `process.on` does not exist. A re-read needs `loadConfig(root, { fresh: true })`: a module is cached by its specifier, so a second load of an EDITED file hands back the first one — measured, and it made a reload return the config already in force. The LOADER is told (`ModuleLoader`'s second parameter), never the path: `pathToFileURL` percent-encodes a `?` into the filename. A jiti-backed loader ignores the flag today, so a TS config under Nuxt still answers stale. Pinned by `tests/log-level.test.ts`, *a file that changed*.

**Ports** — a class something already answers under, that a provider extends. Nothing declares one: `boot/ports.ts`, `portBindings` reads the prototype chain at boot, so `class StripePayment extends Payment` IS the registration and `constructor(private payment: Payment)` receives the realization. This is the FOURTH reading of the rule `depKeyOf` already applies three times (`EntityOrm<E>`, `Emit<F>`, `Facade<H>`): the type names the SUBJECT, the container holds the realization. Providers were the one case where the type named the realization instead — measured, a handler declaring the base got the base, and with an `abstract` base a `charge is not a function` from a signature TypeScript had blessed. Two implementations REFUSE at boot naming both, for the reason `remotes` refuses two owners of an entity: the winner would depend on scan order. `ports: { Payment: 'StripePayment' }` in `fougere.config.ts` settles it and wins over the convention — beside `remotes:` (where a CALL goes) and `sources:` (where a ROW is), because it says who performs an ACTION, and none of the three belongs inside the frond. Only the direct base binds; a deeper chain binds each link to its own child, and `ports:` overrides. `abstract` is erased at runtime, so a base with no subclass is indistinguishable from an ordinary service. ONE condition decides — `scope.has(base)` — so a builtin is a port too: `class AuditLogger extends Logger` takes the `Logger` key for that frond, and the same condition excludes a prefab (nothing answers under `RepositoryBase`). The default `Logger` was built with NO options, so it sat on `'info'` and `FOUGERE_LOG_LEVEL` reached the two boot loggers only — never the one a handler receives. The line against a frond is checkable: a frond has entities, a port has none. Pinned by `tests/ports.test.ts`.

**Prefab ops** — `Crud(Post)` gives the five typed CRUD ops. `Crud(Post, { list: PostCard })` names the view **one op** emits: a declaration only, the handler keeps its full-row ORM so judges still read every field, and the façade projects each result onto its view. `Crud(Post, PostPublic)` is the handler-wide form and does scope the injected ORM.

**A test states what it expects, and nothing else** — `@fougere/testing`. The CASES come
from `RowRefusal`'s closed set read against the four axes (`Cases`, which
lives in `@fougere/schema` because deriving them reads the axes and nothing else — the
FABRICATION of a value needs a generator, and that half stays in `testing` so a 426 KB
faker never reaches the package a browser loads; measured, a devDependency the other way
round breaks `pnpm -r build`, whose topological order can no longer put core first), the
DOUBLES from a port's own prototype (`stubOf`), and the LEVEL from where the file sits: a
test under `fronds/blog/tests/` says its subject is `blog`, which is the statement
`remotes:` makes in production and not a mode of testing. What is derivable stops exactly
where Fougere's vocabulary does — a service's return type is a bare TypeScript type,
erased at runtime, so `stub(X).m` returns what the test says and nothing else. `checkDoors`
is the first thing in the repo to compare REST against GraphQL; `driftOf` compares two
`rpc.discover` cards through `Card.diff`, which is the gap TypeScript cannot see — a consumer's
synced copy still compiles three weeks after the producer moved.

**Operation contract, three producers** — the façade consumes `OperationContract` and nothing else, so the scan is a convenience, not a dependency. A prefab **declares** (`Crud.__ops`, runtime, survives a scan that resolved nothing), the scan **derives** from source, `frond.config.ts` **states** (`operations: { archive: { binding: [...] } }`) and wins over both. Config also *creates* an op neither producer found — the only answer for a method inherited from an **installed** base class, which the workspace-only heritage scan cannot see. `input`, `binding` and `description` — `description` being the method's own doc sentence, which the scan reads from the AST (`scan/handler-parser.ts`, `docSentenceOf`) and the identity card carries. `OperationContract.output` is read by the façade too (`boot/HandlerFacade.ts`, `viewOf`: under `__opOutputs` and above `__output`), so one contract answers all three doors.

**Call contract** (`core/src/wire/call.ts`) — a Frond call is a value `(entity, op, invocation)`. `createLocalRunner` executes locally; `createAppRunner` follows the topology (local façades + remote doublures). Transports move the value, never reshape it. In-process = direct memory execution, no RPC. Browser-safe surface: `@fougere/core/contract`.

**`Emit<T>` / `Fact<T>`** (`core/src/emit.ts`, dispatched by `boot/Emissions.ts`) — every other call names ONE recipient; an emission names a **subject**. `Emit<PostPublished>` is a constructor dependency resolved by type like `EntityOrm<Post>`, and accepting a `Fact<T>` IS the subscription — no topic, no register call, the scan reads the signature. It is a **resolver, not a channel**: it answers *who*, then hands over to the door that already exists, which is why nothing is durable (a resolver holds nothing) and why a subscriber keeps its judge, its binding and its middlewares. Dispatch is not delivery; a ring is refused (`AsyncLocalStorage`, a chain not a depth), a diamond is legal. Announcing and receiving obey OPPOSITE rules, on purpose: an announcement returns once every subscriber has been HANDED the fact (`void` + `.catch`, so a publication is never hostage to its indexer), while `app.deliver` — the carrier's door — waits for them all and REJECTS with an `AggregateError` if one refused. At-least-once is retrying what failed, so a delivery that cannot report makes durability unbuildable above it; "dispatch is not delivery" protects the emitter, and a carrier is not the emitter. Fougere still holds nothing: the log, the per-subscriber cursor and the ack live in the carrier (`demos/emit-multirepo/broker.ts`, ~80 lines, shows all three and an offline subscriber catching up). Across a repository, `onEmit` carries the fact out under its name and `app.deliver` brings one in; the identity card's `facts` list carries the SHAPE so `fougere sync` writes the class the subscriber used to copy by hand. **A fact is judged strictly, like everything else** — a tolerant mode was built and reverted (2026-08-09): a reader silently ignoring a field it should have handled is worse than a loud refusal. The price is an order — re-sync and deploy the readers, then the sender — and when that order is not yours to impose, announce a SECOND fact rather than change the first. Pinned by `tests/emit.test.ts`, *a sender whose copy has moved ahead*.

**Nuxt primitives** — `useQuery`/`useCommand` (a command on X revalidates mounted queries on X), `useFormFor` (contract, not rendering; local judge = remote judge), `useCurrentUser`, `invoke` (server dual, state via async context). Metadata = the imported entity class, nothing serialized to the client.

**Validation** — `@cfworker/json-schema` (edge-safe). `Entity.validate(input)` → `{ success, data }` | `{ success: false, errors: [{path, message}] }`.

## Conventions

- TypeScript strict, ESM, ES2022, Node16 resolution ; pnpm ; vitest ; no decorators, no Zod
- **TS 7 (native tsc) at the root** ; `packages/core` compiles and scans with `@typescript/typescript6` — the JS compiler API, which TS 7 ships under `unstable/` rather than dropping. Measured: TS 6 builds the scan's program ~25 % faster than 5.9, same answer. The 7.1 plan stabilizes Content Mapper, Emit and Language Service — not `Program` and `Checker`, so `unstable/` is not a destination yet, and neither is oxc while the scan reads types
- **`.vue` files are not type-checked** ; `typecheck` is `tsc -p fronds`, which covers the Frond and stops at the SFC. `vue-tsc` would cover them but requires `typescript/lib/tsc` — a path the native tsc no longer exports, and its `>=5.0.0` peer range does not say so. Adding it means lowering TS *and* carrying a pinned Nuxt dependency graph to keep it green. Rejected 2026-08-06; revisit when vue-tsc runs on TS 7.
- `"types": ["node"]` explicit in tsconfig.base — TS 7 dropped automatic @types
- A field is recognized by its FORM — it states a `shape` — never by a brand. `entity()`
  pushes every entry through `new Field(field, key)`, so a plain object may be handed in
  (config, JS, a card from another language) and comes out canonical; the constructor is
  the door and a shapeless entry is refused there, by name. The entry that named
  `normalizeFields` quoted a function that does not exist. The `__brand` stamp this line used
  to describe is gone (2026-08-13): it answered "did this come through us", which is not the
  question, and it let three fixtures carrying a three-refactor-old vocabulary pass as fields
  for months. **The rule does not extend to every mark.** `__entity` on a prefab
  (`core/src/prefab/prefab.ts`) records what `Crud(Post)` was BUILT ON — nothing in the form
  of `PostPresenter` says `Post`, so no form-based test can replace it. A mark carrying a
  value and a mark carrying a yes/no are not the same animal; only the second is a brand.
  The fixture failure repeated verbatim on the presenter marker (2026-08-17, three fixtures
  stamping the symbol by hand had never once run `Presenter()`), and there the remedy was
  the opposite: not removing the mark, making the fixture go through the door.
- `resolveStorage()` (`@fougere/defaults`) is the **single** place that defaults a missing db path — never recompute it elsewhere
- `graphql` deduplicated across the workspace (override + hoist)
- `better-sqlite3` bindings may need `npx prebuild-install` in its pnpm dir
- **Measure before concluding.** On a design question — should this be a class, is this type
  read anywhere, does this flag earn its place — run the grep or the probe FIRST and answer
  with the number. A position defended before it was measured has been wrong every time.
- **A comment states the invariant, not the argument for it.** Two lines. Needing ten to
  justify a design means the design is wrong, not under-documented.
- **Probe the *Known issues* by commit recency, not by how old an entry looks.**
  `python3 scripts/stale-notes.py --since 7` orders the entries by the last commit touching
  the code they cite. Measured 2026-08-24 over 31 entries: **6 were false or half false, and
  all six cited code touched in the last seven days** — nothing older than 13 August was
  wrong. An entry is written on the day of the fix and is then read by nobody, so what
  predicts an error is the freshness of the CODE, never the age of the entry.
- **Never cite a line number in this file.** Three entries below have already been caught
  quoting one that had moved, and the file records each catch. A path plus a SYMBOL survives
  a refactor; `bootstrap.ts:295` survived neither the edit that pushed it down nor the move
  that renamed its file. Cite `boot/HandlerFacade.ts`, `viewOf` — a grep finds it, a diff
  does not silently invalidate it. Measured when the rule was written (2026-08-17): of the
  eleven line references outside `core`, **five already pointed at a blank line, a closing
  brace or an unrelated comment**. Nobody had touched them; the files around them moved.
- **When the measurement decides, execute.** Do not ask again for what it already answered.
- Commits: title + 1-3 lines. Never `git add -A` (parallel sessions)
- **Everything committed to this repository is in English** — commit messages, PR bodies, code comments, doc comments, test names, `README.md`, `CLAUDE.md`. The repository is public and its readers are not assumed to read French. The one exception is `site/content/fr/`, which is a translation target and French by design; `site/content/en/` is its pair, and the two move together. Private design notes live outside this repo and are not covered by this rule.

## Known issues

Fact — where — state. The reasoning lives in the notes, not here, and *Settled* below is
one line each: what the entry protects against is a future reader re-asserting the old
belief, which costs a sentence, not a paragraph.

- **An un-augmented `adapters:` accepts anything, silently.** With no adapter in the program
  `FougereEntityAdapters` is an empty interface, so `EntityAdapters<TFields>` is `Partial<{}>`
  — which in TypeScript means "anything non-nullish", not "no keys". Remeasured 2026-08-28:
  `adapters: { sqll: { titlee: 'anything at all' } }` compiles clean in `packages/schema`,
  the invented FIELD name included. So the registry fails OPEN, giving neither
  completion nor a guard, and the two only appear once something imports the adapter
  (declaration merging is program-wide, not per-file). The fix is a decision about the
  empty case, not a patch.

- **A seed cycle is not satisfiable by ordering** — `core/src/boot/seed.ts`, `orderSeeds`
  (Kahn, like `orderTables`). Its members keep scan order and fail at the driver.
- **An installed base class still warns `heritage-unresolved`** (`scan/handler-parser.ts`) — the checker path yields
  nothing under a tarball install and the AST fallback reads the written class, which a
  `.d.ts` does not have. Measured 2026-08-24: three warnings, one per `extends Crud(…)`.
  Benign — a prefab declares its ops at runtime (`Crud.__ops`) so all five routes exist —
  and a warning rather than a refusal, because an installed base with no operation is
  ordinary and the boot cannot tell the two apart.
- **Nothing generates OpenAPI at all**, so an operation's `description` is carried on
  `RouteDefinition.description` and read by nobody. GraphQL does read it
  (`adapter/graphql/src/pothos.ts`, `registerOperations`).
- **`CrudViews` (`core/src/prefab/crud.ts`) is typed on the five CRUD names, and what a
  custom op lacks is not the ability to NAME a view** — it has two already, its return type
  and `frond.config.ts`, both giving `closed: false`. Only `__opOutputs` CLOSES
  (`core/src/effective-operation.ts`, `effectiveOutput`), and closing does two things at
  once: `OutputProjector` keeps only the view's keys and `HandlerFacade` skips the
  presenter, so a closed view cannot carry a computed field. Widening the type admits a
  custom op AND admits `{ lst: Card }`, the typo the five names catch. Measured 2026-08-24:
  two `Crud(E, { … })` declarations in the repo, zero custom ops wanting a closed view — so
  nothing breaks the default, which is this repo's condition for adding an option.
- **`remotes:` names one address per frond, so the same frond cannot be deployed twice.**
  The key is the frond *name* — a type — while a deployment has *instances*. Today's answer
  is modelling: make the node a datum and let one instance aggregate the others. Blocking
  the day a consumer must address a specific instance. Not implemented.
- **A named surface serves nothing when the frond is remote** — `core/src/boot/bootstrap.ts`,
  `facadeFor` resolves a surface key in the local container only, so a consumer's `public`
  door over a remote frond answers NOT_FOUND on everything. True of all three doors. The
  coherent answer is composition; not shipped.
- **`expose` is a THIRD membership mechanism, and `facadeFor`'s comment says the scan
  resolves it into the other two.** It does not: the scan sets a boolean
  (`scan/scanner.ts`, `e.exposed`/`h.exposed`) and never writes `surfaces`, which comes from
  `frond.config.ts` alone. So the flag has two readers — `adapter/rest/src/routes.ts` and
  `adapter/graphql/src/auto-register.ts` — while `facadeFor` and the runner ignore it.
  `handler.exposed` is read nowhere. The method-level `@expose` lives in
  `packages/decorators`, which has **zero importers** and is `private: false`, so it ships
  on npm-day unless someone decides otherwise — while the convention above says this repo
  has no decorators. Two shapes for the fix and they are different decisions: resolve
  `expose:` into `surfaces:` at the scan, or give the flag a third reader in the runner.
  One instance exists in the repo, so nothing leaks today. Not decided.
- **A computed field that reads still issues N queries** — the façade hands the presenter
  the PAGE (`core/src/boot/egress.ts`, `presentEgress`), so the shape allows one query per
  page, but `Promise.all(rows.map(...))` inside the field body is not refused and nothing
  says so.
- **`BindingPlan.optional` is written five times by core and ignored by `resolveArgs`**, so
  at the façade `user?: User` and `user: User | null` behave identically while
  `adapter/graphql` reads the same field and makes the argument nullable. **It is NOT a
  missing reader**: making `resolveArgs` refuse compiles and breaks four tests, two of which
  state the opposite policy on purpose — `tests/config-contract.test.ts` carries the
  rationale in its source, and `tests/aggregate.test.ts` invokes `withdraw` with
  `EMPTY_INVOCATION`. Closing the gap means choosing which door is right, a public
  behaviour change either way. Do not "fix" it by rewriting those tests.
- **`orm.client` remains the anonymous multi-statement path, judge off** — everything else
  writes through a guarded port, `Together<[…]>` included (`core/src/orm.ts`).
- **An announcement realizes a fact's `lifecycle.create`, and no typed emitter can use it.**
  `Emit<T>` names the ROW type where `created()` is present and required, so
  `announce({ id, title })` is a compile error and the author writes the field anyway
  (`boot/Emissions.ts`, `stamped`). `PartialRow` is the wanted shape and derives from the
  FIELDS, which the instance type has thrown away. Both closures leak elsewhere; neither is
  worth doing before identity's home in a fact is decided.
- **A nested object reports no path to the field that failed.** `Outer.validate({ addr: {
  street: 'a' } })` answers `path: 'addr'` with the failing field in the PROSE, so
  `useFormFor` cannot highlight it (`app/shared/src/form.ts`, first segment). The inner path
  is already computed and thrown away — `@cfworker/json-schema`'s `instanceLocation` — so
  what remains is a contract decision only: `path` is a flat string that eleven sites
  interpret, and a nested path wants segments.
- **A required field with no default is `NOT NULL` on a fresh table and NULLABLE on a
  migrated one.** `changeSQL` (`adapter/sql/src/diff.ts`) applies `notNull()` only when a
  default exists, because engines refuse it on a populated table. Its BOUNDS do land on
  both — the `CHECK` is emitted inline. The refusal that names the field and its remedy
  lives on the OTHER road: `planStep` (`adapter/sql/src/step.ts`), whose only caller is
  `fougere migrate`. A booting app goes through `defaults/src/storage.ts` → `migrate()` →
  `delta()`, which never reaches it, so nothing covers the path an app starts on.
- **`unique()` added to a live table never lands.** `delta()` (`adapter/sql/src/diff.ts`)
  proposes `addColumn` and, separately, `createIndex` for anything carrying `column.index` —
  and a sole `unique()` deliberately carries none. Measured on SQLite: the migrated table
  accepts two identical emails, the freshly created one refuses. Not patchable as is:
  `CREATE UNIQUE INDEX` on a table already holding duplicates FAILS, so the additive
  migration would start refusing to boot on real data. A decision about what auto-DDL may
  do, and it is the same question as the entry above.
- **A schema can say what it WAS, and the missing reader is the API.** `Card.diff`/`Bundle.diff`,
  `fougere freeze`, `fougere migrate --apply` are shipped and
  pinned; what nothing does yet is serve an old API version through the same step.
- **A stored fact is neither judged nor versioned.** `json()` admits any shape forever, and
  `x-fougere-version` (`schema/src/card/Card.ts`) versions the DESCRIPTOR FORMAT, never
  an entity's contract. `delta()` never changes a type nor drops a column. A row can be
  rewritten by hand when the shape moves; **a log cannot**, which is why this bites event
  sourcing first.
- **`ProviderEntry.name` is a documented lie.** Its comment says *"Registration key"* and
  `toProvider` fills it with `lowerFirst(ctor.name)` — camelCase — while
  `boot/bootstrap.ts` and `verify.ts` both register and read `ctor.name`, PascalCase. So the
  field named "registration key" is the registration key nowhere. It IS read, as a
  scan-level identifier under a name describing something else. A `/degraissage` pass, not a
  patch.
- **Nitro's prod trace misses lazily-loaded packages under pnpm**, which is why the hand-copy
  in `site/Dockerfile` exists at all — jiti misses its babel transform in the trace, and the
  icon collections are listed for the server bundle in `site/nuxt.config.ts`. The copy names
  the package it copies since 237eaa4; before that it derived the name from the store glob,
  which is true only for an unscoped package.
- **Three free functions in `schema` are candidates nobody has judged.** `clean` decides
  nothing, so under the rule it is a private detail rather than a barrel export; `fieldsOf`
  and `schemaOf` are methods of an owner that now exists (`SchemaOrCard`).
  Scraping, not structure — listed so the next pass does not re-derive the list.
- `graphql` dual ESM/CJS hazard in tests — use `schema.getTypeMap()`, not `printSchema()`

### Settled

One line each, kept because a past version of this file asserted the opposite and a future
one might again. The full account of each — what it did before, what the measurement was —
lives in the notes.

- A decision has ONE owner, and it is instantiated on its subject when the subject can be
  held: `RowJudge.of(fields, opts).check(row)`, `Card.fromSchema(Post)`, `FieldSet.of(f).primary`,
  `Visibility.of(f).input`. A registry stays static — one per process, no subject to hold
  (`Formats`, `Boundaries`, `Generators`, `Clock`). Measured over the pass: 11 classes and 36
  free functions became 24 and 12.
- `Bundle` REFUSES two schemas claiming one registration key (`card/Bundle.ts`). The silent
  overwrite it replaces is what a free function could not refuse — there was nowhere the
  refusal would have belonged.
- `FieldSet.primary` refuses two primaries, naming both. `primaryFieldOf` returned the first
  one for as long as its own comment recorded that two primaries were the bug it existed to
  fix; the absence is still answered and not defaulted.
- A registry that cannot say what it holds is not the owner: `Generators` registers its three
  builtins rather than switching on them, so the unknown name is refused inside it.
- **A copy does not import, so no reader count can see it.** Measured 2026-08-25: nine
  hand-written copies of four declared functions, five of them divergent, one INSIDE the
  package that declares the original. The scan that finds them compares BODIES, not imports.
- The shape is held on **three** paths: the façade judges input, `guardStorage` judges every
  write through the port, and the DDL emits `CHECK` for `oneOf`/`min`/`max`
  (`adapter/sql/src/check.ts`). `pattern`/`format` stay at the façade on purpose — regex
  dialects diverge.
- The façade hands on the value it PARSED (`boot/HandlerFacade.ts`, `judged`), so a handler
  receives a `Date` where the field declares one.
- The `boundary` axis has ONE door, `Boundary.of` (`schema/src/axis/boundary/Boundary.ts`) — alias and codecs resolved eagerly, both
  directions, unknown names throwing.
- Two remotes serving one entity is REFUSED, naming both (`boot/remote.ts`, `claimedBy`).
- A split receiver ESTABLISHES its caller (`core/src/identity.ts`): `serve()` refuses to start beyond loopback with no
  `verify`, an envelope signs the whole CALL (not just the state), and `invocation.caller` is
  top-level, never a key of `state`. Do not reintroduce a link secret.
- An operation's input contract is read from PROVENANCE (`scan/scanner.ts`, `inferOperations`), and two candidates REFUSE
  (`input-contract-ambiguous`) rather than one being picked by parameter order.
- A collector in the wrong frond REFUSES THE BOOT (`core/src/boot/binding.ts`); it used to hand the request body to the
  parameter that wanted a user.
- The two HTTP adapters agree on a middleware's return: the passthrough sentinel is
  `PASSTHROUGH` (`http/src/router.ts`), a symbol, not the legal value `data === null`.
- `@fronds/<name>` resolves in the scan (`scan/scanner.ts`, `frondAliases`); `fougere check`
  reports the relative form as `cross-frond-import`.
- `FougereError.details` is polymorphic on purpose — the shape belongs to the PAIR (code,
  details) — and `validationErrorsOf` (`wire/errors.ts`) judges the elements rather than
  casting them.
- The signature parser reads the CHECKER (`core/tests/handler-parser.test.ts`), so `type CurrentUser = User | undefined` binds like
  `user?: User`.
- `OperationContract.output` has three readers including the façade (`boot/HandlerFacade.ts`, `viewOf`); it gives the
  FIELDS and does not close the view. `kind` is resolved by `core/src/effective-operation.ts`, not by the
  scan, and `OperationContract.kind` stays empty at scan level — a relocation, not a
  regression.
