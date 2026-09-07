# @fougere/core

## 0.8.0-alpha.0

### Minor Changes

- 34fbd31: A criterion can compare. `where` knew equality and membership, while nearly everything
  worth filtering on is a range — land over 1 500, price under 400 000, built after 1900 —
  and the only way out was `storage.client`, the path with no judge and no codecs.

  `gte`, `lte`, `gt`, `lt`, `ne`, `between`, `contains`, `notIn` and `isNull`. `eq` and `in`
  are deliberately absent: a bare value already means equality and an array already means
  membership, and a second spelling would make one criterion sayable two ways.

  A comparison is told from a value that IS an object by the FIELD, never by the criterion:
  `json()` admits any shape, so reading the criterion would make a stored object
  unfilterable the day its keys happened to spell an operator. Both realizations compile it
  — SQL and the store the memory and file adapters derive from — and a misspelled comparison
  is refused rather than dropped.

- ae49d25: A migration says what it declined to change. The pass is additive by design — it creates
  what is missing and never touches a column that exists — which is a promise worth keeping
  and a silence worth breaking: relax a `required` field and the table keeps its NOT NULL,
  so the write fails on a row, in production, long after the boot that could have named it.
  Measured twice on a real app, once as `CHECK constraint failed` and once as `NOT NULL
constraint failed`, both with a green boot.

  `Source.migrate` may now answer with what it found, and the boot voices it — the shape
  `seeding(report)` already had. `SchemaState` stays a set of names on purpose: `done()`
  reads it to decide whether a frozen step was applied, and a wider one would make a
  replayed migration answer wrong.

### Patch Changes

- 6ec8e59: A provider's container key is written down. It was read at boot off `ctor.name`, which
  held until a bundler lowered a `static readonly` field and renamed the declaration doing
  it: the provider registered as `_Communes` and every handler asking for `Communes` met a
  container miss. The scan reads the name from source, both emitters write it, and
  `ctor.name` answers only where nobody wrote it down.

  Measured on a real app: five operations depending on renamed providers answer with no
  bundler setting at all.

- 2478927: A statement carries the operations the scan read. `frond()` posted an empty Map, so a
  host booting from a written statement — which is what `@fougere/nuxt` hands its runtime —
  served a prefab's five CRUD ops and nothing an author had written. The scan reads a
  method's contract from source and a class carries none of it at runtime, so the statement
  is where it has to survive; `emitStatement` now writes it, beside the `deps` it already
  wrote for the same reason.

  A prefab's own `__ops` still answer, and a method written over one wins.

- 525b53e: An operation contract is written down in one place. `emitScan` held the serializer for
  contracts and schema references; `emitStatement`, which the Nuxt module writes from, held
  none and carried no operations at all. The half they can share now lives beside them,
  asking of each emitter's imports only what it needs: an alias for a value already
  imported, a named import, and the entity a class name belongs to.

  No output changes — a real scan renders byte for byte what it did before.

- 089ebb9: A statement carries what `frond.config.ts` states. The file is read BY the scan, so a
  host booting from a written statement never saw it — and it is the only answer for the
  kind of an operation whose name leads with no known verb, and for a method inherited from
  an installed base class. Renaming a method to please the scan was the workaround; the
  right word can stay now.
- f9b5837: The door check asks for an operation someone wrote. It asked `post.list` — a prefab op,
  whose contract is a static that survives any build — and called the door fine while every
  hand-written operation of a fresh project went unserved. `post.listPublished` is read
  from source at scan time and carried by nothing at runtime, so it answers only when the
  statement the host boots from carried it across.
- 6d9034d: Three small ones, each a silence.

  A relative `db.path` is counted from the config that named it, not from whoever is
  running. `apps/nuxt` runs from its own directory and made a SECOND, empty database beside
  itself while the workspace held the real one — nothing said, every table created, the
  seeds run, an empty domain served with a green boot. `resolveStorage` takes a root;
  `:memory:` and absolute paths pass through untouched, and the one case where the two
  disagree is named rather than acted on silently.

  A fresh project pins the version that scaffolded it. `latest` reads as "whatever is
  current" and is not: pnpm answers from a metadata cache, and a fresh project installed
  0.6 while the registry said 0.7.

  And a convention directory that refuses a file says where it belongs — measured twice on
  one project, both times a shared contract that had to move and nothing to say where.

- c5f5791: A web host applies the config it read. `applyConfig` had one caller, `boot()`, and the
  front-end hosts reach `createApp` directly — so `logLevel:` was read and never acted on.
  Its default now keeps the level the process already has, instead of raising every caller
  to `debug`; and the Nuxt module says so when Nitro's console would drop that level.
- 4287ac9: A filter is judged the way a write is. `where` was the one entrance to the read port with
  no judge at all — a field the entity does not declare passed, and so did a value the field
  would refuse on the way in — while the admin door copies a browser's filter into it
  verbatim. A criterion may still name a set, which is the one thing the write door refuses:
  an array is judged member by member, since that is what `IN` binds.

  And a filter on a field the door does not hand back is SAID, not refused: `output(schema)`
  narrows what is returned and has never narrowed what is asked, so refusing it today would
  break a GraphQL relation batch on the way to closing a hole. Measured across the
  repository: zero warnings, which is what a refusal will need before it can be one.

## 0.7.0-alpha.0

### Minor Changes

- `fougere check` reports an adapter name no dependency answers to.

  A process only knows the adapters it loaded, so an entity stating a Postgres column type
  in an app running on `adapter/memory` cannot be told from a typo. The project can: its
  dependencies name every adapter it could load. `adaptersOf` reads them, the finding is
  `unknown-adapter`, and four real demos report zero.

### Patch Changes

- A realization may narrow the port, and the container key does not move.

  `depKeyOf` compared the type name to `Storage` exactly, so a handler asking for
  `RankedStorage<Card>` asked the container for `RankedStorage` and the boot refused. The
  subject is in the GENERIC. A class named `FileStorage` carries none and is untouched.

- 7376ae7: A composite unique constraint belongs to the schema it constrains, not to each of its
  members.

  `FieldGroup` and `Unique` are gone from the public surface. A field carries
  `role.unique` as a boolean, read through `Role.of(field).isUnique`; a group spanning
  several fields lives once in `SchemaConstraints`, answered by `getUnique()` as before.
  The wire format is unchanged in both directions, pinned byte for byte by the v1 fixtures.

  With the sentinel gone — `unique()` no longer writes an empty group waiting to learn its
  key — `FieldGroup.isSelf`, `resolvedOn`, `Role.resolvedOn` and `Field.rename` had nothing
  left to do.

- Six guarantees the code declared and did not hold.

  `output(schema)` filtered nothing on the memory frame — `storageOver` now applies the
  scope SQL puts in its SELECT, on both realizations. A composition read the DEFAULT
  source's transaction for every source; `transacts(source)` answers for the one the work
  runs in, so a frame whose own engine has transactions is no longer compensated. A refused
  ascent released nothing the boot had taken: `onDispose` is handed over before the ascent,
  since the caller never receives the app that would carry it back. `StorageGuard` skipped
  `upsert` and `upsertAll` and handed on the value it had not parsed. A migrated table
  promised less than a fresh one — `changeSQL` states `notNull()` whether or not a default
  fills the column, and `delta` proposes the UNIQUE index a live table never read. And the
  data layer travels as ONE subject, `FougereServerConfig.storage`, which naming a few of
  its members had left `transacted` and `close` behind, under Nuxt only.

- The unwind's check reported a detection it cannot make.

  It catches a write that landed before the re-read; one that lands after is overwritten
  unseen, because reading and restoring are two statements and a frame exists precisely
  where no engine can make them one.

- Updated dependencies
- Updated dependencies
- Updated dependencies [7376ae7]
- Updated dependencies
- Updated dependencies [47513d2]
  - @fougere/schema@0.6.0-alpha.1

## 0.6.0-alpha.0

### Minor Changes

- 8f390d0: A place rows live is a `Source`, and what realizes it is named in the config.

  **Four gestures, and the absence answers.** A `Source` states `storageFactory` (required),
  `migrate?`, `transacted?` and `close?`. What it is MADE OF is not there: `adapter/sql` keeps
  `dialect`, `db` and `sink` on its own `SqlSource`, reached by narrowing — the rule
  `Storage.client` already obeyed one level down. A source that hands out no transaction makes a
  `Together<[…]>` compensate instead of transacting, and the boot says which of the two it built,
  per frame.

  **The migration is the source's own gesture.** The router hands each source what lives there
  plus the names of what does not; a source knows its own engine. This fixes a real defect: every
  source was migrated as `'sqlite'`, the documented Postgres case included, because the router
  passed no dialect.

  **`source:` names the adapter.** `dialect` stays SQL's property, read by the only package that
  knows what it is worth — the shape `adapters:` already has on an entity. An adapter answers a
  name by registering at import, so nothing central lists them, and a name nothing answers is
  refused saying what this process does answer. The refusal "only `sqlite` resolves from a name"
  moved to `@fougere/adapter-sql`, where the reason is true.

  **Thirteen gestures from four.** `storageOver` derives the whole storage port from a `Rows`
  (`get`/`has`/`set`/`delete`/`all`/`client`). Measured on the Map realization: 14 lines of 140
  touched the store; the rest — pages, criteria, lifecycle stamps, the two refusals a `create`
  owes its caller — is the same wherever rows live. Writing a source is now four gestures, not
  thirteen.

  **Two new adapters.** `@fougere/adapter-memory` (rows in a Map, 37 lines, and the fallback an
  app with no `db` already ran on) and `@fougere/adapter-file` (one JSON per row, a directory per
  entity, `migrate` being a `mkdir`). They replace three divergent hand-written copies in the
  demos, each of which answered six of the thirteen gestures, forced the field name `id` and
  minted a uuid whatever the entity declared.

  **Renamed.** The cross-source reader a handler injects is `Reads`, not `Sources` — it is
  declared by `reads:` and reads over sources rather than being them. `ResolvedStorage.raw` and
  `.dialect` are gone: zero and one reader respectively.

- 5076973: One frond, five hosts — and the declarations that did not keep their promise are gone.

  **Five hosts, one frond, byte-identical.** The half of a Nuxt app that was never Nuxt now
  lives in `@fougere/app`, and each UI framework gets its own package: `@fougere/react`,
  `@fougere/svelte`, `@fougere/next`, plus `@fougere/vite` — one plugin serving three hosts.
  Express joins as an adapter, being the one host that is not Web-standard. The same frond
  runs under all of them without a line changed.

  **Breaking**

  - `@fougere/container-fougere` is gone. Its implementation moved into `@fougere/container`,
    which now exports `createContainer` alongside the `Container` type. The port never had a
    second adapter, and the scan knows the graph before boot, so what was left to bind late is
    a Map, a scope and a resolver of last resort. Update the import and drop the dependency.
  - `auto()` is now `created()`. Its dual `updated()` is literally built on it and names its
    moment; this one said "the server fills it" without saying when. Every template already
    spelled it `createdAt: auto()`.
  - `validateFields(fields, input, opts)` — the `pathPrefix` parameter is removed, so `opts`
    moves from the fourth position to the third. Every caller passed `''`: it was a parameter
    for a recursion nobody wrote, and it made the code read as if nested paths were handled.
  - A named boundary codec that no one registered now **throws** instead of converting as
    identity. A frond declaring `{ decode: 'celsius' }` against a consumer that never called
    `registerDecoder` used to receive the value unconverted while the card said otherwise. One
    axis, two spellings, one failure mode — the alias form already threw.
  - `OperationOverride.policy` is removed from `frond.config.ts`'s type. It had no reader at
    all, so setting it did nothing, silently.
  - `graphql` and `@pothos/core` are optional peers of `@fougere/app` rather than dependencies:
    an app that serves no GraphQL no longer installs them.
  - An adapter is published by the app, not mounted by the host.
  - Express surfaces are middlewares, because that is what an Express app speaks.

  **Fixed**

  - `@fougere/nuxt` declares the `h3` its runtime has always imported — seven imports across six
    server files, resolvable from nothing but Nitro's build.
  - `@fronds/<name>` resolves in the scan: two entry points were loading a neighbour's sources
    without the alias map.
  - A `list` op reaches GraphQL with its pagination arguments, and `required` no longer demands
    what the door refuses.
  - `count` applies its own filter; the identity card reports an operation's overridden kind.
  - `presenterFor` is the dual `facadeFor` already had.
  - An operation's doc sentence now reaches both REST and GraphQL, instead of being dropped in
    each adapter's narrowed view of the same contract.
  - `dispose()` disposes: it used to clear the registry while its own doc promised to release
    the singletons it held, and `await using app` routed straight to it. Failures are collected
    rather than swallowed at the first one.

  **Also**

  Keywords so an adapter is found by the library it adapts; one id generator instead of two
  majors of it; and a mechanical floor in CI — oxlint, knip and v8 coverage, recorded rather
  than gated.

- cf5b52e: Apply decoded inputs and declared outputs at the facade boundary, harden public transports,
  correct HTTP and GraphQL semantics, and make scaffolds and published artifacts reproducible.
- 6f08e19: An entity's rows live where the app says, and reading across those places is one query.

  **Several sources.** `sources:` names the places that are not the default one, and the
  entities that live there. An app with one database declares nothing and behaves exactly as
  before. A source may also be an engine the caller built, so a pool Fougere did not open is
  still a place rows can live.

  **Reading across them.** `@fougere/adapter-duckdb` is new: a frond that declares `reads:`
  receives a cross-source reader, and one SQL query spans what can be attached. Measured
  before it was written — attaching Postgres pushes the filter down over 100 000 rows, so a
  real database is queried where it is and never copied. It is not a query builder and never
  sits on the ordinary read path: at page size it is ~100× slower than two indexed reads.

  **Reading a set, not a row at a time.** `findByKeys` answers a Map, and its dual answers
  the rows that point at each key — both directions of a relation, each in one query. A
  GraphQL relation is now read once per page instead of once per row.

  **Writing a page.** `upsert` and `upsertAll` write the row or make the existing one look
  like this, in one statement. `Mirror(Shape)` builds on both: a local copy of rows that live
  somewhere this app cannot query, where the subclass supplies only the pull. A shape with no
  `updated()` field is refused at the declaration — a copy that cannot say when it was pulled
  reads exactly like live rows.

  **Breaking**

  - `shapeTypeOf` is no longer exported from `@fougere/schema`. It is internal machinery
    above the judge; `entitySourceOf` is what a consumer calls.
  - A field declaration is judged on all five axes rather than the shape alone, so a
    malformed `lifecycle`, `role` or `boundary` is refused at `entity()` instead of at the
    first call that trips over it. Declarations that were already correct are unaffected.
  - A named `format` predicate that no one registered is refused by name.

- 934d74d: Go to definition lands on the code, not on a `.d.ts`.

  Every package compiles with `declarationMap`, so each `.d.ts` shipped a map pointing at
  `../../src/…` — and `"files": ["dist"]` left that target behind. The map resolved to
  nothing, in every editor, for every consumer. `src` is published now.

  Measured on `@fougere/core`: 233 → 334 kB packed, 854 kB → 1.3 MB unpacked. That is still
  below `kysely` (1.7 MB), which the same install pulls in anyway. What it buys is that a
  reader who follows a symbol arrives in the commented source rather than in a stripped
  signature — and in this codebase the comments carry the reasoning.

### Patch Changes

- b1e1133: An edge bundle no longer drags `node:path` in through `frond()`.

  `frond()` sits in `index` so an app can state what it hosts without a scanner, and it
  reached `conventions.ts`, whose one `join` put `node:path` in front of esbuild — which
  refused the Worker by name. `watchPathsOf` turns convention names into disk paths, so it
  now sits beside the scan that reads them.

- 8f21270: Nothing downloads or compiles when you install.

  `better-sqlite3` moves to 13, which carries its prebuilt binaries inside the tarball
  (`prebuilds/darwin-arm64.node`, `linux-x64`, `linuxmusl`, `win32-arm64`, …). Version 12
  fetched one at install time through `prebuild-install`, a package that is no longer
  maintained and that printed a deprecation warning on every `create fougere`.

  Measured on a bare install: no deprecation line, no `build/` directory, no `node-gyp`, no
  Python, 9.6 s — and it works offline, which the download never did.

  The scaffold templates move with it, since that is where a new app met the warning.

- Updated dependencies [5076973]
- Updated dependencies [cf5b52e]
- Updated dependencies [8f21270]
- Updated dependencies [6f08e19]
- Updated dependencies [934d74d]
  - @fougere/container@0.5.0
  - @fougere/schema@0.5.0

## 0.5.0-alpha.1

### Minor Changes

- 934d74d: Go to definition lands on the code, not on a `.d.ts`.

  Every package compiles with `declarationMap`, so each `.d.ts` shipped a map pointing at
  `../../src/…` — and `"files": ["dist"]` left that target behind. The map resolved to
  nothing, in every editor, for every consumer. `src` is published now.

  Measured on `@fougere/core`: 233 → 334 kB packed, 854 kB → 1.3 MB unpacked. That is still
  below `kysely` (1.7 MB), which the same install pulls in anyway. What it buys is that a
  reader who follows a symbol arrives in the commented source rather than in a stripped
  signature — and in this codebase the comments carry the reasoning.

### Patch Changes

- An edge bundle no longer drags `node:path` in through `frond()`.

  `frond()` sits in `index` so an app can state what it hosts without a scanner, and it
  reached `conventions.ts`, whose one `join` put `node:path` in front of esbuild — which
  refused the Worker by name. `watchPathsOf` turns convention names into disk paths, so it
  now sits beside the scan that reads them.

- Updated dependencies [934d74d]
  - @fougere/container@0.5.0-alpha.1
  - @fougere/schema@0.5.0-alpha.1

## 0.2.0-alpha.2

### Minor Changes

- 6f08e19: An entity's rows live where the app says, and reading across those places is one query.

  **Several sources.** `sources:` names the places that are not the default one, and the
  entities that live there. An app with one database declares nothing and behaves exactly as
  before. A source may also be an engine the caller built, so a pool Fougere did not open is
  still a place rows can live.

  **Reading across them.** `@fougere/adapter-duckdb` is new: a frond that declares `reads:`
  receives a cross-source reader, and one SQL query spans what can be attached. Measured
  before it was written — attaching Postgres pushes the filter down over 100 000 rows, so a
  real database is queried where it is and never copied. It is not a query builder and never
  sits on the ordinary read path: at page size it is ~100× slower than two indexed reads.

  **Reading a set, not a row at a time.** `findByKeys` answers a Map, and its dual answers
  the rows that point at each key — both directions of a relation, each in one query. A
  GraphQL relation is now read once per page instead of once per row.

  **Writing a page.** `upsert` and `upsertAll` write the row or make the existing one look
  like this, in one statement. `Mirror(Shape)` builds on both: a local copy of rows that live
  somewhere this app cannot query, where the subclass supplies only the pull. A shape with no
  `updated()` field is refused at the declaration — a copy that cannot say when it was pulled
  reads exactly like live rows.

  **Breaking**

  - TypeScript generation belongs to `EntityTypeSource` and `FacadeTypeSource`; the shape
    renderer stays private to the entity source.
  - A field declaration is judged on all five axes rather than the shape alone, so a
    malformed `lifecycle`, `role` or `boundary` is refused at `entity()` instead of at the
    first call that trips over it. Declarations that were already correct are unaffected.
  - A named `format` predicate that no one registered is refused by name.

### Patch Changes

- Updated dependencies [6f08e19]
  - @fougere/container@0.2.0-alpha.2
  - @fougere/schema@0.2.0-alpha.2

## 0.2.0-alpha.1

### Patch Changes

- Nothing downloads or compiles when you install.

  `better-sqlite3` moves to 13, which carries its prebuilt binaries inside the tarball
  (`prebuilds/darwin-arm64.node`, `linux-x64`, `linuxmusl`, `win32-arm64`, …). Version 12
  fetched one at install time through `prebuild-install`, a package that is no longer
  maintained and that printed a deprecation warning on every `create fougere`.

  Measured on a bare install: no deprecation line, no `build/` directory, no `node-gyp`, no
  Python, 9.6 s — and it works offline, which the download never did.

  The scaffold templates move with it, since that is where a new app met the warning.

- Updated dependencies
  - @fougere/container@0.2.0-alpha.1
  - @fougere/schema@0.2.0-alpha.1

## 0.2.0-alpha.0

### Minor Changes

- 5076973: One frond, five hosts — and the declarations that did not keep their promise are gone.

  **Five hosts, one frond, byte-identical.** The half of a Nuxt app that was never Nuxt now
  lives in `@fougere/app`, and each UI framework gets its own package: `@fougere/react`,
  `@fougere/svelte`, `@fougere/next`, plus `@fougere/vite` — one plugin serving three hosts.
  Express joins as an adapter, being the one host that is not Web-standard. The same frond
  runs under all of them without a line changed.

  **Breaking**

  - `@fougere/container-fougere` is gone. Its implementation moved into `@fougere/container`,
    which now exports `createContainer` alongside the `Container` type. The port never had a
    second adapter, and the scan knows the graph before boot, so what was left to bind late is
    a Map, a scope and a resolver of last resort. Update the import and drop the dependency.
  - `auto()` is now `created()`. Its dual `updated()` is literally built on it and names its
    moment; this one said "the server fills it" without saying when. Every template already
    spelled it `createdAt: auto()`.
  - `validateFields(fields, input, opts)` — the `pathPrefix` parameter is removed, so `opts`
    moves from the fourth position to the third. Every caller passed `''`: it was a parameter
    for a recursion nobody wrote, and it made the code read as if nested paths were handled.
  - A named boundary codec that no one registered now **throws** instead of converting as
    identity. A frond declaring `{ decode: 'celsius' }` against a consumer that never called
    `registerDecoder` used to receive the value unconverted while the card said otherwise. One
    axis, two spellings, one failure mode — the alias form already threw.
  - `OperationOverride.policy` is removed from `frond.config.ts`'s type. It had no reader at
    all, so setting it did nothing, silently.
  - `graphql` and `@pothos/core` are optional peers of `@fougere/app` rather than dependencies:
    an app that serves no GraphQL no longer installs them.
  - An adapter is published by the app, not mounted by the host.
  - Express surfaces are middlewares, because that is what an Express app speaks.

  **Fixed**

  - `@fougere/nuxt` declares the `h3` its runtime has always imported — seven imports across six
    server files, resolvable from nothing but Nitro's build.
  - `@fronds/<name>` resolves in the scan: two entry points were loading a neighbour's sources
    without the alias map.
  - A `list` op reaches GraphQL with its pagination arguments, and `required` no longer demands
    what the door refuses.
  - `count` applies its own filter; the identity card reports an operation's overridden kind.
  - `presenterFor` is the dual `facadeFor` already had.
  - An operation's doc sentence now reaches both REST and GraphQL, instead of being dropped in
    each adapter's narrowed view of the same contract.
  - `dispose()` disposes: it used to clear the registry while its own doc promised to release
    the singletons it held, and `await using app` routed straight to it. Failures are collected
    rather than swallowed at the first one.

  **Also**

  Keywords so an adapter is found by the library it adapts; one id generator instead of two
  majors of it; and a mechanical floor in CI — oxlint, knip and v8 coverage, recorded rather
  than gated.

### Patch Changes

- Updated dependencies [5076973]
  - @fougere/container@0.2.0-alpha.0
  - @fougere/schema@0.2.0-alpha.0

## 0.1.0-alpha.0

### Minor Changes

- cf5b52e: Apply decoded inputs and declared outputs at the facade boundary, harden public transports,
  correct HTTP and GraphQL semantics, and make scaffolds and published artifacts reproducible.

### Patch Changes

- Updated dependencies [cf5b52e]
  - @fougere/container@0.1.0-alpha.0
  - @fougere/schema@0.1.0-alpha.0
