---
'@fougere/schema': minor
---

A format carries the type it admits, so a key is stated once.

`Format<T>` and `Admits<F>` replace the four interfaces an axis wrote beside its format —
`LifecycleRules`, `RoleRules`, `BoundaryRules` and `Meta` are derived now. What JSON Schema
cannot say passes through one door, `Format.text.as<GeneratorRef>()`. A reading holds its rules
whole rather than copying their keys, and `role.relation.to` is required by the format, so an
absent target is refused by the document and a target that is not a function by `Role.refusals`.
