# @fougere/adapter-duckdb

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

- Updated dependencies [8f390d0]
- Updated dependencies [5076973]
- Updated dependencies [cf5b52e]
- Updated dependencies [8f21270]
- Updated dependencies [6f08e19]
- Updated dependencies [934d74d]
  - @fougere/adapter-sql@0.5.0
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

- Updated dependencies [934d74d]
  - @fougere/adapter-sql@0.5.0-alpha.1
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
  - @fougere/adapter-sql@0.2.0-alpha.2
  - @fougere/schema@0.2.0-alpha.2
