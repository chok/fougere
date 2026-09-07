---
"@fougere/core": minor
"@fougere/adapter-sql": minor
---

A migration says what it declined to change. The pass is additive by design — it creates
what is missing and never touches a column that exists — which is a promise worth keeping
and a silence worth breaking: relax a `required` field and the table keeps its NOT NULL,
so the write fails on a row, in production, long after the boot that could have named it.
Measured twice on a real app, once as `CHECK constraint failed` and once as `NOT NULL
constraint failed`, both with a green boot.

`Source.migrate` may now answer with what it found, and the boot voices it — the shape
`seeding(report)` already had. `SchemaState` stays a set of names on purpose: `done()`
reads it to decide whether a frozen step was applied, and a wider one would make a
replayed migration answer wrong.
