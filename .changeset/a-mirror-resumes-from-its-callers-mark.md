---
'@fougere/core': minor
---

A mirror resumes from the mark its caller kept, not from its own rows.

`freshness()` read the newest `updated()` stamp, which says when WE wrote a row — a source
compares `?since=` against its own clock and often never puts it on one. A pass that threw
halfway still pushed the mark past its own gap, and the rows changed in between were never
asked for again.

`refresh(since?)` takes it. `freshness()`, `ageFieldOf()` and the refusal of a shape without
an `updated()` field are gone with the reading that needed them, so a shape that dates
nothing can be copied. `demos/mirror-catalog` keeps the mark in `PartnerCatalog` and moves
it only after a pass returns.
