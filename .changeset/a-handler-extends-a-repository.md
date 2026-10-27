---
'@fougere/core': major
'@fougere/compiler': minor
'@fougere/workflow': patch
'@fougere/cli': patch
---

A handler extends a repository and exposes what it extends: `class PostHandler extends
Repository<Post>`, or a `PostRepository` that names its queries, serves the five CRUD operations beside
its own. `Repository` is a generic base now — `Repository<Account, Ledger>` an aggregate, four at most —
and `Crud(…)`, `Repository(…)` called as a function, `CrudOps`, `CrudViews` and the per-op view map are
gone. TypeScript erases the type argument, so the scan reads it, the statement writes it as a value and
a `frond()` written by hand states it — `{ ctor: PostHandler, repository: Post }`, refused at boot when
missing. The boot hands the rows over after a constructor's own dependencies, so `super(posts)` is gone.
An op answering a view (`Page<PostCard>`) closes its output; `Repository<PostPublic>` reads a whole
handler through one. A list a storage answered crosses as a page whatever the op returned, and a page
reads its type as one.
