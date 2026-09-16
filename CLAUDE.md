# CLAUDE.md

Guidance for Claude Code working in this repository.

## What is this

Fougere is a TypeScript framework built on ONE idea, stated in the negative because that
is the form that can be checked: **the declaration names nothing outside itself** — no
table, no protocol, no host, no address. The two things this file used to call its two
ideas are its two readings, and calling them two hid the rule that produces both:

1. **Single-schema** — what the declaration does not name is *derived* from it: one Entity class (`class Post extends entity({...})`) generates validation, DB tables (Kysely), GraphQL types (Pothos), form contracts, API surfaces.
2. **The gradient** — what it does not name is *chosen outside* it: a Frond (entities + handlers + collectors + seeds) runs in-process or in its own process behind JSON-RPC, with **identical user code**. `fronds:` in `fougere.config.ts` is the whole statement — an entry per frond, whose `extends:` names the one it inherits code from, whose `remote:` says where it answers, and whose key names a module when a package brings it.

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
                                   # comment `fronds:` → same app in-process
pnpm -C demos/schema-ecommerce dev # Apollo Server on :4000
pnpm -C demos/container-basics dev
pnpm -C demos/core-scanner dev
pnpm -C demos/ports-swap dev        # one handler: two PSPs, the refusal, a chain, and a seam
pnpm -C demos/transport-chain dev  # one handler, six behaviours — the links that carry its calls
pnpm -C demos/config-reload dev     # one boot, a real SIGHUP, a drain — and what a re-read cannot change
pnpm -C demos/mirror-catalog dev    # two passes over a source that only answers ?page=&since=
pnpm -C demos/sse-live dev         # live fan-out to readers who are not trusted peers
pnpm -C demos/log-destinations dev # two destinations for one line, and the frond that names neither
pnpm -C demos/shared-parent dev    # one frond holds what a family shares, and answers nothing
pnpm -C demos/pipe-split dev       # the op that FINISHES a fact — here, then behind `fronds:`
pnpm -C demos/ask-quorum dev       # `Emit<T, A>` — the announcement that waits, across three processes
pnpm -C demos/observability dev    # three processes; `pnpm load` (k6) and `pnpm signoz` beside it
pnpm -C demos/together-frame dev   # two writes that stand or fall as one — then uncomment `sources:`
pnpm -C demos/crossing-cost dev    # a chain of three, and the config line that decides what it costs
pnpm -C demos/oclif-catalog dev --help  # a frond as a terminal — topics, flags and help derived
pnpm -C demos/boot-refusals dev    # fourteen projects that do not hold — a code, a subject, a file
pnpm -C demos/on-delete dev        # restrict, cascade, set null — the engine, then the guard
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
  workflow/            @fougere/workflow      optional: a run says a release began, and a sweep finishes it
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
    oclif/             @fougere/oclif         a frond's operations as a terminal — one command per op
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
  transport-chain/     journal, retry, a dropped line and a replay — none of it named by a handler
  config-reload/       the config re-read under a running app, the drain, and what it refuses to change
  mirror-catalog/      a copy of rows the app cannot query, and what the second pass costs
  together-frame/      one frame, two realizations, and the config line that picks one
  crossing-cost/       cart → pricing → catalog: 0 hops or 2, decided by `fronds:` alone
  oclif-catalog/       a frond as a terminal — every flag read off the entity, nothing declared
  observability/       three Fronds in three processes, one trace — and what the wire cost
  test-gradient/       what the declaration writes on its own, and the four rungs it runs at
  boot-refusals/       fourteen projects that do not hold, and what each refusal names
  on-delete/           what a deletion does to the rows that name it — one line moves who does it
  anchor-chain/        a path with two stops — which derivations hold rows, and which say nothing
  emit-multirepo/      two repositories, one fact, and the ~80-line carrier that is not Fougere's
  rust-frond/          the far side is not TypeScript, and the validator is still ours
  cloudflare-d1/       the edge rung — scan emitted, no tsc shipped
  sse-live/            live fan-out to readers who are not trusted peers
  log-destinations/    where a line goes is the operator's line, not the domain's
  shared-parent/       a service and a middleware two fronds inherit, named by neither
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
`fronds:`, `sources:` and `ports:`. Pinned by `adapter/sql/tests/adapters.test.ts`.

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

**A topology has two halves, and neither may be read as the other** — `boot/declared.ts`,
`declaredTopologyOf`, the dual of `identityCardOf`: the card says what this app SERVES, this
says where the rest is supposed to be. It reads `app.remotes` and `handler.deps` and calls
nobody, so `TopologyReport.declared` sits beside `fronds` and `edges` — which stay COUNTED —
and is never merged into them. The counted half cannot report a frond that never answered:
it is absent from it, so a system with a node down reads as a smaller healthy one, and
`demos/observability` at rest reported three processes as a monolith. A crossing is a dep
equal to `facadeKeyOf(address)` of an address ANOTHER frond serves, indexed FORWARD like
`registrationsOf` (`verify.ts`) — never by reparsing a suffix — so an address nothing scanned
resolves to nothing and is left out rather than guessed. A crossing is ALSO an announcement,
and that one has no dep to read: a subscriber names nothing — accepting a `Fact<T>` is the
whole subscription — so it is found from BOTH ends, the announcer's deps (`factsAnnouncedBy`)
and the listener's binding plan (`factsListenedTo`, `wire/Emit.ts`), which is what `Emissions`
reads rather than a type name. Read from the deps alone, `demos/pipe-split` answered four
fronds with nothing between them, and three of its four are reached by a fact. A `Pipe<T>` link
counts as one: it is called the same way. Three readers that each held a
piece: `rpc.topology`, `@fougere/calls`' `servedModel` (which had its own `declared:` and its
own `hostOf`), and `fougere graph`, which now prints the frond altitude above the entity one.
Putting the two side by side found its first disagreement the same day: a frond whose code
sits in the project is SCANNED, so `fronds:` leaves it in `app.fronds`, and `topologyOf`
answered `local` for a frond every call reached over HTTP. Pinned by
`core/tests/declared.test.ts` and `observability/tests/edges.test.ts` — which is also the
first test in that package to pin a non-empty edge at all.

**A step says what it did ITSELF, and a duration cannot** — `FinishedSpan.selfMs`
(`observability/src/index.ts`), its duration minus what its OBSERVED children account for.
`shop:cart.checkout` in `demos/observability` reports milliseconds and almost no self: it is
not slow, it is waiting, and a column of durations reads the two the same way. Which is why
the subtraction and what runs UNDER an op are ONE subject and not two — a handler spending
30 ms in SQL had no observed child, so its self time was its whole duration and the report
named the wrong step. `tracing()` holds both doors for that reason: a statement is not
dispatched, nothing wraps a middleware around a query, and both need the same table. The
join is the STACK, not a path — a Kysely sink runs synchronously inside the async context
the tracer opened, so it reaches the operation in flight while the app holds no source.
`kind` is what that costs: a statement is a step and not a call this process answered, so
`metrics.ts` says so in a line, and it is the only reader that has to. Never negative —
children under one `Promise.all` outlast their parent, and what is measured is the time
nothing else accounts for.

**The count DETECTS and the detail EXPLAINS, which is why `spanPerStatement` is OFF** — the
charge to the parent happens either way, so `selfMs` and `statements` are the same in both
modes and a dashboard reads one span instead of forty. What the option adds is WHICH queries
ran, which is a diagnosis: turned on over the operation the count named. The CPU does not
decide it — a statement span is **658 ns** against a SQLite in-memory select at **14 µs**,
4,7 % on the fastest storage there is and 6 ns with the package absent. The VOLUME does: a
backend charges per span, and a page of forty rows exports forty. `@fougere/testing`'s
`spansOf` turns it on, because a test IS the diagnosis. Measured 2026-09-12, pinned by
`observability/tests/statements.test.ts` and `testing/tests/statements.test.ts`.

**What an op REFUSES is walked from the refusals upward, not read from its body** —
`compiler/src/scan/refusals.ts`, carried as `OperationContract.errors` and published on `CardOp`.
Reading a handler's own body answers "at least these", which is not a contract: a guard moved
into a helper — a refactor with no change of behaviour — would silently shrink what an app
promises. Measured on `site/fronds/blog`: the body of `publish` holds ONE throw and the walk
finds four, because the three that matter live in module functions beside it. It walks UP because
there are a handful of refusal sites and many ops, and an address resolved through a port lands
on the union of what its realizations refuse — OVER-approximating, the honest direction for a
contract, where a code that cannot happen costs a dead branch and a code that can costs a
surprise. It stops at the frond: what another frond refuses is published by ITS card.

The FRAMEWORK's half does not travel (`wire/refusals.ts`, `refusalsOf`). `VALIDATION_FAILED`
follows from `input`, `SERVICE_UNAVAILABLE` from being dispatched at all, `BAD_REQUEST` from
being a command, the gateway pair from a remote placement — every one already on the card, so
writing them per op would be one fact in two places. The two halves are put together where they
are READ. `INTERNAL_ERROR` is in neither: `toPublicError` replaces its message, so it is a bug
rather than a refusal. `FougereError<Code>` carries the narrowing, defaulting to every code so a
thrower writes what it always wrote — the gain is a `switch` with a `never` default that stops
compiling when an op learns to refuse something else. `contract.ts` writes `errors` into the
emitted scan like every other member: a contract that loses a field on disk answers differently
depending on how it was booted. Pinned by `compiler/tests/refusals.test.ts` (two hops through
helpers) and `core/tests/refusals.test.ts`.

**A page IMPORTS its facade, and the module is written by the scan** — `@fronds/facade`, one
`const` per address carrying the handler that answers there as a TYPE. Compiled, the whole of
`post` is `{ address: 'post' }`: the handler is named, never imported, so no server code reaches
a bundle — 1.8 MB of core is reachable from `PostHandler`, and `extends Crud(Post)` is a call
that would run in the browser. What the type buys is the page's whole contract: which operations
exist, what each answers, and what each can refuse. Thirteen row shapes were written by hand
across this tree before it, five of them incompatible versions of one Post. The address had to
travel as a LITERAL for `address.op` to be looked up, and that is why it is a generated value
rather than `facade<PostHandler>('post')`: TypeScript infers nothing once a type argument is
written by hand, and every call site writes its row type. `useFormFor(Post)` keeps the entity,
which is the line — a form IS a set of fields, a call is a facade. An absent module fails to
resolve, loudly; a STALE one is the silent case, which `fougere check` reports as
`facade-stale`. Pinned by `compiler/tests/facade.test.ts` and `app/react/tests/facade.test.ts`.

**A scan has a THIRD projection, and it is types** — `compiler/src/scan/doors.ts`, `emitDoors`,
beside `emitScan` and `emitStatement`. The runtime scan cannot serve as one: its operations
travel in a `Map`, and a `Map` literal widens its key to `string`, so the association between an
op and its refusals is exactly what TypeScript drops there. An interface keeps it. The file holds
no value, reaches no bundle, and is rewritten whenever the app starts — `fougere build` writes it
beside the module, the Nuxt module adds a third template, and the Vite plugin writes it from
`configureServer`, which covers React, Svelte and Vite at once. `fougere sync` writes the same
module from the CARD: a frond in another repository has no sources here, and the card carries the
three facts the module needs — the addresses, the operations, and what each one refuses. The
handler's CLASS is the one thing it cannot carry, so the synthetic interface `sync` already wrote
stands in its place, exported by NAME rather than by default — which is why `Served.handler` is
the whole type EXPRESSION and not a path, and why `facadeModule` is shared rather than copied:
two spellings of one format drift the day either gains a member. A code the card names and this
version has no member for is DROPPED, because the far side may be newer and a name resolving to
nothing would stop the consumer's build. A host that never generates falls back to the whole
`ErrorCode`, which is what a client had before this existed. Pinned by `cli/tests/sync.test.ts`.

**An op's REACH is the dual of its placement** — `EffectiveOperation.reach`, filled where
`placement` already is. `placement` says where an op ANSWERS, `reach` where its work GOES: the
fronds its handler crosses to, and how many of those are a process away. Both halves read the
same index — `servedBy`/`reachedBy` (`boot/declared.ts`), shared with the declared topology so a
crossing is recognized once. Read from the HANDLER: a dependency is declared on the constructor,
so every op of one handler reaches the same fronds, and saying otherwise would dress a structural
fact as a precise effect. Three constants are written down today that are all a function of one
number — `sampled: parent?.sampled ?? true` (always true), `BOUNDS` (one list for every op), and
a load script's `p(95)<500` (one threshold for every op). An op that hops twice is not the same
subject as one that hops none. Rendered by `fougere explain`; pinned by
`core/tests/declared.test.ts`.

**A number one process writes down for every op is a number that fits none** — three were, and
each is answered differently now that `reach` exists. The SAMPLING rate is a budget, so it is the
operator's (`observability({ sample })`, default 1) and the code answers only what a budget may
NOT touch: an op with hops is always kept, since the gap between a caller's span and a callee's IS
the wire cost and neither measures it alone. The LOAD threshold is per op and derived —
`BUDGET.base + op.hops * BUDGET.perHop`, two numbers in the generated file instead of one, read
against a `k6` threshold per tag. The histogram BOUNDS are deliberately NOT derived per op though
`reach` could: an explicit-bucket histogram aggregates only across series sharing its bounds, so
per-op bounds would silently break the panel that asks for the p95 of the whole service. They
left the library instead (`observability({ bounds })`) — a list of bounds is an operator's
decision, not a literal a package holds. Pinned by `observability/tests/sampling.test.ts`, which
runs the same fixture with and without `fronds:`.

**A host owns its own starter, and the dependency list is the registry** —
`packages/app/*/template/`, resolved by `ProjectWriter` (`listTemplates('apps')`). The CLI held
ONE starter under `templates/apps/` while six hosts were published, so `fougere new` could only
make a Nuxt app and a `nuxt.config.ts` was written in two packages. A host appears the day the
CLI depends on it and ships a `template/`; `@fougere/vite` ships none, because it is what React
and Svelte are BUILT with rather than an app to scaffold, and the registry leaves it out without
a list saying so. Resolved with `import.meta.resolve`, never `createRequire().resolve`: a host's
`exports` states only the `import` condition, so the CJS resolver answers
`ERR_PACKAGE_PATH_NOT_EXPORTED` for every one of them. A FROND template stays in the CLI — it is
Fougere's own vocabulary, and no other package owns it. Pinned by `cli/tests/scaffold.test.ts`.

**`fougere load` writes the scenario the app already describes** — `cli/app/commands/LoadCommand.ts`
over `loadScript` (`@fougere/testing`), which was exported, tested, and called by one script by
hand while the file it generates said `Generated by \`fougere load\``. It reads the SCAN, not a
boot: a boot migrates and seeds, which describing a project may not do — `loadScript` takes
`{ fronds }` rather than an `App` for exactly that. What it derives is the ops, a body per op from
the entity's own fields, and the envelope from `frameCall`; what it marks as the operator's is the
weights, the stages and the thresholds, in the file where they sit. Pinned by `cli/tests/load.test.ts`.

**`rpc` is a registry, not an `if`** — `wire/call.ts`, `RPC_ENTITY`, served out of
`dispatch/RouteRegistry.ts`. `app.serveRpc(op, answer)` is how an optional package declares
a reading core does not hold, and a second declaration of one name is REFUSED. An app that
never installed `@fougere/observability` answers `Unknown rpc operation 'topology'. It
serves discover.` The report shapes live in core (`TopologyReport`, `FrondPlacement`, `Edge`)
because they cross a process boundary.

**The names the scan reads** — `core/src/Conventions.ts`, read by `@fougere/compiler`. Everything else a frond states, it
states by its SHAPE; the twelve convention directories and the import scope are the one place
a NAME is the declaration, and the only ones a project may restate (`conventions:` in
`fougere.config.ts`). Two of them extend the FRAMEWORK rather than declare a domain, and one
of those two is the only directory with an ORDER: `vocabulary/` is read before `entities/`,
because a file there registers a word at module level (`Generators.register('ulid', …)`) and
an entity beside it may write that name — a registry refuses one it does not hold. The other,
`extensions/`, is recognized by its FORM, a module stating `up` or `down`, and it travels with
its frond: behind `fronds:` it mounts on the process serving it there, which is why no key
widens it — what must be everywhere is a frond that is everywhere, which `Extension.fronds`
already answers. The config is read BEFORE the aliases, because it names the scope they
are built from. `.fougere/` is the framework's working directory, not user vocabulary.
Pinned by `tests/conventions.test.ts`.

**`fronds:` says what an app is MADE OF, and `extends:` says one thing only** —
`FrondsStated` (`core/src/FrondsStated.ts`), judged by `boot/nesting.ts`. It is the INHERITOR
that names what it inherits from, and by a scalar: a name then lives in one place, so moving a
frond is one edit and removing it leaves nothing dangling, where a parent listing its own put
every name twice. It is also the form `tsconfig`, Maven and Kubernetes all chose for
inheritance — and each of the three that later opened it to a list had to write "the last one
wins". ONE level: the frond an `extends` names may not inherit itself (`frond-extends-chain`),
which is what keeps a cycle out without a cycle check, the way Cargo's single level does. A
frond a family inherits from needs NO entry of its own, so what it may not be is asked of the
NAMES rather than of the entries. A child resolves what its parent declared, because its scope hangs off its parent's: `installFrond` starts from
`container.resolve('frond:' + under)` and `ScopeContainer.resolve` walks up on its own, so
providers, `<E>Repository`, presenters and port keys are inherited with no mechanism at all.
Middlewares and seams are not — neither is a container key — so both are CARRIED lists,
composed outside the child's own. Nesting says nothing about placement and nothing about the
right to CALL: two fronds still reach each other through a façade or an announced fact, and
`verify()` exempts an ancestor and no one else. What keeps that safe is the refusal: a frond a
family inherits from may not serve (`frond-parent-serves`), may not be placed at an address
(`frond-parent-remote`), and may not declare rows (`frond-parent-entities`) — with no façade
nothing can call it, so nothing can move it, and it stands in every process holding one of its
children. `remotesOf` folds the tree's string leaves and `fronds:` into one reading, so
nothing downstream learns there are two graphies; a module key is imported by the HOST, never
by core, and where it lands is read off its form — `up`/`down` means an extension. The word
`fronds` had three senses and now has two: the filter is `only:`. Pinned by
`core/tests/{fronds-stated,nesting,stated-modules}.test.ts`.

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
entities since a handler without one runs behind it too — AND for the fronds under it in
`FougereConfig.fronds`. How far it reaches is written nowhere else: `MiddlewareEntry.scope`
is gone, because where a frond sits IS the reach and stating it twice put one decision in
two places. A frond serving nothing has no address of its own, so what it declares only
ever reaches its family — which is also why such a middleware used to run NOWHERE, in
silence, `registerMiddlewares` looping over handlers it did not have. An ancestor's list is
CARRIED (`Assembly.middlewaresOf`) rather than resolved: a middleware is not a container
key, so the scope chain cannot hand it down. Its closure keeps the scope that built it, so
it takes its dependencies from the frond that declared it — inheriting the code, not the
context. ONE instance per frond scope — its only consumer is the dispatch, which lives as
long as the app, so its lifetime is not a choice — built at its FIRST call and never at
boot, because a dependency may be registered by an extension's `up`, and closed with its
frond when it answers `[Symbol.asyncDispose]`. The price: two calls at once share it, so a
middleware holds nothing of a call on `this` — what a call carries travels in `context`.
It used to be built per call, to hand a request-scoped dependency its own instance; no
such scope exists (a call is not a request, and the transport is a leaf), and five calls
built five. `App.use` and a frond's directory are two doors onto ONE writer (`use` in
`boot/bootstrap.ts`), and `App.use` is the HOST's — it arrives after the boot and has no
tree. Pinned by `core/tests/middleware-frond.test.ts`.

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

The scope is the FROND and the fronds under it, and no KEY widens it — the widening is the
tree, and a tree is not a deployment statement. A key would break the gradient: a frond moved
behind `fronds:` would silently leave the reach of a link its own code never mentions, and the
gradient promises the USER CODE is identical. Nesting cannot do that, because a frond a family
inherits from is REFUSED a placement of its own (`frond-parent-remote`) and refused handlers
(`frond-parent-serves`) — with no façade, nothing can call it and nothing can move it, so it
stands in every process that holds one of its children. Its links are carried down
(`Assembly.seamsOf`) and composed outside the child's own, the same shape the middlewares
needed, since a seam has no container key either. A link that must reach fronds of no common
parent is still a FROND that is everywhere, which `Extension.fronds` answers.

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

**A `ref()` is held by a key, read by the guard, or named at boot** — `boot/relations.ts`,
`heldBy`. `relation` is the second member of `Constraint`, and the PAIR decides, never the
engine: SQL keeps a foreign key over rows it can see, so a key holds only when the target is
hosted here, in the SAME source, and that source keeps relations. Anything else becomes a
`RelationCheck` that `StorageGuard` reads before a write — one read per relation and per page —
and a target nothing in this process answers is named once, after every frond installed. Not a
transaction: the read and the write sit in two engines by construction, so a target deleted
between them passes. `Hosting` reaches the target through its OWNING frond, because a scope
sees its parent and never its siblings, and the frame and the surface build their guard from
the same answer as the frond's storage. Pinned by `core/tests/relations.test.ts` and
`demos/together-frame`, case 5. What a placement may not change BESIDE a deletion is
`defaults/tests/gradient.test.ts`: validation, boundary, lifecycle, `unique`, the reference,
a presenter handed the PAGE and a collector reading what the door filled — over the same
matrix, plus the two refusals no placement may soften (a collector where nothing consumes it,
a frame whose member answers elsewhere).

**A deletion is the dual of a write, and the ORDER is the guarantee** — `dispatch/Release.ts`,
`release`. `ref(User, { onDelete })` states `restrict` (the default, since a key with nothing
said already refuses), `cascade` or `set null`; `refuseUnwritableNull` refuses the third on a
field admitting no null, read off the FIELD because `optional()` wraps `ref()` and only the
final one knows. Who carries it out is `keyed` (`boot/relations.ts`), and one hop decides for
the WHOLE tree: an engine's cascade never passes through the guard, so a keyed hop above an
unkeyed one would take rows out with their own dependents left behind — one unkeyed hop
anywhere below and the guard takes all of it, the engine's cascade then finding nothing to do.
Every refusal of a level is asked BEFORE any of its rows move, because a refusal is about the
state before the operation: `ownerId: cascade` beside `approverId: restrict` let declaration
order decide until it was. Deepest FIRST means no intermediate state is wrong — fewer children,
never an orphan — which is what lets a release cross a process with no two-phase commit: there
is nothing to undo, only something to finish. Pinned by `core/tests/on-delete.test.ts` and
`defaults/tests/on-delete.test.ts`, the bench that runs one declaration at six placements.

**Core serves four readings in EVERY process** — `discover`, `holds`, `dependents`, `release`
(`boot/bootstrap.ts`). All four read the STORAGE and never a facade: a facade answers what its
handler chose to show, so `PostHandler.list` hiding drafts would hide exactly the row the
question exists to find. `holds` is the write's question asked across, `release` the delete's;
`peers()` is built from `fronds:` itself and not from the router, because the router indexes by
entity read off a card while the question is asked of a PROCESS about rows it may be alone in
knowing about — a frond behind `fronds:` may have no sources here at all. A `visited` trail
travels so two processes declaring each other cannot ask each other forever, and being ASKED
still walks locally: the trail stops a re-ask, never the work. Pinned by
`defaults/tests/on-delete.test.ts` — three processes, and each carrying only its own frond.

**A run says somebody started** — `@fougere/workflow`, a frond STATED (`frond()`) and brought by
its extension. There is no plan and no position in it, because every hop is already idempotent:
resuming is doing it again. `Journal` is core's key, the package answers under it, and what
CARRIES a release writes none — the boot leaves out the entities of brought fronds, read from
what was brought rather than written down, like `CARRIES_LINE`. A refusal from the walk closes
the run (a decision redone is the same decision, and a run kept open for one is swept forever);
an interruption leaves it open, which is what a run is for. The row goes LAST, handed in by
whoever owns the gesture, so a run covers the whole thing. Pinned by `workflow/tests/release.test.ts`.

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

A link is CALLED, so it needs an address — local, or named in `fronds:`. A carrier has no
address, so a link can never live behind one, the same line `Ask` draws. It is a HARD
dependency where a subscriber is not — a subscriber that throws is
logged and the announcer goes on, a link that throws stops the announcement, and behind
`fronds:` that makes announcing depend on another process. Pinned by `tests/pipe.test.ts`
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
- **A comment names its doc page when one exists** —
  `Documented: [ports](https://fougere.dev/docs/business/ports).` on the last line of the
  block. A markdown link on the ABSOLUTE url, because that is the one an editor's hover can
  open: VS Code renders markdown in a JSDoc hover and a site-relative path resolves against
  nothing there. Never a file path — the route survives the file moving, the same reason a
  reference here is a path plus a SYMBOL and never a line number. Only where the page
  explains the concept, never as a second description of what the code already shows.
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

- **An op's `reach` does not see a fact, where the declared topology now does.** `servedBy`
  indexes a dep key to ONE frond and an announcement reaches every listener, so `reachOf`
  (`EffectiveOperationModel.ts`) counts a façade crossing and not an announced one — and with it
  `hops`, the sampling that always keeps an op with hops, and the k6 threshold `base + hops *
  perHop`. Measured 2026-09-14 on `demos/pipe-split`: `declaredTopologyOf` reports three edges out
  of `blog` and `fougere explain blog/default/Post.publish` answers `reach: { fronds: [], hops: 0 }`.
  Left as is on purpose — those three numbers are the operator's, and widening `servedBy` to
  `Map<string, string[]>` moves a sampling rate and a load threshold at once.
- **A `ref()` added to a table that already exists gets no foreign key, and the boot believes
  it has one.** The additive pass has no `addForeignKey` (`diff/Change.ts`), and `heldBy` reads
  what the source PROMISES, not what the live table holds, so it reads nothing either. Measured
  2026-09-14 on `site/.data/site.db`: the same dangling insert passes there and is refused on a
  fresh database. `onDelete` widens it rather than adding a second hole: `keyed` answers from
  what the source PROMISES, so the guard steps aside for a key the live table never got, and a
  cascade declared on an old table is carried out by nobody. A LIMIT and not a defect to chase:
  the pass is additive by design, a key cannot be added to a table holding rows that already
  break it, and `drift` is where it would be said — it reads nullability today and the engine's
  introspection carries no foreign key (`ColumnMetadata`, measured 2026-09-14). The fix is one
  statement by hand, or a fresh table.
- **A service reaching another frond's repository fails at the CALL, not at the boot** — a scope
  sees its parent and never its siblings, so `AuthorRepository` registered by the frond that
  owns the entity is unreachable from a neighbour. The refusal is right (a neighbour goes
  through the facade, not through the rows) and it is LATE: a collector in the wrong frond
  refuses the boot, this one answers `'AuthorRepository' is not registered` at the first call.
  Pinned as the behaviour it is by `defaults/tests/gradient.test.ts`, measured 2026-09-14.
- **A process carrying only its own frond cannot migrate a table whose key names an entity it
  has never seen** — `ref(User): no source hosts it`, measured 2026-09-14 while writing
  `defaults/tests/on-delete.test.ts`. `elsewhere` covers another SOURCE, not another process,
  and the bench migrates once from an app that carries every frond. What each process may
  migrate is a subject of its own.
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
- **`onQuery` is still a module-level list, and the path between its ends is the CONTEXT** —
  `adapter/sql/src/query.ts`. The producer is a Kysely built by `createSqliteSource()` BEFORE
  any app exists, and no object path runs to the consumer: an app holds `db`, never the
  source, and a Kysely's `log` is fixed at construction. What closes it is not a path but the
  stack — a sink runs SYNCHRONOUSLY inside the async context the tracer opened, so
  `statementsUnder` (`observability/src/index.ts`) reaches the operation in flight without
  anyone holding anything. The list stays module-level and that stays the open half: two apps
  in one process feed one list. `registerFlush` is the same shape read once instead of per
  line; it lives there because the host that calls `flushTelemetry()` holds a request handler,
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
- **`fronds:` names one address per frond**, so the same frond cannot be deployed twice. The
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
- **A computed field that reads still issues N queries — and it is now COUNTED.** The façade
  hands the presenter the PAGE (`dispatch/PresenterExecutor.ts`), so one query per page is
  possible, and `Promise.all(rows.map(...))` inside the field body is still not refused. What
  changed is that nothing has to notice by reading: `statementsOf` (`@fougere/testing`) is the
  number in a test, `FinishedSpan.statements` is the same number in production. Refusing it
  remains open — a page size is not a constant, so there is no threshold to hard-code.
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
