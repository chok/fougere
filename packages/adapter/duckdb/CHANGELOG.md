# @fougere/adapter-duckdb

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
