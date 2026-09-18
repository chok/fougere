---
'@fougere/schema': minor
---

An axis is its class: `static format` states what it admits, the instance reads it.

`lifecycleAxis`, `boundaryAxis` and `roleAxis` are gone — `Lifecycle`, `Boundary` and `Role`
carry the format and, for `role` alone, the two conversions a card needs. `Axis.slot` is gone
with them: the key a registration states is the slot, so the name lives in one place.
