---
'@fougere/core': minor
---

A handler is a container key in its own frond: a class beside it asking for `PostHandler` is handed the
instance its facade calls. Asked for from another frond, the boot refuses (`handler-of-another-frond`),
pointing at `Facade<PostHandler>` — the bare handler skips validation, middlewares and placement.
