# @fougere/compiler

## 1.0.0-alpha.1

### Minor Changes

- f1d2704: A chain is read whole. What a link in front of `Collect<User>` refuses joins the `errors` of every op asking for a `User`, beside the collector's. GraphQL types the fields of a `Present<Post>` chain, the link's included (`presentedFields`). The names file quotes a port with a subject (`'Collect<User>'`), so `ports:` may choose one. A seated class is no longer reported as a port of itself. The CLI resolves its commands by address again, which the new facade keys had broken.
- aea7c71: What stands around a REST request is a link in front of `Rest`, the port REST's door declares
  (`ProtocolType.port`): `implements Partial<Rest>` around every route of a frond, `extends Rest<PostHandler>`
  with `super(inner)` around one handler's, one method per op. A refusal at a door is an answer, so a link
  outside it still decorates it. A port with a subject is keyed as written — `Rest<PostHandler>` — which no
  class name can take, and the scan reads it on every side. `DoorMiddleware`, `RestMiddleware()`, the
  `middlewares/` directory and the `middlewares:` order are gone.
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
- 10df4b0: Every container key with a subject is spelled as the type is written: `Repository<Post>`, `Storage<Post>`, `Facade<PostHandler>`, `Emit<PostPublished>`, `Emit<CanBook, Verdict>`, `Together<[Account, Ledger]>`, `Collect<User>`, `Present<Post>`. They used to be `PostRepository`, `PostStorage`, `postHandler`, `postPublishedEmit`, `canBookAwait`, `Account+LedgerTogether`, `UserCollector` and `PostPresenter`. A `fronds.ts` written by hand renames its `deps:` the same way. A class named `PostStorage` can no longer take a storage's key, so the `storage-key-is-provider` refusal is gone. A listener in a refusal is named by its address, `index.reindex`.
- 9d69fcd: A link may stand in front of a port without being one: `implements Partial<Payment>` with
  `constructor(private inner: Payment)` writes only what it changes, and every method it leaves out is
  the inner's, forwarded as it is built. The scan reads the clause TypeScript erases, the statement
  carries it as `implements`, and a `frond()` written by hand states it. Without the clause a class
  asking for a port is an ordinary service: a link is declared, never guessed. A class implementing a
  port without asking for it is still warned, `Partial<X>` included, naming the inner to take.
- 5f1c3ca: A collector extends `Collect<User>` and a presenter `Present<Post>`, generic bases like `Repository<Post>`:
  `Collector(User)` and `Presenter(Post)`, called as functions, are gone with the views argument. The scan
  reads the erased argument, the statement writes it as a value, and a `frond()` written by hand states it —
  `{ ctor: CurrentUserCollector, collects: User }`, `{ ctor: PostPresenter, presents: Post }` — refused at
  boot when missing. What `collect()` refuses is read like `missing()`, and joins every op the collector serves.
- 6b84cec: `collectors/`, `presenters/` and `repositories/` are no longer convention directories: every class a frond injects sits in `services/`, and what it extends says what it is — `Collect<User>`, `Present<Post>`, `Repository<Post>`. Move the files there; a class left in one of the three is not scanned, and `fougere check` names the directory. `conventions: { dirs }` loses the three keys, and `providerDirsOf` is gone.
- 87a261d: What stands around a frond's calls is a link in front of `Dispatcher`: `class Wrote implements
Partial<Dispatcher>`, asking for `inner: Dispatcher`, in `services/`, handed each call as its `Call`.
  Two are ordered by `ports: { Dispatcher: [...] }` in `frond.config.ts`, outside in. `Middleware`, the
  `middlewares:` order and `middleware-not-extended` are gone.

### Patch Changes

- 5f1c3ca: `Mirror<BookCard>` is a `Repository<BookCard>` that fills itself: write `pull`, call `refresh(since)`, and
  read the copy like any rows. `Mirror(BookCard)` called as a function is gone with `MirrorConstructor` and
  `MirrorOf`, and so is the `Storage<T>` its constructor took — it is seated on its rows like any repository.
  The scan reads the entity through a generic base in between, `Mirror<T> extends Repository<T>`.
- 00b592c: What an operation refuses crosses a port: a call to the base's method reaches what each override
  refuses — a realization, and a link's guard before it hands over to `inner`. The walk stopped at the
  abstract method, so an op reaching its PSP through `Payment` promised none of its refusals, on the
  card and in OpenAPI alike.
- 08c7bc1: A value is read through `Env<Meili>`, the port a link stands in front of to change what a source gave:
  `class MeiliFromVault implements Partial<Env<Meili>>`, asking for `inner: Env<Meili>`, touches Meili
  alone. It is read once, at boot, and judged like what the source holds.
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

## 0.8.4-alpha.0

### Minor Changes

- The scan is a package, and core states what it takes to fill a descriptor.

  Reading a project's source is the one thing core did that needs a filesystem and a
  TypeScript program, and it was the only reason `@typescript/typescript6` — 24 MB — was a
  dependency of every install. The bundles never carried it: the loaders were already lazy,
  so what moves is what an install downloads, not what a Worker runs.

  `scanProject`, `emitScan`, `emitStatement`, `frondAliases`, `boot` and the two AST readers
  now come from `@fougere/compiler`. `@fougere/core/node` keeps what needs a disk without a
  compiler: the config loader, the module loader, the deployment keys.

  The extraction forced a contract out of hiding. Fifteen symbols the scan reached for inside
  core leave by `@fougere/core/descriptor`, a fourth entry that says what it takes to PRODUCE
  a descriptor where the main one says what an app RUNS. `conventions` came back to core — it
  names directories and reads nothing.

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [771e703]
  - @fougere/core@0.9.0-alpha.1
