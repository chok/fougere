---
'@fougere/schema': minor
'@fougere/core': patch
---

A value is admitted and handed back in the domain's form, once.

`validate`, then `null`, then `Boundary.decode` was written three times — the client door
and both of the storage guard's. `FieldValueValidator.parse` is the door for the sequence,
and the only judgement it carries is that `null` never reaches a codec.

Two doors decode, which is the policy and not an oversight: the client one on what arrives,
the guard on what a handler writes, because both hand the storage a parsed value. That asks
the decoder for idempotence, which the shipped one happens to give on its first line and
nothing required — `Decoder` says so now, and a test holds it.

And a derived gesture writes through the store rather than the front door: `upsertAll`
reached `upsert` on `this`, so a caller that wrapped the port was traversed twice and a
non-idempotent codec halved the row it stored.
