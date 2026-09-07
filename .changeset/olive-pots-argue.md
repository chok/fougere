---
"@fougere/core": patch
---

An operation contract is written down in one place. `emitScan` held the serializer for
contracts and schema references; `emitStatement`, which the Nuxt module writes from, held
none and carried no operations at all. The half they can share now lives beside them,
asking of each emitter's imports only what it needs: an alias for a value already
imported, a named import, and the entity a class name belongs to.

No output changes — a real scan renders byte for byte what it did before.
