# @fougere/workflow

## 0.30.0-alpha.6

### Patch Changes

- Updated dependencies
  - @fougere/core@0.30.0-alpha.6
  - @fougere/container@0.30.0-alpha.6
  - @fougere/schema@0.30.0-alpha.6

## 0.30.0-alpha.5

## 0.30.0-alpha.4

## 0.30.0-alpha.3

## 0.30.0-alpha.2

### Minor Changes

- 8044dcd: A `ref()` across two sources is arbitrated: a write and the delete of its target wait on a row of `fougere_targets`, which `fougere migrate` creates, and one is refused. A release asks every refusal of its tree before a row moves, and a foreign key is read off `sources:` alone, so two processes sharing a database leave the reference to it. `Journal` gains `leave`, `rpc.holds` refuses for an entity this process does not hold, and D1 no longer declares transactions it refuses.

## 0.30.0-alpha.1

## 0.30.0-alpha.0

## 0.29.0-alpha.3

## 0.29.0-alpha.2

## 0.29.0-alpha.1

### Patch Changes

- Released with every other package, so a project scaffolded at this version finds all of them.

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
