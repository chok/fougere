---
'@fougere/adapter-duckdb': minor
'@fougere/adapter-graphql': minor
'@fougere/adapter-rest': minor
'@fougere/adapter-sql': minor
'@fougere/app': minor
'@fougere/auth-better': minor
'@fougere/cli': minor
'@fougere/container': minor
'@fougere/core': minor
'@fougere/defaults': minor
'@fougere/http': minor
'@fougere/next': minor
'@fougere/nuxt': minor
'@fougere/react': minor
'@fougere/schema': minor
'@fougere/svelte': minor
'@fougere/transport-http': minor
'@fougere/vite': minor
'create-fougere': minor
'fougere': minor
---

An entity's rows live where the app says, and reading across those places is one query.

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
