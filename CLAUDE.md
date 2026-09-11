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
pnpm run build                     # packages only — required before demos if dist/ is missing
pnpm -r test                       # `-r build` is NOT the same: it also runs nuxt/next/vite
                                   # build across the front-ends, which no test needs
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
pnpm -C demos/ports-swap dev        # one handler: two PSPs, the refusal, a chain, and a seam
pnpm -C demos/config-reload dev     # one boot, a real SIGHUP, a drain — and what a re-read cannot change
pnpm -C demos/mirror-catalog dev    # two passes over a source that only answers ?page=&since=
pnpm -C demos/sse-live dev         # live fan-out to readers who are not trusted peers
pnpm -C demos/log-destinations dev # two destinations for one line, and the frond that names neither
pnpm -C demos/pipe-split dev       # the op that FINISHES a fact — here, then behind `remotes:`
pnpm -C demos/ask-quorum dev       # `Emit<T, A>` — the announcement that waits, across three processes
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
  compiler/            @fougere/compiler      the scan: source → descriptors. The one package that
                                                needs a filesystem and a TypeScript program
  core/                @fougere/core          the phases below, and what sits outside them
    src/descriptor/      what a frond is made of, whoever produced it: FrondDescriptor, the entries, Fronds
    src/boot/            what createApp does with it: bootstrap, install, Emissions, AppLifecycle, seed,
                         remote, and what is BUILT from an app: its identity card, its runners
    src/dispatch/        what happens per call: HandlerFacade, Dispatcher, the route registry, the validators and projectors, argument resolution, InFlight
    src/wire/            what travels, and the values a call is made of: Call, Invocation, RouteAddress, Emit,
                         CallLog, the operation contract, its signature and binding plan, errors, middleware
    src/prefab/          what a user declares: Crud, Presenter, Collector, Repository, Mirror
    src/builtin/         what every app has without asking: the logger, the config service
    src/crypto/          one port, two realizations — node and webcrypto
    src/entry/           the three ways in, in two files: facade.ts holds the facade and its dynamic
                         form, transport.ts the transport
    src/descriptor/index.ts  what it takes to PRODUCE a descriptor — the fourth entry, `@fougere/core/descriptor`,
                         read by the scan. The main entry serves what an app RUNS
    src/storage/         where rows live from core's side: the port, the frame that derives its
                         thirteen gestures from four (store.ts), and what a criterion compares
    src/*.ts             what belongs to no phase: the two published entry points, frond(),
                         the effective operation model, the checkers
  http/                @fougere/http          the HttpRouter port + its express/fastify/hono adapters
  observability/       @fougere/observability optional: a span per op, the four signals, OTLP. Core holds none of it
  defaults/            @fougere/defaults      the conventional boot — the ONE place naming container+storage+transport
  cli/                 @fougere/cli           commands, scaffolding, and the terminal UI (src/ui.ts)
  testing/             @fougere/testing       cases derived from an entity, doubles derived from a port
  calls/               @fougere/calls         optional: a bounded ring of what this process dispatched, served as rpc.calls
  log/                 @fougere/log           optional: lines to a FILE, one JSON object each — the console is Logger's
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
  ports-swap/          one handler, two PSPs, a chain in front of one, and `Storage` wrapped for every frond
  config-reload/       the config re-read under a running app, the drain, and what it refuses to change
  mirror-catalog/      a copy of rows the app cannot query, and what the second pass costs
  together-frame/      one frame, two realizations, and the config line that picks one
  observability/       three Fronds in three processes, one trace — and what the wire cost
  test-gradient/       what the declaration writes on its own, and the four rungs it runs at
  anchor-chain/        a path with two stops — which derivations hold rows, and which say nothing
  emit-multirepo/      two repositories, one fact, and the ~80-line carrier that is not Fougere's
  rust-frond/          the far side is not TypeScript, and the validator is still ours
  cloudflare-d1/       the edge rung — scan emitted, no tsc shipped
  sse-live/            live fan-out to readers who are not trusted peers
  log-destinations/    where a line goes is the operator's line, not the domain's
  pipe-split/          `Pipe<T>` — what a link is for, and what `pick` already does without one
  ask-quorum/          `Emit<T, A>` — an announcement that waits, and what a missing answer costs
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

**The façade validates, the storage realizes.** Client input goes through the façade (unknown
keys → `Unknown field`); handlers write freely through the storage, which applies
`applyCreate`/`applyUpdate` (`schema/src/axis/lifecycle/apply.ts`). Refusing stays the
validator's: `update: 'forbidden'` lives in `InputValidator`, patch mode.

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

**The entry has a validator, and the adapter writes it as DATA.** `AdapterFieldValidator`
(`schema/src/validator/AdapterFieldValidator.ts`) takes a format and refuses what it does not admit;
`adapter/sql/src/adapter.schema.json` is that format, imported with `with { type: 'json' }`,
and `SqlField` is DERIVED from it. It is validated where the adapter READS
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
(`refuseCrudOnOwned`). `Storage<E>` is reached only by a class BUILT ON E (`builtOn`,
`core/src/boot/ownership.ts`) — a repository, or a prefab over that entity: naming
`Storage<BookCard>` is what `Mirror(BookCard)` earns. A handler, a presenter, a collector
and a plain service are pointed at `<E>Repository`, and the aggregate check runs BEFORE the
allowance, so an entity an aggregate owns refuses even the built-on case, naming the owner.
The host is outside the rule: `app.storageFor()` and the `storageFactory` it hands in name
`Storage`. Pinned by `core/tests/aggregate.test.ts`.

**Turning the ring** — `reloadFougere()` (`app/shared/src/boot.ts`) builds the app again and
releases the previous one; it works because every door reaches the app through
`useFougereApp()` inside the request it serves. `app.dispose()` runs three levels in reverse
of construction: each extension's `down`, then `container.dispose()`, then
`CreateAppOptions.onDispose`. `app.drain(timeoutMs?)` closes the door and resolves once
running calls finish (counted in `dispatch/InFlight.ts`); it REJECTS on its deadline naming
what is left. A call arriving after the door closed gets `SERVICE_UNAVAILABLE`. Pinned by
`tests/dispose.test.ts` and `tests/drain.test.ts`.

**An extension brings fronds** — `Extension.fronds`, read by `createApp` BEFORE the ascent
and folded in beside `fronds:` and `scan:`. It is the only way an optional package can
accept a fact: a subscription is a signature, and `up` receives an app that already exists.
The boot marks what it took as `FrondDescriptor.brought`, which is how a report says what
the app SERVES rather than what instruments it — read by `calls`' panel, by `rpc.topology`,
and by the identity card (`boot/card.ts`). The card because such a frond stands in EVERY
process that installed the extension: two of them answered `export` on `rpc.discover` and
the remote router refused, `Two remotes serve 'export'`, which left a third process able to
reach neither. `@fougere/calls` brings `KeepHandler`, `@fougere/observability`
`ExportHandler`. Pinned by `tests/brought.test.ts`.

**What carries a line writes none** — `CARRIES_LINE` (`core/src/builtin/LogLine.ts`), a
set the BOOT fills from `Emissions.doorsFor('logLine')`, read by `loggerMiddleware`, by
`observability`'s `trace()` and by `calls`' ring. Keeping a line is a DISPATCH, so logging
it announces a line inside the announcement of one: `Emission cycle: logLine → logLine`.
Measured four ways on 2026-09-10 — the process hung, the call ring filled with its own
writes, `activeCalls()` counted log deliveries, and a hard-coded list missed a third
party's destination. A reentrancy flag cannot see it: the carry is asynchronous.

**The ascent is ORDERED BY CORE, and a host hands over a gesture** — `createApp` puts
`migrating(options.migrate)` and `seeding()` before whatever `extensions:` carries. Four
hosts assembled those two members themselves (`compiler/src/boot.ts`,
`app/shared/src/boot.ts`, the Nuxt codegen as a STRING, and a demo), and eight demos wrote
nothing — so they had no migration and nothing said it. Rows before tables is a boot that
finds none, which is not a host's preference to hold. `Source.migrate` is declared once and
travels whole: `layerOf(storage)` (`defaults/src/storage.ts`) is the ONE place that spreads
the data layer into what `createApp` takes, so a host names no member of it — naming a few
is how `transacted` and `close` were left behind once, under Nuxt only. Pinned by
`tests/lifecycle.test.ts`.

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

**The names the scan reads** — `core/src/conventions.ts`, read by `@fougere/compiler`. Everything else a frond states, it
states by its SHAPE; the ten convention directories and the import scope are the one place
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

**What has an AFTER can be a middleware; what has none cannot.** A middleware is `(ctx,
next)` — it holds what comes next, so it may not run it, and it may act on what came back.
An operation has both halves: refusing IS an answer, and the answer is worth seeing. A
fact has neither — the announcer left with `void`, and a subscriber's answer is discarded
— so handing a link `next` would grant only the power to suppress and leave the other half
dead. That is why `Pipe<T>` returns a value instead of taking `next`, and it is the line
between the two, not a convention.

**A middleware is a frond's to declare** — `middlewares/`, the tenth convention directory
and the only one whose members apply to code they do not name. Recognized by its FORM: the
class states `around(context, next)`, so a file in the directory that does not is not one.
It answers for its own frond — every ADDRESS its handlers answer to, wider than its
entities since a handler without one runs behind it too — and `middlewares: { Audit: 'app' }`
in `frond.config.ts` is the exception, stated by the frond that decides for the others.
Resolved per CALL and never at boot, the same reason `getMiddlewares` is: a middleware
asking for something request-scoped would otherwise be handed the one instance the boot
built. `App.use` and a frond's directory are two doors onto ONE writer (`use` in
`boot/bootstrap.ts`). Pinned by `core/tests/middleware.test.ts`.

**A log line is an announced fact** — `@fougere/log`. `Emit<LogLine>` is what a frond asks
for, and a destination is a handler accepting `Fact<LogLine>` — that signature IS the
subscription, so two destinations both receive and none is not declaring the frond. The
console one writes with `console[method]` and announces NOTHING: a destination that logs is
a ring, which the emission refuses by name where the old `onLog` sink's try/catch swallowed
it. That sink is GONE — the emission replaced its last caller, and it went with the
module-level array it read; `LogSink` remains, as the shape of what a destination hands a
line to. The package STATES its frond (`logFrond()`), because scanning a directory under
`packages/` fails — see Known issues.

`Logger` is a SHORTCUT over that emission: `log.info(msg)` builds the line
`Emit<LogLine>` takes whole, and printing is part of what the shortcut IS — the console is
written whoever else took the line, because skipping it once a destination existed made a
devtools ring silence the terminal (306 lines in `demos/observability` became 2). So a
destination sends a line ELSEWHERE, which is why `@fougere/log` ships a FILE and not a
console. Announcing through `Emit<LogLine>` reaches destinations only.

The SHAPE is core's too — `entityByName` gets `LogLine` when no frond declared it, or a
destination brought by an extension is handed a line whose `at: created()` was never
stamped. A logger a package CONSTRUCTS carries nothing: `new Logger(service)` printed and
announced nothing, which is why `observability` resolves the app's and names a child.

A `Carry` is also what a TEST watches a logger through — `observability/tests/logs.test.ts`
held the last `onLog` call sites and now names its own carry, which is the same door the
boot uses.

The lines are HELD until an emission exists, in a `Carry` held PER BOOT — a process-wide
slot sent a second app's lines to the first app's door, and only the first of three
printed. They are handed over AFTER the ascent, because handing them over RESOLVES the
destination and what a brought one depends on is registered by its own extension's `up`:
`calls` registers its two rings there, and every held line died on `'LogRing' is not
registered`. Whatever CARRIES a line writes none: `Emissions` has a logger with no carry, and
`CARRIES_LINE` — filled by the boot from who subscribed, never written down — is read by
`loggerMiddleware`, by `trace()` and by `calls`' ring. Pinned by `log/tests/log.test.ts`
and `demos/log-destinations`.

**Ports** — a class something already answers under, that a provider extends. Nothing
declares one: `boot/ports.ts`, `portBindings` reads the prototype chain at boot, so
`class StripePayment extends Payment` IS the registration. Two implementations REFUSE at
boot naming both; `ports: { Payment: 'StripePayment' }` settles it. Only the direct base
binds.

A port may be answered by a CHAIN, and a WRAPPER is recognized by its form: it extends the
port AND asks for it (`constructor(private inner: Payment)`). Wrapping used to be
impossible — a wrapper was a second implementation, so the boot refused it, and
`StorageGuard` was the only one in the tree, hard-coded for one port. The container needs
nothing new: a dep resolves by NAME, so wrapping is a substituted key. One wrapper needs no
declaration; two REFUSE, because which stands in front is an order and scan order is not
one — `ports: { Payment: ['Retrying', 'Stripe'] }` states the chain from the OUTSIDE IN,
and the last name is what actually charges. Pinned by `tests/ports.test.ts`. A builtin is a port too: `class AuditLogger extends Logger` takes the `Logger` key
for that frond. Pinned by `tests/ports.test.ts`.

**A SEAM is a port whose realization is handed in** — `SEAMS` (`boot/ports.ts`), `Storage`
today. `storageFactory` builds one per entity and no class declares it, so a class extending
one can only stand IN FRONT of it: `seamChains` refuses a subclass that does not ask for the
seam, since nothing else it could be. It is applied where the realization is BUILT
(`install.ts`) rather than under a container key — nothing resolves `Storage`, and
`<Entity>Storage` is what a handler asks for.

The scope is the FROND, like every other provider, and NO key widens it: the scope IS the
location — a link sits beside the code it changes and goes where that code goes. A key would
break the gradient: a frond moved behind `remotes:` would silently leave the reach of a link its
own code never mentions, and the gradient promises the USER CODE is identical, not that the
deployment statement is. A link that must be everywhere is a FROND that is everywhere, which
`Extension.fronds` already answers — `@fougere/calls` brings one into every app that installs
it. `middlewares: { Audit: 'app' }` has the same hole and is left as is.

The other two candidates were MEASURED and refused, 2026-09-11, because each already has its
mechanism: an outgoing remote call runs `runMiddlewares` before the transport
(`boot/remote.ts`, `createRemoteFacade`) — what is missing there is not a seam but a scope,
since a frond's middleware covers the addresses its handlers SERVE and not the ones they
CALL, which is a different subject with no name yet. And `HttpRouter` is never held by the
boot at all: the host builds it, hands it to `registerRoutes`, and already holds both
`router.use(middleware)` and the routes array — a seam would be a fourth way to say it. Both
ways in are written down, with `Storage`'s, in `site/content/*/docs/4.business/10.ports.md`
and `7.storage.md`: `remoteTransport:` swaps a transport whole, `app.use` wraps the outgoing
call, `router.use` and the routes array reach the HTTP side.

`Storage` is an interface AND an abstract class merged, so the class carries the thirteen
gestures as a TYPE while its prototype carries them as a FORWARD — a link writes what it
changes and nothing else. What it stands in front of is a SYMBOL on the instance, set
through a cast: a declared member would join the interface and `storageOver`'s object
literal would stop being a storage, a `#private` field would make the class nominal and
refuse every realization at once, and a `WeakMap` beside the instance is not found through
`StorageGuard.guard`'s `Object.create(storage)`. The guard stays OUTSIDE the chain, so a
link reads the value the door already parsed. A bare `Storage` in a signature binds because
`depKeyOf` (`compiler/src/scan/scanner.ts`) stops reading `Record` as a subject — it is the
default of `Storage<T = Record<string, unknown>>`, which the checker fills in, and the key
was `RecordStorage`. Pinned by `tests/seam.test.ts`.

**Sources** — a place rows live, and the four gestures it owns: `storageFactory` (required),
`migrate?`, `transacted?`, `close?` (`core/src/source.ts`). What a source is MADE OF is not
there: `adapter/sql` states `dialect`, `db` and `sink` on its own `SqlSource`. The migration
is the source's own gesture; the router partitions and hands each source its `SourceView`.
`source:` names the ADAPTER and `dialect` stays SQL's. No `transacted` means a frame
compensates instead of transacting, and the boot says so per frame. Pinned by
`defaults/tests/sources.test.ts`.

**`enforces?` is not a gesture but a promise** — the constraints a source refuses AT THE ROWS,
which the judge at the door cannot: it refuses the duplicate it can SEE, and two writes arriving
together see the same absence. `declares(schema, 'unique')` is its dual, read by `boot/frame.ts`
too. SQL states `sqlEnforces`; a Map states nothing, and the boot names the entities that costs
rather than refusing them. Pinned by `core/tests/enforced.test.ts`.

**The thirteen gestures derive from four** — `core/src/storage/store.ts`, `storageOver(open)` over a
`Store` (`get`/`has`/`set`/`delete`/`all`/`client`). `adapter/memory` is 25 lines and
`adapter/file` 90. `transacted` is deliberately not in the frame: a unit of work belongs to
an engine that has one. `all()` reading everything is what bounds a file source.

**Prefab ops** — `Crud(Post)` gives the five typed CRUD ops. `Crud(Post, { list: PostCard })`
names the view ONE op emits: the handler keeps its full-row storage, and the façade projects.
`Crud(Post, PostPublic)` is the handler-wide form and scopes the injected storage.

**A test states what it expects** — `@fougere/testing`. The CASES come from `InputRefusal`'s
closed set read against the four axes (`Cases`, in `@fougere/schema` because deriving them
reads the axes and nothing else), the DOUBLES from a port's prototype (`stubOf`), and the
LEVEL from where the file sits. `checkDoors` compares REST against GraphQL; `driftOf`
compares two `rpc.discover` cards through `Card.diff`.

**A frond names where its op answers, on every surface** — `graphql: 'posts'` and
`rest: { path: '/articles' }` in `frond.config.ts`, read by `adapter/graphql`
(`pothos.ts`) and `adapter/rest` (`routes.ts`). REST had no such key: the path lived in
whatever host called `generateRoutes`, so one surface was named beside the operation and
the other three files away. The PREFIX stays the host's — naming is the frond's, mounting
is not — and a host's `overrides:` still wins, since it is deciding for someone else's
frond. Pinned by `adapter/rest/tests/stated.test.ts`.

**Operation contract, three producers** — the façade consumes `OperationContract` and
nothing else. A prefab DECLARES (`Crud.__ops`, runtime), the scan DERIVES from source,
`frond.config.ts` STATES and wins over both. Config also creates an op neither producer
found — the answer for a method inherited from an installed base class. `description` is the
method's own doc sentence, read from the AST (`compiler/src/scan/handler-parser.ts`, `docSentenceOf`).

**Call contract** (`core/src/wire/call.ts`) — a Frond call is a value `(entity, op,
invocation)`. `createLocalRunner` (`boot/runner.ts`) executes locally, `createAppRunner`
follows the topology, `identityCardOf` (`boot/card.ts`) answers `rpc.discover`. Transports
move the value, never reshape it. Browser-safe surface: `@fougere/core/contract`.

**`Emit<T, A>` — the SECOND type is what makes an announcement wait.** `Emit<T>` hands the
fact over and returns nothing; `Emit<T, Verdict>` waits for every subscriber and gives back
what each answered. Two container keys, `…Emit` and `…Await`, because they are two
relationships to one subject — no option and no mode, which is why the one case that cannot
be honoured is refused AT BOOT: a carrier reaches whoever subscribed elsewhere and brings
nothing back, so the answers would hold this process's subscribers only.

A subscriber declares nothing new: `Fact<T>` answering `Promise<void>` has no opinion, any
other return is one. The ANSWER is its own entity — shaped like the fact it would read as a
transformation, which is a link's signature (`Pipe<T>` in, `T` out). A subscriber that does
not answer REFUSES the announcement rather than shrinking it: an announcer handed the
survivors cannot tell them from a complete answer, and its own law then reads silence as
consent. Pinned by `tests/emit-await.test.ts` and `demos/ask-quorum`.

**`Pipe<T>` finishes a fact** — the third word of the family, and the declared form of a
position the core already held: `Emissions.stamped` realizes `created()` before anyone is
handed anything. What it is NOT for is dropping a field: a fact is a PROJECTION
(`Post.pick('id', 'title')` — five of them in the tree), so what should not travel is
simply not declared. A link earns its place on what remains and must be TRANSFORMED — a
hash `pick` cannot produce, a lookup needing a dependency the announcer should not hold. An op taking `Pipe<T>` ANSWERS the fact every subscriber then reads, so its
output is DERIVED from the fact rather than projected (`effective-operation.ts`) and it is
handed the whole of it (`ArgumentResolver`, the `fact` branch). Several may finish one fact, and they run in
the ORDER their fact's owner declared — `pipes: { postPublished: ['RedactHandler',
'StampHandler'] }` in `frond.config.ts`, where the second reads what the first answered.
Two links with no order refuse at boot naming both, a link the order does not list refuses
too, and a frond ordering a fact it does not own refuses: ordering is a decision about the
fact, and a decision has one owner. A link that answers NOTHING is refused, and the announcer is told: it used to reach nobody
by crash, every subscriber handed `null`. A fact is what HAPPENED — the announcer already
said so and `Emit` returns void, so nothing could tell it otherwise. Filtering belongs to
whoever announces, or to each reader.

A link is CALLED, so it needs an address — local, or named in `remotes:`. A carrier has no
address, so a link can never live behind one, the same line `Ask` draws. It is a HARD
dependency where a subscriber is not — a subscriber that throws is
logged and the announcer goes on, a link that throws stops the announcement, and behind
`remotes:` that makes announcing depend on another process. Pinned by `tests/pipe.test.ts`
and `demos/pipe-split`. `Fact` and `Pipe` are both transparent (`= T`), so the scan keeps
them by NAME (`handler-parser.ts`, `ANNOUNCED`) — the checker keeps nothing of an alias.

**`Emit<T>` / `Fact<T>`** (`core/src/wire/emit.ts`, dispatched by `boot/Emissions.ts`) — every
other call names ONE recipient; an emission names a SUBJECT. Accepting a `Fact<T>` IS the
subscription — no topic, no register call. It is a resolver, not a channel: nothing is
durable, and a subscriber keeps its validator, its binding and its middlewares. That is
also its PRICE, and it is what keeps a span from being one: measured 2026-09-11, an
operation costs **813 ns**, its span through a plain list of takers **53 ns**, and announced
**2408 ns** — three times the thing observed, once per operation. A fact is worth a dispatch
when it crosses a boundary, not when it stays in one process. A ring is
refused, a diamond is legal. Announcing returns once every subscriber has been HANDED the
fact; `app.deliver` waits for them all and REJECTS with an `AggregateError`. A fact is
validated strictly. Pinned by `tests/emit.test.ts`.

**A family cycle is a check** — `tools/cycle-check.ts`, `pnpm arch:cycles`, run in CI beside
`pnpm arch`. `arch` asks what a file REACHES, this asks where it LIVES. It reports type-only
cycles too and marks what the emitted JS does not contain, and it prints the THIN SIDE
because that is what moves. It reads pairs, and it does not read a package's ROOT as a family — which is where the
  passes of 2026-09-10 found what it could not see: a family reaching down for a leaf that
  depends on nothing (`schema/src/lib/validation.ts`, `core/src/storage/`) while the root
  reached back up into it. Four exceptions are stated
with their reason: `field`↔`validator`, `axis`↔`projection`, `axis`↔`field`, `entity`↔`field`.

**An imported name is a check** — `tools/import-check.ts`, `pnpm import:check`, run in CI
beside `publish:check` and `door:check`. Those two ask about the PACKAGE — what a tarball
promises, what it resolves once installed. This asks about the CALLERS: every VALUE import
of a `@fougere/*` entry anywhere in the repo, looked up in the entry it actually loads. A
`.mjs` host script, a scaffold template under `packages/cli/templates/` and a fenced block
in a README each name a door, and no tsconfig reads any of them — so the export pass of
2026-09-10, which counted callers, cut `generateSQL` and renamed `bootAppFromConfig` out
from under two of them. Both failed at their first run, the day after a green suite.

**Nuxt primitives** — `useQuery`/`useCommand` (a command on X revalidates mounted queries on
X), `useFormFor` (contract, not rendering; local validator = remote validator), `useCurrentUser`,
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
- **A comment names its doc page when one exists** — `Documented: /docs/business/ports.` on
  the last line of the block, the site ROUTE and never a file path, because the route is what
  a reader opens and it survives the file moving. Only where the page explains the concept,
  never as a second description of what the code already shows.
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

- **Scanning a directory that sits under `packages/` fails** — `LogLine_base is not defined`,
  measured 2026-09-10 on `packages/log/fronds/`. The same file scanned from outside the
  workspace loads. `findWorkspaceRoot` (`compiler/src/scan/scanner.ts`) seeds a type program
  from the monorepo root, and the entity is then evaluated from an emit whose hoisted
  `const <Class>_base` is lost. `@fougere/log` states its frond rather than being scanned,
  which is the right form for a published package anyway — so this is a trap for a frond
  inside a workspace package, not a blocker.
- **A type alias of a port does not bind** — `type Log = Emit<LogLine>` then
  `constructor(private log: Log)` resolves to the key `Log`, and the boot refuses
  `'Log' is not registered`. The checker keeps the OUTER alias symbol and drops
  `<LogLine>`, so `depKeyOf` never sees the port. Recovering it means reading the alias's
  own declaration in `handler-parser.ts` (`parseCheckedType`). Measured 2026-09-10; the
  alias was removed rather than shipped broken.
- **`onQuery` is the last registry, and its two ends cannot see each other** —
  `adapter/sql/src/query.ts`. The producer is a Kysely built by `createSqliteSource()`
  BEFORE any app exists, and the consumer is `@fougere/calls` subscribing in its `up`. No
  path runs between them: an app holds `db`, never the source, and a Kysely's `log` is fixed
  at construction. A module-level list is what bridges that, and closing it means giving an
  app its sources. `registerFlush` is the same list read once instead of per line; it lives
  at module level because the host that calls `flushTelemetry()` holds a request handler,
  not an app (`demos/cloudflare-d1`, `ctx.waitUntil`).
- **An un-augmented `adapters:` accepts anything, silently.** With no adapter in the program
  `EntityAdapters<TFields>` is `Partial<{}>`, which in TypeScript means "anything
  non-nullish". The RUNTIME half is closed since `AdapterFieldValidator`; what remains open is the type.
- **A seed cycle is not satisfiable by ordering** — `core/src/boot/seed.ts`, `orderSeeds`.
  It returns them as `cycle` beside `ordered` and the boot NAMES them; they are still planted
  in declaration order and the source answers. Not "scan order": `createApp` takes `fronds:`
  as readily as `scan:`.
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
- **The cross-source read is raw SQL while `ref()` already declares the join.** A path in
  `orderBy` is REFUSED at the door now rather than swallowed, so the join it would need is
  named as missing instead of answered unordered. The next step is the two-source demo.
- **A computed field that reads still issues N queries.** The façade hands the presenter the
  PAGE (`dispatch/PresenterExecutor.ts`), so one query per page is possible, but
  `Promise.all(rows.map(...))` inside the field body is not refused.
- **`BindingPlan.optional` is written five times by core and ignored by `resolveArgs`.** Not a
  missing reader: making it refuse breaks four tests, two of which state the opposite policy
  on purpose. Closing it means choosing which door is right.
- **`storage.client` remains the anonymous multi-statement path, validator off** — everything else
  writes through a guarded port, `Together<[…]>` included.
- **A provider class named `<Entity>Storage` is DISCARDED, not honoured** — the entry used to
  say the opposite. `bootstrap.ts` registers providers before storages and `registerValue` is a
  plain `registry.set`, so the entity's storage overwrites the provider. `refuseStorageInUserCode`
  does not cover it: it reads `decl.deps`, never `decl.ctor.name`. Measured 2026-09-09. The name
  is already wrong by two rules, which is why nothing hits it; left as is.
- **`Mirror` holds a loop and a page contract, and nothing else** (`core/src/prefab/mirror.ts`).
  What it held of its own is gone — `StorageGuard` guards every write gesture now, so a page is
  judged where every other row is. The mark is the CALLER's since it read one off its own rows,
  which carry when WE wrote them: a pass that threw halfway still advanced it, and what the
  source had changed in the gap was never asked for again. `demos/mirror-catalog` keeps it in
  `PartnerCatalog` and moves it only after a pass returns.
- **A schema can say what it WAS, and the missing reader is the API.** `Card.diff`,
  `fougere freeze`, `fougere migrate --apply` are shipped; serving an old API version is not.
- **A stored fact is not VERSIONED.** It IS validated: `json(Address)` builds `properties` and
  `required` off the entity and the judge reads them — only bare `json()` admits any shape, which
  its own doc states as its object. `x-fougere-version` versions the DESCRIPTOR FORMAT, never an
  entity's contract. Remeasured 2026-09-09.
- **`flushMs: 0` is the only legal form on a Worker, and nothing says so.** `Beat.every`
  (`observability/src/Beat.ts`) defaults to 1000 ms, so an app built at module scope builds
  its exporter — and its `setInterval` — there. Cloudflare REFUSES that deployment:
  "Disallowed operation called within global scope", error 10021, measured 2026-08-23.
- **Nitro's prod trace misses lazily-loaded packages under pnpm**, which is why the hand-copy
  in `site/Dockerfile` exists.
- **`clean` decides nothing** (`schema/src/lib/utils.ts`) — a free function nobody has
  validated as a word of the package.
- `graphql` dual ESM/CJS hazard in tests — use `schema.getTypeMap()`, not `printSchema()`

### Settled

One line each, kept because a past version of this file asserted the opposite.

- **`Emit<T>` is PARTIAL, because announcing realizes the fact's `lifecycle.create`** — a
  `created()` stamped by `Emissions`, which asking the announcer for made every emitter cast
  past its own type. A missing field is still refused, by the judge that reads the fact.
  Pinned by `core/tests/emit.test.ts`, through the typed emitter.

- **A refusal says WHERE, all the way down** — `ValidationError.path` is SEGMENTS
  (`['addr', 'street']`), and `FieldValueValidator` keeps the engine's `instanceLocation` and its
  DEEPEST refusal: `errors[0]` on a nested shape is the parent's `Property "…" does not match
  schema.`, true and never the reason. `dotted()` writes a path for a message and nothing reads one
  back — the price a field legally named `a.b` sets. Pinned by `schema/tests/nested-path.test.ts`.

- **A descriptor is converted at the door, and a schema circulates** — `Card.fromDescriptor(…)
  .toSchema()`, which `boot/remote.ts` already did. `SchemaOrCard` had the adapters say they
  took either form, and `toTable` rebuilt the schema twice for the one nobody passed them.
  The four adapters read `SchemaView`, and `schemaOf`/`fieldsOf` are gone with the union.

- **A fresh table and a migrated one promise the same thing.** `changeSQL` states `notNull()`
  whether or not a default fills the column, and `delta` proposes a UNIQUE index for a
  `unique()` a live table never read — the statement fails on rows that already break it,
  which is the answer. Pinned by `adapter/sql/tests/diff.test.ts`.
- **`StorageGuard` guards every gesture that writes**, `upsert` and `upsertAll` included, judges
  a page before its first row lands, refuses a key the entity does not declare, and hands the
  storage the value it PARSED — the rule the client door already held. What it does NOT ask is
  what a handler is ALLOWED to write: a `readOnly` field is the server's to fill.
- **A boot that refuses releases what it took, from its FIRST line** — `bootstrap.ts`. The
  caller hands `onDispose` over before the ascent and never receives the app that would carry
  it back, and the sources and storages are opened long before an extension is asked to rise.
  `release` reads `built`, so before the app exists it runs the two levels that do. Pinned by
  `tests/lifecycle.test.ts`.
- **A composition answers for the source the work runs in** — `transacts(source)`
  (`defaults/src/storage.ts`), the dual of `transacted`. Reading the default source's capacity
  compensated a frame whose own engine held transactions. Pinned by `defaults/tests/sources.test.ts`.
- **The data layer travels as ONE subject** — `FougereServerConfig.storage: ResolvedStorage`
  (`app/shared/src/boot.ts`), and the Nuxt codegen passes it whole. Naming a few of its members
  left `transacted` and `close` behind, under Nuxt only.
- **`output(schema)` restricts what it hands back on both realizations** — `storageOver`
  (`core/src/storage/store.ts`) applies the scope SQL puts in its SELECT. Pinned by
  `adapter/memory/tests/storage.test.ts`.

- **A container key and the way to undo it are declared together** — `storageKeyOf` /
  `entityOfStorageKey` (`core/src/storage/port.ts`), the third pair beside `togetherKeyOf` and
  `emitKeyOf`. The dual asks whether the prefix names a SCANNED entity.
- A decision has ONE owner, instantiated on its subject when the subject can be held:
  `InputValidator.of(fields, opts).validate(row)`, `Card.fromSchema(Post)`, `FieldSet.of(f).primary`.
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
- The shape is held on three paths: the façade validates input, `StorageGuard` validates every write,
  and the DDL emits `CHECK` for `oneOf`/`min`/`max`. `pattern`/`format` stay at the façade.
- **A decoder must answer a value it already produced.** Two doors decode — the client one on
  what arrives, `StorageGuard` on what a handler writes — because both hand the storage a PARSED
  value, which is the policy and not an oversight. Stated on `Decoder`
  (`schema/src/axis/boundary/Boundaries.ts`), pinned by `tests/boundary.test.ts`.
- The façade hands on the value it PARSED (`dispatch/HandlerFacade.ts`, `validated`).
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
