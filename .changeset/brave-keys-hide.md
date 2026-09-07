---
"@fougere/core": patch
---

A provider's container key is written down. It was read at boot off `ctor.name`, which
held until a bundler lowered a `static readonly` field and renamed the declaration doing
it: the provider registered as `_Communes` and every handler asking for `Communes` met a
container miss. The scan reads the name from source, both emitters write it, and
`ctor.name` answers only where nobody wrote it down.

Measured on a real app: five operations depending on renamed providers answer with no
bundler setting at all.
