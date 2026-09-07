---
"@fougere/core": patch
---

A statement carries the operations the scan read. `frond()` posted an empty Map, so a
host booting from a written statement — which is what `@fougere/nuxt` hands its runtime —
served a prefab's five CRUD ops and nothing an author had written. The scan reads a
method's contract from source and a class carries none of it at runtime, so the statement
is where it has to survive; `emitStatement` now writes it, beside the `deps` it already
wrote for the same reason.

A prefab's own `__ops` still answer, and a method written over one wins.
