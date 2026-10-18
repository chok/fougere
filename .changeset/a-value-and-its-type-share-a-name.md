---
'@fougere/core': minor
'@fougere/compiler': minor
---

A value and its type share one name. `RepositoryOf<Post>` is now `Repository<Post>` — the class
you extend is `Repository(Post)`, the type you ask for is `Repository<Post>`. `pageOf(rows)` is now
`Page.of(rows)`, so a handler imports `Page` alone. `AggregateOf` is no longer exported: nothing
outside core named it, and the aggregate's shape is `Aggregate<E>`.
