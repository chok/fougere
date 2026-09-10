# @fougere/schema

## 0.8.4-alpha.0

### Minor Changes

- 26f7987: A derivation states what it clears once, and the group of two has the owner its own
  commit named.

  Four of the seven ways to build a `SchemaDefinition` were writing `previous: undefined,
anchored: false` by hand — the same re-threading that once dropped a member from the list
  without anyone noticing. `derived` states it for all four, and `restated` is its dual:
  `declares` and `anchor` cut nothing, so what they do not name is kept by construction.

  `SchemaConstraints` becomes a class. `deduplicated` — a free function in `FieldSet` with
  four callers — and `constraintsRenamed` — private on `SchemaDefinition` — were both
  deciding about a composite `unique` from outside it; they are now `SchemaConstraints.of`
  and `.renamed`, and the three `as CompositeUnique<Fields> | undefined` casts are gone with
  them. `FieldSet.declaring` answers `groups`, the composites it leaves to the schema, and
  no longer deduplicates on the way out.

  `Schema.of({ constraints })` now takes a `SchemaConstraints`, built with
  `SchemaConstraints.of([['tenant', 'email']])` rather than an object literal. Nothing
  outside the package was importing the type.

- A value is admitted and handed back in the domain's form, once.

  `validate`, then `null`, then `Boundary.decode` was written three times — the client door
  and both of the storage guard's. `FieldValueValidator.parse` is the door for the sequence,
  and the only judgement it carries is that `null` never reaches a codec.

  Two doors decode, which is the policy and not an oversight: the client one on what arrives,
  the guard on what a handler writes, because both hand the storage a parsed value. That asks
  the decoder for idempotence, which the shipped one happens to give on its first line and
  nothing required — `Decoder` says so now, and a test holds it.

  And a derived gesture writes through the store rather than the front door: `upsertAll`
  reached `upsert` on `this`, so a caller that wrapped the port was traversed twice and a
  non-idempotent codec halved the row it stored.

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

- 771e703: The type a projection dispatches on, named once and imported from the standard.

  Nine places re-derived the same partition of shapes — two in `@fougere/app`'s form, one in
  `@fougere/core`'s criterion, five in `@fougere/adapter-sql`, one in `@fougere/cli` — and it
  had already diverged twice: `controlOf` had no `object|array` branch that its twin
  `renderOf` carries, and `pothos.ts` documents its own bug, a bounded set falling through to
  `String`.

  `Shapes.typeOf(shape)` answers `ShapeType`, which is `JSONSchema7TypeName` from
  `@types/json-schema` less `null` — a shape states that as the `[T,'null']` union — with
  `string` in the three forms this package actually tells apart: `date`, `choice`, `text`.
  Those three are the whole of what is ours; the rest is the standard's, and a type assertion
  fails the build if `SHAPE_TYPES` and the standard ever part ways.

  `Shapes.isNullable` stays: nullability is not a type, it is the other half of `Shapes.of`.

  `@fougere/app`'s two cascades are now `Record<ShapeType, …>` tables, which no longer compile
  if a type is left out. `@fougere/adapter-sql` and `@fougere/cli` still hold theirs.

### Patch Changes

- Four rules that were written twice, and the families that had no home.

  The surfaces a handler answers on — its own, or the default and every surface naming it
  without a door of its own — was written in the effective model and again inline in the boot
  that registers the routes. They agreed on the rule and not on the name of the absence.
  `servedSurfaces` is where it lives, and `undefined` is the default surface as every key
  already spelled it.

  A presenter reads its binding plan when its façade is built, the way a handler already did:
  `computeBindingPlan` says of itself that it is decided once at boot and replayed per call,
  and the presenter rebuilt one per presentation from facts that were already settled.

  Two families were reaching down into a package root for a leaf that depends on nothing while
  the root reached back up into them — `storage` and the verdict's vocabulary. `core` keeps its
  storage port, its store frame and its criteria under `storage/`, an emission is a call and
  lives in `wire/`, and `schema` keeps `ValidationError` where `Registry` already was.
  Intra-package family cycles: core 5 → 2, schema 9 → 6, and what is left is stated.

## 0.8.2-alpha.0

### Patch Changes

- A word of the vocabulary says which of three things it is: `primitive/` builds a field,
  `preset/` states one member more on another word, `rule/` takes a field and adds a
  statement — the seven `vocabulary()` makes. `RoleRules` joins `LifecycleRules` and
  `BoundaryRef` at the door, and `Meta` leaves `axis/`: it had one reader, `Field`, and
  says `description`, which no axis reads. Import paths inside the package moved; the
  package's door did not — it publishes `"."` alone.

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
