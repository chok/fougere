# @fougere/workflow

## 0.28.0-alpha.2

### Patch Changes

- 5f1c3ca: A handler extends a repository and exposes what it extends: `class PostHandler extends
Repository<Post>`, or a `PostRepository` that names its queries, serves the five CRUD operations beside
  its own. `Repository` is a generic base now — `Repository<Account, Ledger>` an aggregate, four at most —
  and `Crud(…)`, `Repository(…)` called as a function, `CrudOps`, `CrudViews` and the per-op view map are
  gone. TypeScript erases the type argument, so the scan reads it, the statement writes it as a value and
  a `frond()` written by hand states it — `{ ctor: PostHandler, repository: Post }`, refused at boot when
  missing. The boot hands the rows over after a constructor's own dependencies, so `super(posts)` is gone.
  An op answering a view (`Page<PostCard>`) closes its output; `Repository<PostPublic>` reads a whole
  handler through one. A list a storage answered crosses as a page whatever the op returned, and a page
  reads its type as one.
- Updated dependencies [f1d2704]
- Updated dependencies [aea7c71]
- Updated dependencies [5f1c3ca]
- Updated dependencies [5b1ad11]
- Updated dependencies [5f1c3ca]
- Updated dependencies [10df4b0]
- Updated dependencies [9d69fcd]
- Updated dependencies [4da370e]
- Updated dependencies [5f1c3ca]
- Updated dependencies [97fbc58]
- Updated dependencies [08c7bc1]
- Updated dependencies [1ea472e]
- Updated dependencies [6d694d1]
- Updated dependencies [5f1c3ca]
- Updated dependencies [5f1c3ca]
- Updated dependencies [d7cde0c]
- Updated dependencies [57ddbb7]
- Updated dependencies [9e17181]
- Updated dependencies [d4eab03]
- Updated dependencies [6b84cec]
- Updated dependencies [87a261d]
- Updated dependencies [f7ccbed]
  - @fougere/core@1.0.0-alpha.1
