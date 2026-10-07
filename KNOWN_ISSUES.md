# Known issues

Fact — where — state. The reasoning lives in `fougere-notes/docs/notes/`.

- **A remote's listeners are read once.** `listenersOf` (`boot/remote.ts`) indexes the cards at
  the first `discover`, like the routes, so a subscriber added to a running remote is not seen
  until the announcer restarts. Stated 2026-10-02, the day cards began to carry `listens`.
- **A listener in a process `fronds:` gives no address is unreachable from a served frond.**
  The announcer calls a listener, and nothing calls a Nuxt app: `blog` behind `fougere serve`
  and `search` hosted by Nuxt reach each other in no direction. Measured 2026-10-01 on a
  scratch `shop`. Placing `search` at an address, or `blog` back in the Nuxt process, is the
  answer; a carrier is the other.
- **A remote that never answered is a hole only `Emit<T, A>` refuses.** Asked at the first
  announcement and unreachable, its listeners are unknown: `Emit<T>` warns that the fact did not
  reach it and goes on, `Emit<T, A>` refuses the announcement (`listenersElsewhere`,
  `boot/Emissions.ts`). Once reached, a remote that stops is a subscriber that fails — `ERR …
  unreachable`, the announcement goes on. Nothing is queued in either case: that is a carrier's.
- **A `Pipe<T>` link in a frond the announcer did not read is not found.** The card states the
  `Fact<T>` an op listens to and never a link (`facadeOps`, `boot/card.ts`): a link is ordered by
  the fact's owner and stops the announcement when it throws, which a card read late cannot
  promise.
- **The declared topology and an op's `reach` count the listeners read from CODE, never those
  read off a card** — `declaredTopologyOf` (`boot/declared.ts`) and `reachOf`. A served frond
  reaching `mail` through its card draws no edge to it.
- **A log line never crosses** — `listenersElsewhere` leaves `logLine` out, since delivering it
  is a call and a call writes lines. A destination in another process receives that process's
  lines only.

- **An op's `reach` does not see a fact, where the declared topology now does.** `servedBy`
  indexes a dep key to ONE frond and an announcement reaches every listener, so `reachOf`
  (`EffectiveOperationModel.ts`) counts a façade crossing and not an announced one — and with it
  `hops`, the sampling that always keeps an op with hops, and the k6 threshold `base + hops *
  perHop`. Measured 2026-09-14 on `demos/pipe-split`: `declaredTopologyOf` reports three edges out
  of `blog` and `fougere explain blog/default/Post.publish` answers `reach: { fronds: [], hops: 0 }`.
  Left as is on purpose — those three numbers are the operator's, and widening `servedBy` to
  `Map<string, string[]>` moves a sampling rate and a load threshold at once.
- **A card does not carry `reach`, so a chain stops at the first neighbour.** `CardOp`
  (`core/src/wire/card/CardOp.ts`) publishes everything an op states about itself — `input`,
  `output`, `kind`, `cardinality`, `errors` — except where its own work goes. And `reachOf`
  (`EffectiveOperationModel.ts`) reads `handler.deps` against the fronds THIS process places
  remotely, so `hops` is a WIDTH, how many remote fronds one handler calls, never a depth.
  Measured 2026-09-17. While a repository is one process nothing notices: what is local to a
  neighbour is already paid in its latency, and the caller measures that. The day a neighbour
  splits, every caller under-counts in silence and `base + hops * perHop` keeps naming the
  figure that was true before it. Depth is a LOCAL fact and it composes — a process answers for
  what it knows and the caller adds — which is the shape `holds` and `release` already have,
  `visited` trail included, since two fronds naming each other need one.
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
  statement by hand, or a fresh table. `fougere migrate` does not add it either.
- **A frame opens an owned entity to anyone** — `refuseStorageReached` (`boot/ownership.ts`) reads
  `<E>Storage` keys only (`entityOfStorageKey`), and a frame's key is `<E>Together`
  (`togetherKeyOf`, `storage/Storage.ts`). Measured 2026-10-01 beside `Repository(Account, Ledger)`:
  a handler asking `LedgerStorage` is refused `aggregate-storage-reached`, the same handler asking
  `Together<[Ledger]>` boots and writes the ledger alone. The aggregate guards one of its two doors.
- **A process carrying only its own frond cannot MIGRATE a table whose key names an entity it
  has never seen** — `ref(User): no source hosts it`, measured 2026-09-14 while writing
  `defaults/tests/on-delete.test.ts`. It can CHECK it: `pending` reads names and leaves `elsewhere`
  out. `fougere migrate` boots the whole project, so it carries every frond and writes the key.
- **Scanning a directory that sits under `packages/` fails** — `LogLine_base is not defined`,
  measured 2026-09-10 on `packages/log/fronds/`. The same file scanned from outside the
  workspace loads. `findWorkspaceRoot` (`compiler/src/scan/scanner.ts`) seeds a type program
  from the monorepo root, and the entity is then evaluated from an emit whose hoisted
  `const <Class>_base` is lost. `@fougere/log` states its frond rather than being scanned,
  which is the right form for a published package anyway — so this is a trap for a frond
  inside a workspace package, not a blocker.
- **A `Logger` wrapper loses what it does not override, in silence** — `builtin/Logger.ts`. A
  wrapper extends `Logger` and asks for `inner`, but its own base is built by `super()` with
  nothing: no carry, no `during`, the default name. Every method it does not override runs on that
  empty base — `debug` prints and reaches no destination, `child()` hands back a bare logger that
  skips the wrapper's own code (`RedactingLogger.child('x').info('token=abc')` is not masked).
  Measured 2026-10-01. Two halves, closed separately: a REQUIRED first constructor argument makes
  `super(inner)` the only form that compiles and the base shares the real logger's state, so
  nothing is lost; a single `write(line)` every level and every child funnels through is what makes
  nothing BYPASS the wrapper. `OwnLoggers` already avoids `child()` on a replaced logger.
- **`conventions:` restates the directory NAMES and the import scope, nothing else** —
  `Conventions` (`core/src/Conventions.ts`). What a file is recognized BY stays fixed: a
  middleware states `around`, an extension `up`/`down`/`state`, and an address is the class
  name less `Handler` (`addressOf`, `wire/Facade.ts`). The README says the conventions can be
  overridden, which holds for where code lives and not for how it is read. Stated 2026-10-04.
- **Three implicit rules pass the boot in silence when they are broken** — read in the code
  2026-10-01, each checkable at boot since the declaration is read there. (1) A file in a convention
  directory that is not of its FORM is dropped: `collect` (`compiler/src/scan/scanner.ts`) filters
  every `null` a reader answers, so a class in `middlewares/` without `around` is simply not one,
  and nothing says so. (2) A class in `handlers/` without the `Handler` suffix answers at its whole
  name (`addressOf`, `wire/Facade.ts`): `Posts` answers `posts`, where `PostHandler` answers `post`.
  (3) A handler accepting `Fact<T>` for a fact nothing announces is a subscription to nothing — no
  code names it; `drift.ts` only reads a fact gone between two CARDS.
- **The level decides what is COLLECTED, not only what is printed** — `Logger.log`
  (`builtin/Logger.ts`) returns on the threshold BEFORE `carry.push`, so a line under it reaches no
  destination either. The CLI sets `FOUGERE_LOG_LEVEL=warn` (`cli/src/main.ts`) to keep its output
  readable, and `applyConfig` lets the environment win over `logLevel:`: under `fougere call`, an
  audit destination loses every `info` a service writes. What a destination receives then depends
  on the command that started the process. Measured 2026-10-01. The fix is one line: push to the
  carry first and test the threshold only before `console[method]`.
- **A type alias of a port does not bind** — `type Log = Emit<LogLine>` then
  `constructor(private log: Log)` resolves to the key `Log`, and the boot refuses
  `'Log' is not registered`. The checker keeps the OUTER alias symbol and drops
  `<LogLine>`, so `depKeyOf` never sees the port. Recovering it means reading the alias's
  own declaration in `handler-parser.ts` (`parseCheckedType`). Measured 2026-09-10; the
  alias was removed rather than shipped broken.
- **`onQuery` is still a module-level list, and the path between its ends is the CONTEXT** —
  `adapter/sql/src/query/QuerySink.ts`. The producer is a Kysely built by `createSqliteSource()` BEFORE
  any app exists, and no object path runs to the consumer: an app holds `db`, never the
  source, and a Kysely's `log` is fixed at construction. What closes it is not a path but the
  stack — a sink runs SYNCHRONOUSLY inside the async context the tracer opened, so
  `statementsUnder` (`observability/src/index.ts`) reaches the operation in flight without
  anyone holding anything. The list stays module-level and that stays the open half: two apps
  in one process feed one list. `registerFlush` is the same shape read once instead of per
  line; it lives there because the host that calls `flushTelemetry()` holds a request handler,
  not an app (`demos/cloudflare-d1`, `ctx.waitUntil`).
- **A card states `role` in a form of its own, and nothing judges it** — `schema/src/axis/role/Role.ts`,
  `roleAxis.reconstruct`. `role` is the one axis whose wire differs from its declaration: `relation.to` is a
  function here and a name there, `unique` a boolean here and a list of groups there — so `ROLE_FORMAT`
  cannot serve both, where `lifecycle` and `boundary` are judged by the format they already
  state. Measured 2026-09-17 through `Card.fromDescriptor(…).toSchema()`: `unique: 'x'` throws
  `wire.unique?.some is not a function`, `primary: 'yes'` is read as `true`, `relation: { to: 3 }`
  passes, and a key nothing reads is dropped. What closes it is a format beside `RoleDescriptor`,
  read before the rebuild — everything the rebuild produces is refused by `new Field(…, key)` already.

- **A `many()` cannot be written from its own side, and the pair is not offered either.** The
  key sits on the far row — `tags.post_id`, never a column of `posts` — so
  `post.create({ tags: [...] })` has nowhere to land. It is refused now rather than dropped:
  `InputValidator` answers `Read-only` on the client door and `StorageGuard` the same for a
  handler, where the value used to reach SQLite as `no column named tags`. What a caller
  would want is to hand the tags over and have the write place the key on the other side —
  a write across two tables, which no gesture of `Storage` names. Measured 2026-09-20.
- **An un-augmented `adapters:` accepts anything, silently.** With no adapter in the program
  `EntityAdapters<TFields>` is `Partial<{}>`, which in TypeScript means "anything
  non-nullish". The RUNTIME half is closed since the adapter's format; what remains open is the type.
- **An outgoing call's line names the frond it goes to, and the address rather than the class.**
  `callLines` reads the `OperationContext` the remote facade builds (`boot/remote.ts`), which holds
  the TARGET frond and no `handler`, so the caller writes `[app:catalog] (shop:CartHandler.checkout)
  product.list` where the receiver writes `[app:catalog] ProductHandler.list`. Measured 2026-09-29
  on `demos/observability`. Left as is: the line is true, only its form differs.
- **Seeds are ordered within a process, never across two** — `orderSeeds` (`core/src/boot/seed.ts`)
  plants a `ref()` target before its referrer among the seeds THIS process hosts. A seed runs where
  its rows live (`app.storageFor`, absent elsewhere), so a referrer whose target is seeded by
  another process may be planted first, and the guard then refuses it. Stated 2026-09-23, not
  measured: nothing in the tree seeds across processes yet.
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
- **`storage.client` remains the anonymous multi-statement path, validator off** — everything else
  writes through a guarded port, `Together<[…]>` included.
- **A provider class named `<Entity>Storage` is DISCARDED, not honoured** — the entry used to
  say the opposite. `bootstrap.ts` registers providers before storages and `registerValue` is a
  plain `registry.set`, so the entity's storage overwrites the provider. `refuseStorageInUserCode`
  does not cover it: it reads `decl.deps`, never `decl.ctor.name`. Measured 2026-09-09. The name
  is already wrong by two rules, which is why nothing hits it; left as is.
- **`Mirror` holds a loop and a page contract, and nothing else** (`core/src/prefab/MirrorConstructor.ts`).
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
- **A hop is drawn as CLIENT and SERVER only when the receiver says it crossed** —
  `observability/src/otlp/OtlpExporter.ts`, `kindOf`. The sender knows it (`OperationContext.crosses`,
  set by `boot/remote.ts`), the receiver only through `invocation.crossed`, which
  `transport/http/src/server.ts` writes. A receiver written by hand — the bare socket of
  `observability/tests/trace.test.ts` — writes nothing, so its span stays `INTERNAL`. Measured
  2026-09-23.
- **Replicas booting together plant the same seeds** — `runSeeds` (`core/src/boot/seed.ts`) asks
  `list()` and inserts when it is empty, with no lock, and every process runs `seeding()` in its own
  ascent. Measured 2026-09-17, 4 Bun replicas on one Postgres 17: 10 or 15 rows instead of 5 in 3
  runs of 8; with `unique()` no duplicate, but a replica REFUSES its boot
  (`Seed 'note' failed … A row with these values already exists`).
- **A field whose type changes cannot be migrated, even when no row is at risk** — `Plan.ts`
  (`adapter/sql/src/step/`), the `retyped` case, refuses with `no conversion is derivable, write
  the migration`, and there is nowhere to write it: the ALTER is run by hand against the engine.
  Two cases share the refusal. A WIDENING (`integer` → `number`) leaves every stored row valid,
  so it is derivable and is still refused. A change of NATURE
  (`text` → `number`) is a decision about rows already stored — what `'abc'` becomes — and
  belongs to whoever owns the data, beside the frozen version that needs it. Stated 2026-10-04.
- **`fougere migrate` run twice at once races itself** — the boot no longer migrates, so replicas
  do not race it; two release steps started together still would (`ADD COLUMN` has no guard,
  `delta`, `diff/Change.ts`). One migration per deployment is the operator's line.
- **`fougere new` depends on the network and on each host tool's pinned major** — the shell is
  `npx`'d at scaffold time. A tool that changes what it writes inside its major (a config file
  renamed, a flag dropped) breaks `fougere new` for everyone until `scaffold.json` follows; `door:check`
  is where it is seen. Moving a major is a deliberate edit of that file.
- **`unique()` builds two unique indexes on a fresh table** — `createTableSQL` writes the column
  constraint (`<table>_<column>_key`) and `delta` adds `<table>_<column>_idx` through `indexSQL`
  for the same column, so every write on it is checked twice. Measured on Postgres 17, 2026-09-17.
- **Under Bun, a schema refused while a handler module loads surfaces as a TDZ error** —
  `toHandlerEntry` (`compiler/src/scan/scanner.ts`) spreads the module (`{ ...mod }`), and Bun
  throws `Cannot access 'CheckInput' before initialization` on the class whose `entity({…})` threw.
  Node shows the real `SchemaError` (here `Every field states a shape — got {"anyOf":…}`).
  Measured 2026-09-17.

## Settled

One line each, kept because a past version of this file asserted the opposite.

- **A dependency nothing answers refuses the BOOT, not the first call** — the boot reads what each
  class DECLARES against `has()` in the scope of its frond, after the ascent since `up` registers
  too (`boot/unregistered.ts`, `dependency-unregistered`). A seam is answered by its link and a
  facade another process serves by its stand-in, so neither refuses. The rule is the boot's: the
  container answers `has()` and knows no policy. Pinned by `core/tests/unregistered.test.ts`. A neighbour's `AuthorRepository` used to
  answer `'AuthorRepository' is not registered` at the first call; the check found a seam link
  registered under its own name, which nothing could ever resolve, and it no longer is.
- **A Nuxt server build keeps what a `@fougere/*` package runs at load** — Nitro reads every module
  as free of side effects but its own, so `import '@fougere/adapter-sql/sqlite'` was dropped and a
  built site answered `Unknown source 'sql' … answers memory`. `@fougere/nuxt` widens Nitro's rule
  by the package NAME (`FougerePackage.ts`), since a workspace link has no `@fougere/` in its path.
  Pinned by `app/nuxt/tests/FougerePackage.test.ts`, measured 2026-09-25.
- **Core does not depend on the compiler, not even for its tests** — a core test states its fronds
  with `frond()` (`tests/fixtures-*/fronds.ts`, contracts written through `tests/contract.ts`), and
  what the scan DEDUCES is tested in `packages/compiler/tests/`. Core's devDependency on the
  compiler was the one edge closing a cycle, and pnpm 12 refuses a build over it
  (`ERR_PNPM_TASK_CYCLE`, 2026-09-24).

- **No `db:` means memory, on every host, said as a warning** — `resolveStorage`
  (`defaults/src/storage/ResolvedStorage.ts`) is the one place that falls back. Nuxt used to impose
  SQLite, the web hosts fell back to memory at `debug`, and `fougere serve` had no storage at all.
  A `warn` and not an `info`: the CLI runs at `warn`, and losing rows at exit is what an operator must see.

- **An error names itself with a LITERAL, not `new.target.name`** — `SchemaError`,
  `ContainerError`, `FougereError`. A bundler mangles a class name: measured 2026-09-18 in
  `site/.output`, `SchemaError` ships as `class e extends Error`, so every refusal the browser
  raised was named `e`. The same mangling already bit an entity — `Product` became `f` and the
  call left as `f.list` (`app/nuxt/src/module.ts`). A subclass would now report the base's name,
  and there is none in the tree.

- **`Emit<T>` is PARTIAL, because announcing realizes the fact's `lifecycle.create`** — a
  `created()` stamped by `Emissions`, which asking the announcer for made every emitter cast
  past its own type. A missing field is still refused, by the judge that reads the fact.
  Pinned by `core/tests/emit.test.ts`, through the typed emitter.

- **A refusal says WHERE, all the way down** — `ValidationError.path` is SEGMENTS
  (`['addr', 'street']`), and `JsonSchemaValidator` keeps the engine's `instanceLocation` and its
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
  (`defaults/src/storage/ResolvedStorage.ts`), the dual of `transacted`. Reading the default source's capacity
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
- A registry that cannot say what it holds is not the owner: `Generators` registers `cuid2`
  like any other name rather than switching on it, which is what let `uuid` leave without a
  branch to remove.
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
