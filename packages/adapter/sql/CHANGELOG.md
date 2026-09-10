# @fougere/schema-sql

## 0.8.4-alpha.0

### Minor Changes

- df73bcb: A column carries the type its projections read, and `ColumnShape` is gone.

  `ColumnShape` was `Shape` restated weaker — `type?: string`, `format?: string` — and its
  only readers were the four `columnType` switches, each re-deriving what `Shapes.typeOf`
  answers. `ColumnDef.type` is a `ShapeType` now, posed once by `toTable`.

  `codecFor` takes that type rather than a shape, and its table is exhaustive: a type left
  out no longer compiles, where the old `switch` re-tested `format === 'date-time'` on its
  own. The four dialects keep their `switch` — a `default:` there decides ("everything else
  is text") rather than forgetting, and no engine tells a date apart from a string.

  The SQL emitted is unchanged: `date` and `choice` land in the same `default` branch that
  `string` landed in.

### Patch Changes

- 32923e6: An axis answers questions, and keeps no member to answer for it.

  `Role`, `Lifecycle` and `Boundary` no longer declare `implements RoleRules` /
  `LifecycleRules` / `BoundaryRules`, which was what forced their members public. Nothing
  was annotating a `Role` as a `RoleRules`, but `readOnly()` and `writeOnly()` were writing
  a JUDGE into `field.boundary` through the structural match: `Boundary.with` becomes
  `Boundary.declaring` and returns the declaration, the dual of `Boundary.declared`.

  Two questions a caller was asking by hand now exist. `Role.isRelation` answers either
  kind — `@fougere/cli` and `@fougere/testing` were reading `.relation` for it — and
  `Role.onDelete` completes `target`. `Lifecycle.stampedAtCreate` is what `Visibility.input`
  and `applyCreate` were spelling as `create === 'now'`; `stampedOnce` now derives from it.

  `Schema.fields`, `.adapters` and `.opts` are gone. They were a second spelling of
  `getFields()` / `getAdapters()` / `getOpts()` that `SchemaConstructor` never declared, so
  no consumer could reach them in TypeScript. `SchemaView` is the contract, unchanged.

  `Bundle.fromSchemas` was building a whole card per entry to read one title; `Card.titleOf`
  answers it, and a derivation still reports the name it was cut from.

- Updated dependencies [26f7987]
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [32923e6]
- Updated dependencies
- Updated dependencies
- Updated dependencies [771e703]
  - @fougere/schema@0.9.0-alpha.1
  - @fougere/core@0.9.0-alpha.1

## 0.8.3-alpha.0

### Patch Changes

- Updated dependencies
  - @fougere/core@0.8.3-alpha.0
  - @fougere/schema@0.8.3-alpha.0

## 0.8.2-alpha.0

### Patch Changes

- Updated dependencies [fb256c1, c1ad40c]
  - @fougere/core@0.8.2-alpha.0
  - @fougere/schema@0.8.2-alpha.0

## 0.8.1-alpha.0

### Patch Changes

- Updated dependencies [9d24851]
  - @fougere/core@0.8.1-alpha.0

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

- Updated dependencies [6ec8e59]
- Updated dependencies [2478927]
- Updated dependencies [525b53e]
- Updated dependencies [34fbd31]
- Updated dependencies [089ebb9]
- Updated dependencies [f9b5837]
- Updated dependencies [ae49d25]
- Updated dependencies [6d9034d]
- Updated dependencies [c5f5791]
- Updated dependencies [4287ac9]
  - @fougere/core@0.8.0-alpha.0

## 0.7.0-alpha.0

### Minor Changes

- An adapter states the format of its entry, as data.

  The level below a field name had no judge: `adapter/sql` read it with `?.` and degraded
  in silence on a typo. `adapter/sql/src/adapter.schema.json` is that format, imported with
  `with { type: 'json' }`, and `SqlField` is derived from it. `AdapterFieldValidator` takes
  a format and refuses what it does not admit, where the adapter READS — at `toTable`, not
  at `entity()`, which runs at its own module's evaluation. `EntityAdapterSet` owns the two
  levels an entry is addressed by, adapter name then field name, and always exists, so
  `getAdapters()` is never `undefined`.

### Patch Changes

- A descriptor is converted at the door, and a schema circulates.

  `SchemaOrCard` had the four adapters announce they took either form, and `toTable`
  rebuilt the schema twice for the one nobody passed them — `boot/remote.ts` already
  converted at discovery, through `Card.fromDescriptor(…).toSchema()`. The adapters read
  `SchemaView`, and the union is gone from `@fougere/schema` with the two functions that
  only existed to collapse it, `schemaOf` and `fieldsOf`. The `schemaOf` of
  `@fougere/adapter-graphql`, which builds a `GraphQLSchema` from an app, is a different
  function and is untouched.

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

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [7376ae7]
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [47513d2]
  - @fougere/schema@0.6.0-alpha.1
  - @fougere/core@0.6.0-alpha.1

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

- 8f21270: Nothing downloads or compiles when you install.

  `better-sqlite3` moves to 13, which carries its prebuilt binaries inside the tarball
  (`prebuilds/darwin-arm64.node`, `linux-x64`, `linuxmusl`, `win32-arm64`, …). Version 12
  fetched one at install time through `prebuild-install`, a package that is no longer
  maintained and that printed a deprecation warning on every `create fougere`.

  Measured on a bare install: no deprecation line, no `build/` directory, no `node-gyp`, no
  Python, 9.6 s — and it works offline, which the download never did.

  The scaffold templates move with it, since that is where a new app met the warning.

- Updated dependencies [8f390d0]
- Updated dependencies [b1e1133]
- Updated dependencies [5076973]
- Updated dependencies [cf5b52e]
- Updated dependencies [8f21270]
- Updated dependencies [6f08e19]
- Updated dependencies [934d74d]
  - @fougere/core@0.5.0
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

- Updated dependencies
- Updated dependencies [934d74d]
  - @fougere/core@0.5.0-alpha.1
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
  - @fougere/schema@0.2.0-alpha.0

## 0.1.0-alpha.0

### Minor Changes

- cf5b52e: Apply decoded inputs and declared outputs at the facade boundary, harden public transports,
  correct HTTP and GraphQL semantics, and make scaffolds and published artifacts reproducible.

### Patch Changes

- Updated dependencies [cf5b52e]
  - @fougere/schema@0.1.0-alpha.0
