---
'@fougere/core': minor
'@fougere/adapter-sql': minor
'@fougere/adapter-memory': minor
---

A row changed from what it holds: `update(id, (row) => …)` reads and writes it with no other write in between (`FOR UPDATE` on Postgres and MySQL), and `updateByKeys(ids, change)` holds a whole set at once, in key order, so two blocks taking the same rows cannot cross. Writers wait their turn per key in the process, which Postgres does not keep. `createAll(inputs)` writes a set in one statement, and so does `updateByKeys` on Postgres. A deadlock the engine breaks answers `CONFLICT`.
