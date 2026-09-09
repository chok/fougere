---
'@fougere/schema': minor
'@fougere/adapter-sql': patch
'@fougere/adapter-graphql': patch
'@fougere/app': patch
'@fougere/cli': patch
'@fougere/testing': patch
---

An axis answers questions, and keeps no member to answer for it.

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
