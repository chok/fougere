---
'@fougere/schema': patch
---

A descriptor's `enum` holds strings and numbers. It was typed `null[]`, so an entity `fougere sync` wrote from a card with a `oneOf` field did not compile.
