---
'@fougere/core': minor
---

A service extending `Repository<Post>` answers `Repository<Post>` whatever its name, beside its own — the way
`StripePayment` answers `Payment`. It used to answer only when it was called `PostRepository`. Two such
services refuse the boot (`repository-twice`).
