---
'@fougere/schema': minor
'@fougere/core': minor
'@fougere/adapter-sql': minor
'@fougere/adapter-graphql': minor
'@fougere/adapter-duckdb': minor
'@fougere/auth-better': minor
'@fougere/admin': minor
---

An entity class, whichever its fields, is `Entity` — a schema that can be built.
`EntityConstructor` is gone, and so are the copies that stood for it: graphql's `EntityClass`,
duckdb's `ShapeClass`, better-auth's `LiveEntity`. The casts between them fall.
`OperationOverride.handler` is a `Ctor`: a handler is not an entity.

`FieldExtension` and the `restated` change follow the registered axes, so a fourth axis is
typed on a card and in a diff. The card envelope and the `unique`/`index` pair have one
owner. A call's `state` is a schema extended by each extension that declares it.
