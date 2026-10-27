---
'@fougere/core': minor
'@fougere/compiler': patch
---

A value is read through `Env<Meili>`, the port a link stands in front of to change what a source gave:
`class MeiliFromVault implements Partial<Env<Meili>>`, asking for `inner: Env<Meili>`, touches Meili
alone. It is read once, at boot, and judged like what the source holds.
