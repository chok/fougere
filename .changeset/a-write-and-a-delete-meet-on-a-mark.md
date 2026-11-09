---
"@fougere/core": minor
"@fougere/defaults": minor
"@fougere/adapter-sql": minor
"@fougere/workflow": minor
---

A `ref()` across two sources is arbitrated: a write and the delete of its target wait on a row of `fougere_targets`, which `fougere migrate` creates, and one is refused. A release asks every refusal of its tree before a row moves, and a foreign key is read off `sources:` alone, so two processes sharing a database leave the reference to it. `Journal` gains `leave`, `rpc.holds` refuses for an entity this process does not hold, and D1 no longer declares transactions it refuses.
