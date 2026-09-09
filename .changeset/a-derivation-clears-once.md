---
'@fougere/schema': minor
---

A derivation states what it clears once, and the group of two has the owner its own
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
