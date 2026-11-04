---
'@fougere/schema': patch
---

A `writeOnly` field inside `json(Entity)` no longer leaves in an answer, at any depth. `json()` writes `writeOnly: true` on the property, so a card carries it, and a write keeps the field.
