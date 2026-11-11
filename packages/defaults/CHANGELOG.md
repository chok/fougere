# @fougere/runtime

## 0.30.0-alpha.5

### Patch Changes

- @fougere/adapter-memory@0.30.0-alpha.5
- @fougere/container@0.30.0-alpha.5
- @fougere/core@0.30.0-alpha.5
- @fougere/transport-http@0.30.0-alpha.5

## 0.30.0-alpha.4

### Patch Changes

- @fougere/adapter-memory@0.30.0-alpha.4
- @fougere/container@0.30.0-alpha.4
- @fougere/core@0.30.0-alpha.4
- @fougere/transport-http@0.30.0-alpha.4

## 0.30.0-alpha.3

### Patch Changes

- e9a8641: A global `fougere` runs the project's own CLI when there is one, and a message naming a command says how to run it without a global install (`WITHOUT_GLOBAL_INSTALL`).
- Updated dependencies [e9a8641]
  - @fougere/core@0.30.0-alpha.3
  - @fougere/adapter-memory@0.30.0-alpha.3
  - @fougere/transport-http@0.30.0-alpha.3
  - @fougere/container@0.30.0-alpha.3

## 0.30.0-alpha.2

### Minor Changes

- 8044dcd: A `ref()` across two sources is arbitrated: a write and the delete of its target wait on a row of `fougere_targets`, which `fougere migrate` creates, and one is refused. A release asks every refusal of its tree before a row moves, and a foreign key is read off `sources:` alone, so two processes sharing a database leave the reference to it. `Journal` gains `leave`, `rpc.holds` refuses for an entity this process does not hold, and D1 no longer declares transactions it refuses.
- 1835e30: The scheme of `remote:` names the transport that carries the call: `@fougere/transport-http` registers `http`, `https` and `binding` (a Cloudflare service binding, `binding://CATALOG`), and `Transports.register('tcp', …)` adds another. A scheme nothing registered refuses the boot, naming the entry. `remoteTransport()` is gone from `@fougere/defaults`; `remoteTransport:` remains the host's way to replace the transport whole.

### Patch Changes

- Updated dependencies [8044dcd]
- Updated dependencies [d179658]
- Updated dependencies [28e9ba0]
- Updated dependencies [1835e30]
  - @fougere/core@0.30.0-alpha.2
  - @fougere/transport-http@0.30.0-alpha.2
  - @fougere/adapter-memory@0.30.0-alpha.2
  - @fougere/container@0.30.0-alpha.2

## 0.30.0-alpha.1

### Patch Changes

- @fougere/adapter-memory@0.30.0-alpha.1
- @fougere/container@0.30.0-alpha.1
- @fougere/core@0.30.0-alpha.1
- @fougere/transport-http@0.30.0-alpha.1

## 0.30.0-alpha.0

### Patch Changes

- Updated dependencies [565ca0f]
- Updated dependencies [50e1b8d]
- Updated dependencies [85aff54]
- Updated dependencies [2d67956]
- Updated dependencies [85aff54]
  - @fougere/core@0.30.0-alpha.0
  - @fougere/adapter-memory@0.30.0-alpha.0
  - @fougere/transport-http@0.30.0-alpha.0
  - @fougere/container@0.30.0-alpha.0

## 0.29.0-alpha.3

### Patch Changes

- Kysely 0.29.
- Updated dependencies
- Updated dependencies
  - @fougere/core@0.29.0-alpha.3
  - @fougere/adapter-memory@0.29.0-alpha.3
  - @fougere/transport-http@0.29.0-alpha.3
  - @fougere/container@0.29.0-alpha.3

## 0.29.0-alpha.2

### Patch Changes

- @fougere/adapter-memory@0.29.0-alpha.2
- @fougere/container@0.29.0-alpha.2
- @fougere/core@0.29.0-alpha.2
- @fougere/transport-http@0.29.0-alpha.2

## 0.29.0-alpha.1

### Patch Changes

- Updated dependencies [081f171]
  - @fougere/core@0.29.0-alpha.1
  - @fougere/adapter-memory@0.29.0-alpha.1
  - @fougere/transport-http@0.29.0-alpha.1

## 0.28.0-alpha.2

### Minor Changes

- 97fbc58: `sources:` lists `rows:` and `values:`, where it listed `entities:`. An entity in `values:` is
  injected as ONE value — `constructor(meili: Meili)` — read, completed by its defaults and judged at
  boot. `@fougere/adapter-env` reads it from `MEILI_URL`; a source holding rows keeps it as a
  `FougereValue` row, a file source as one file. The default source is the writable entry with no
  `rows:`; when every entry lists its rows, an entity left out refuses the boot.

### Patch Changes

- Updated dependencies [f1d2704]
- Updated dependencies [aea7c71]
- Updated dependencies [5f1c3ca]
- Updated dependencies [5b1ad11]
- Updated dependencies [5f1c3ca]
- Updated dependencies [10df4b0]
- Updated dependencies [9d69fcd]
- Updated dependencies [4da370e]
- Updated dependencies [5f1c3ca]
- Updated dependencies [00b592c]
- Updated dependencies [97fbc58]
- Updated dependencies [08c7bc1]
- Updated dependencies [1ea472e]
- Updated dependencies [49cbfde]
- Updated dependencies [6d694d1]
- Updated dependencies [5f1c3ca]
- Updated dependencies [2a6116c]
- Updated dependencies [5f1c3ca]
- Updated dependencies [d7cde0c]
- Updated dependencies [57ddbb7]
- Updated dependencies [9e17181]
- Updated dependencies [d4eab03]
- Updated dependencies [6b84cec]
- Updated dependencies [87a261d]
- Updated dependencies [f7ccbed]
  - @fougere/core@1.0.0-alpha.1
  - @fougere/compiler@1.0.0-alpha.1
  - @fougere/transport-http@0.28.0-alpha.1
  - @fougere/adapter-memory@0.28.0-alpha.1

## 0.8.4-alpha.0

### Patch Changes

- Updated dependencies [df73bcb]
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [32923e6]
- Updated dependencies
- Updated dependencies
- Updated dependencies [771e703]
  - @fougere/adapter-sql@0.9.0-alpha.1
  - @fougere/core@0.9.0-alpha.1
  - @fougere/container@0.8.3-alpha.1
  - @fougere/compiler@1.0.0-alpha.1
  - @fougere/transport-http@0.8.3-alpha.1

## 0.8.3-alpha.0

### Patch Changes

- Updated dependencies
  - @fougere/core@0.8.3-alpha.0

## 0.8.2-alpha.0

### Patch Changes

- Updated dependencies [fb256c1, c1ad40c]
  - @fougere/core@0.8.2-alpha.0

## 0.8.1-alpha.0

### Patch Changes

- Updated dependencies [9d24851]
  - @fougere/core@0.8.1-alpha.0
  - @fougere/adapter-sql@0.8.1-alpha.0
  - @fougere/transport-http@0.8.1-alpha.0

## 0.8.0-alpha.0

### Minor Changes

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
  - @fougere/adapter-sql@0.8.0-alpha.0
  - @fougere/transport-http@0.8.0-alpha.0

## 0.7.0-alpha.0

### Patch Changes

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
  - @fougere/adapter-sql@0.6.0-alpha.1
  - @fougere/core@0.6.0-alpha.1
  - @fougere/transport-http@0.6.0-alpha.1

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
    what the facade refuses.
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
  - @fougere/adapter-sql@0.5.0
  - @fougere/container@0.5.0
  - @fougere/transport-http@0.5.0

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
  - @fougere/adapter-sql@0.5.0-alpha.1
  - @fougere/container@0.5.0-alpha.1
  - @fougere/transport-http@0.5.0-alpha.1

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
  - @fougere/adapter-sql@0.2.0-alpha.2
  - @fougere/container@0.2.0-alpha.2
  - @fougere/core@0.2.0-alpha.2
  - @fougere/transport-http@0.2.0-alpha.2

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
  - @fougere/core@0.2.0-alpha.1
  - @fougere/schema-sql@0.2.0-alpha.1
  - @fougere/transport-http@0.2.0-alpha.1

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
    what the facade refuses.
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
  - @fougere/core@0.2.0-alpha.0
  - @fougere/schema-sql@0.2.0-alpha.0
  - @fougere/transport-http@0.2.0-alpha.0

## 0.1.0-alpha.0

### Minor Changes

- cf5b52e: Apply decoded inputs and declared outputs at the facade boundary, harden public transports,
  correct HTTP and GraphQL semantics, and make scaffolds and published artifacts reproducible.

### Patch Changes

- Updated dependencies [cf5b52e]
  - @fougere/container-fougere@0.1.0-alpha.0
  - @fougere/core@0.1.0-alpha.0
  - @fougere/schema-sql@0.1.0-alpha.0
  - @fougere/transport-http@0.1.0-alpha.0
