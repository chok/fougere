---
'@fougere/core': patch
'@fougere/container': patch
---

A dependency nothing answers refuses the boot, naming the class and its file — it used to answer
`'X' is not registered` at the first call. `Container.unresolved()` asks every registration's
dependencies without building one, after the extensions have risen. A seam link is no longer
registered under its own name, which nothing could resolve.
