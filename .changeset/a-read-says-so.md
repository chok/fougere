---
'@fougere/core': minor
---

An operation is a query when every verb its name uses is a read verb, and a command otherwise. A name with no known verb, or with a write after a read (`getOrCreate`), no longer refuses the boot: it is a command, which answers over POST and is never cached. The list of write verbs is gone, and `isReadOp` and `resolveIsReadOp` with it.
