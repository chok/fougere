---
'@fougere/schema': minor
---

The card knows how to write an axis; an axis knows nothing of the card.

`Axis.describe` and `Axis.reconstruct` are gone. `CardForms` — a registry the card holds —
names the axes whose card form differs from their declaration, and `role` is the only one
today. An axis absent from it travels as itself, which is what `lifecycle`, `boundary` and
anything registered from outside do, and a third party states its own form on the card side
without touching the axis. The `axis`↔`projection` cycle went with it: one import ran that way
against twenty the other.
