---
'@fougere/container': minor
'@fougere/core': minor
---

`Container.unresolved()` and the `Unresolved` type are removed. The boot still refuses a dependency that nothing provides, but it now checks this itself with `has()`, against what each class declares. The container goes back to registering and resolving.
