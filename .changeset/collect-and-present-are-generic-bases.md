---
'@fougere/core': major
'@fougere/compiler': minor
'@fougere/auth-better': patch
---

A collector extends `Collect<User>` and a presenter `Present<Post>`, generic bases like `Repository<Post>`:
`Collector(User)` and `Presenter(Post)`, called as functions, are gone with the views argument. The scan
reads the erased argument, the statement writes it as a value, and a `frond()` written by hand states it —
`{ ctor: CurrentUserCollector, collects: User }`, `{ ctor: PostPresenter, presents: Post }` — refused at
boot when missing. What `collect()` refuses is read like `missing()`, and joins every op the collector serves.
