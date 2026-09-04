---
'@fougere/schema': minor
'@fougere/core': patch
'@fougere/adapter-sql': patch
---

A composite unique constraint belongs to the schema it constrains, not to each of its
members.

`FieldGroup` and `Unique` are gone from the public surface. A field carries
`role.unique` as a boolean, read through `Role.of(field).isUnique`; a group spanning
several fields lives once in `SchemaConstraints`, answered by `getUnique()` as before.
The wire format is unchanged in both directions, pinned byte for byte by the v1 fixtures.

With the sentinel gone — `unique()` no longer writes an empty group waiting to learn its
key — `FieldGroup.isSelf`, `resolvedOn`, `Role.resolvedOn` and `Field.rename` had nothing
left to do.
