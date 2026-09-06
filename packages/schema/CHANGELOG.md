# @fougere/schema

## 0.7.0-alpha.0

### Minor Changes

- A descriptor is converted at the door, and a schema circulates.

  `SchemaOrCard` had the four adapters announce they took either form, and `toTable`
  rebuilt the schema twice for the one nobody passed them — `boot/remote.ts` already
  converted at discovery, through `Card.fromDescriptor(…).toSchema()`. The adapters read
  `SchemaView`, and the union is gone from `@fougere/schema` with the two functions that
  only existed to collapse it, `schemaOf` and `fieldsOf`. The `schemaOf` of
  `@fougere/adapter-graphql`, which builds a `GraphQLSchema` from an app, is a different
  function and is untouched.

- An adapter states the format of its entry, as data.

  The level below a field name had no judge: `adapter/sql` read it with `?.` and degraded
  in silence on a typo. `adapter/sql/src/adapter.schema.json` is that format, imported with
  `with { type: 'json' }`, and `SqlField` is derived from it. `AdapterFieldValidator` takes
  a format and refuses what it does not admit, where the adapter READS — at `toTable`, not
  at `entity()`, which runs at its own module's evaluation. `EntityAdapterSet` owns the two
  levels an entry is addressed by, adapter name then field name, and always exists, so
  `getAdapters()` is never `undefined`.

- 7376ae7: A composite unique constraint belongs to the schema it constrains, not to each of its
  members.

  `FieldGroup` and `Unique` are gone from the public surface. A field carries
  `role.unique` as a boolean, read through `Role.of(field).isUnique`; a group spanning
  several fields lives once in `SchemaConstraints`, answered by `getUnique()` as before.
  The wire format is unchanged in both directions, pinned byte for byte by the v1 fixtures.

  With the sentinel gone — `unique()` no longer writes an empty group waiting to learn its
  key — `FieldGroup.isSelf`, `resolvedOn`, `Role.resolvedOn` and `Field.rename` had nothing
  left to do.

- 47513d2: `EntityTypes` and `FacadeTypes` move to the CLI, which was their only reader.

  Neither derives from anything the schema owns: `EntityTypes` reads a `SchemaDescriptor`
  and touches no field, no axis and no validator, while `FacadeTypes` writes the name
  `Invocation`, which belongs to the call contract. Their two copies of `propertyKey` and
  `docCommentOf` become one. Removed from the `@fougere/schema` root with no deprecated
  re-export.

### Patch Changes

- Four things a card or a declaration lost in silence.

  A declaration that mentions no `unique` KEEPS the groups it had; an empty list still
  clears them. A group is identified by its members, not by `join(' ')`. The card reads a
  shape back whole, as it wrote it — the keyword list it walked instead was a second
  inventory of the shape. And `description` is an annotation, so changing it no longer
  reports a `reshaped` that SQL reads as a bound that moved.

## 0.6.0-alpha.0

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

## 0.1.0-alpha.0

### Minor Changes

- cf5b52e: Apply decoded inputs and declared outputs at the facade boundary, harden public transports,
  correct HTTP and GraphQL semantics, and make scaffolds and published artifacts reproducible.
