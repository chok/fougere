---
'@fougere/core': minor
'@fougere/adapter-sql': minor
'@fougere/adapter-file': minor
'@fougere/defaults': minor
'@fougere/schema': minor
'@fougere/app': minor
'@fougere/react': minor
'@fougere/svelte': minor
'@fougere/nuxt': minor
'@fougere/admin': minor
'@fougere/cli': minor
---

A source is handed its entities, not the app: `SourceView` is the schemas it holds by name,
and the names another source holds. `sourceViewOf(fronds, holds?)` builds it.

`generateSQL`, `autoMigrate`, `migrate`, `pendingOf`, `desiredTables` and `toTables` take that
view — `generateSQL(sourceViewOf(app.fronds))` where it was `generateSQL(app)`. `AppLike` and
`FrondLike` are gone.

`FormEntity` was another name for `SchemaView`, which `@fougere/app` now exports under its own.
