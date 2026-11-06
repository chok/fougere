# @fougere/core

## 0.30.0-alpha.1

### Patch Changes

- @fougere/container@0.30.0-alpha.1
- @fougere/graph@0.30.0-alpha.1
- @fougere/registry@0.30.0-alpha.1
- @fougere/schema@0.30.0-alpha.1

## 0.30.0-alpha.0

### Minor Changes

- 565ca0f: An operation written by hand can state what it refuses: `{ params: {…}, output: Post, errors: [ErrorCode.CONFLICT] }`. The list reaches the card and OpenAPI as a scanned one does.
- 50e1b8d: A written statement names each file from the root of the project, not from the disk that scanned it, so a build carries no path of the machine that ran it. A `ScanResult` states its `root`.
- 85aff54: `fougere sync` writes `remotes/<name>/` at the root of the project, and that directory is committed: only the far side can write it again, so a fresh clone compiles with no host running. `.fougere/remotes.json` is gone, since its path follows from the name and nothing read its url. Move `.fougere/remotes/` to `remotes/`, and change `.fougere/remotes/` to `remotes/` in any `paths` of your own. `SyncedRemote` has no `url` any more.
- 85aff54: A project has one `.fougere/`, at its root: the facade and the names are written there by every host, and no app holds a copy, so `fougere build` is enough before `tsc` in a CI. In an app's tsconfig, `./.fougere/facade.generated.ts` becomes `../../.fougere/facade.generated.ts`. `@fougere/core/tsconfig` now states `include` — the fronds, the config and the names — so a wrong name in `fougere.config.ts` no longer compiles: remove your own `include` to get it. Next writes the names too, and a scan that fails under Vite or Next now says so.

### Patch Changes

- 2d67956: An operation answering an entity beside another type (`Promise<Account | Receipt>`, `Promise<Account | string>`) refuses the boot with `output-contract-ambiguous`. It had no view, so it left whole, a `writeOnly` field included. `Promise<Account | null>` is unchanged, and `operations:` in `frond.config.ts` may state the output.
- Updated dependencies [4c0ebd2]
- Updated dependencies [aa2be0c]
  - @fougere/schema@0.30.0-alpha.0
  - @fougere/container@0.30.0-alpha.0
  - @fougere/graph@0.30.0-alpha.0
  - @fougere/registry@0.30.0-alpha.0

## 0.29.0-alpha.3

### Minor Changes

- Breaking: `VALIDATION_FAILED` answers 422, as RFC 9110 has it for a well-formed body the server refuses. A REST list reads its page and its filters off the query string (`?limit=20&name=Bob`), `json(Entity)` refuses a key the entity does not declare, and a route with no prefix and no frond segment answers. Writes return their row in the same statement, a presenter does not compute a field the answer already carries, and an operation builds no event nobody observes.
- A row changed from what it holds: `update(id, (row) => …)` reads and writes it with no other write in between (`FOR UPDATE` on Postgres and MySQL), and `updateByKeys(ids, change)` holds a whole set at once, in key order, so two blocks taking the same rows cannot cross. Writers wait their turn per key in the process, which Postgres does not keep. `createAll(inputs)` writes a set in one statement, and so does `updateByKeys` on Postgres. A deadlock the engine breaks answers `CONFLICT`.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @fougere/schema@0.29.0-alpha.3
  - @fougere/container@0.29.0-alpha.3
  - @fougere/graph@0.29.0-alpha.3
  - @fougere/registry@0.29.0-alpha.3

## 0.29.0-alpha.2

### Patch Changes

- @fougere/container@0.29.0-alpha.2
- @fougere/graph@0.29.0-alpha.2
- @fougere/registry@0.29.0-alpha.2
- @fougere/schema@0.29.0-alpha.2

## 0.29.0-alpha.1

### Minor Changes

- 081f171: A project types its fronds from the `tsconfig.json` at its root, which covers `fougere.config.ts` too; each app under `apps/` keeps the one its tool wrote. A frond renamed by a `paths` entry is read there, no longer from `fronds/tsconfig.json`, and the starter's `typecheck` is `tsc`. `@fougere/next/route` hands Fougere the request alone: Next's own `{ params }` second argument was taken for the caller's state, and `next build` refused the route's type.

## 0.28.0-alpha.2

### Minor Changes

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
- 5f1c3ca: `Mirror<BookCard>` is a `Repository<BookCard>` that fills itself: write `pull`, call `refresh(since)`, and
  read the copy like any rows. `Mirror(BookCard)` called as a function is gone with `MirrorConstructor` and
  `MirrorOf`, and so is the `Storage<T>` its constructor took — it is seated on its rows like any repository.
  The scan reads the entity through a generic base in between, `Mirror<T> extends Repository<T>`.
- 5f1c3ca: An extension states `up`, `down`, `fronds` and `state`: `install` and `steps` leave the public `Extension`,
  which nothing outside core read. They stay the doors a module of the kernel plugs in through
  (`ModuleExtension`, `presenters()` among them), and a module stating only them is no longer taken for an
  extension.
- 5f1c3ca: A collector extends `Collect<User>` and a presenter `Present<Post>`, generic bases like `Repository<Post>`:
  `Collector(User)` and `Presenter(Post)`, called as functions, are gone with the views argument. The scan
  reads the erased argument, the statement writes it as a value, and a `frond()` written by hand states it —
  `{ ctor: CurrentUserCollector, collects: User }`, `{ ctor: PostPresenter, presents: Post }` — refused at
  boot when missing. What `collect()` refuses is read like `missing()`, and joins every op the collector serves.
- 87a261d: What stands around a frond's calls is a link in front of `Dispatcher`: `class Wrote implements
Partial<Dispatcher>`, asking for `inner: Dispatcher`, in `services/`, handed each call as its `Call`.
  Two are ordered by `ports: { Dispatcher: [...] }` in `frond.config.ts`, outside in. `Middleware`, the
  `middlewares:` order and `middleware-not-extended` are gone.

### Minor Changes

- f1d2704: A chain is read whole. What a link in front of `Collect<User>` refuses joins the `errors` of every op asking for a `User`, beside the collector's. GraphQL types the fields of a `Present<Post>` chain, the link's included (`presentedFields`). The names file quotes a port with a subject (`'Collect<User>'`), so `ports:` may choose one. A seated class is no longer reported as a port of itself. The CLI resolves its commands by address again, which the new facade keys had broken.
- 5b1ad11: `Dispatcher<PostHandler>` stands around that handler's calls alone, inside the frond's `Dispatcher`:
  `class PostAudit implements Partial<Dispatcher<PostHandler>>`, asking for `inner: Dispatcher<PostHandler>`.
- 5f1c3ca: A handler is a container key in its own frond: a class beside it asking for `PostHandler` is handed the
  instance its facade calls. Asked for from another frond, the boot refuses (`handler-of-another-frond`),
  pointing at `Facade<PostHandler>` — the bare handler skips validation, middlewares and placement.
- 10df4b0: Every container key with a subject is spelled as the type is written: `Repository<Post>`, `Storage<Post>`, `Facade<PostHandler>`, `Emit<PostPublished>`, `Emit<CanBook, Verdict>`, `Together<[Account, Ledger]>`, `Collect<User>`, `Present<Post>`. They used to be `PostRepository`, `PostStorage`, `postHandler`, `postPublishedEmit`, `canBookAwait`, `Account+LedgerTogether`, `UserCollector` and `PostPresenter`. A `fronds.ts` written by hand renames its `deps:` the same way. A class named `PostStorage` can no longer take a storage's key, so the `storage-key-is-provider` refusal is gone. A listener in a refusal is named by its address, `index.reindex`.
- 9d69fcd: A link may stand in front of a port without being one: `implements Partial<Payment>` with
  `constructor(private inner: Payment)` writes only what it changes, and every method it leaves out is
  the inner's, forwarded as it is built. The scan reads the clause TypeScript erases, the statement
  carries it as `implements`, and a `frond()` written by hand states it. Without the clause a class
  asking for a port is an ordinary service: a link is declared, never guessed. A class implementing a
  port without asking for it is still warned, `Partial<X>` included, naming the inner to take.
- 4da370e: `new Logger(inner)` takes the logger it stands in front of and writes with its line, carry and operation,
  so `class Masking extends Logger { constructor(inner: Logger) { super(inner) } }` loses nothing it leaves
  out. A name still makes a fresh one — `new Logger('app')`.
- 97fbc58: `sources:` lists `rows:` and `values:`, where it listed `entities:`. An entity in `values:` is
  injected as ONE value — `constructor(meili: Meili)` — read, completed by its defaults and judged at
  boot. `@fougere/adapter-env` reads it from `MEILI_URL`; a source holding rows keeps it as a
  `FougereValue` row, a file source as one file. The default source is the writable entry with no
  `rows:`; when every entry lists its rows, an entity left out refuses the boot.
- 08c7bc1: A value is read through `Env<Meili>`, the port a link stands in front of to change what a source gave:
  `class MeiliFromVault implements Partial<Env<Meili>>`, asking for `inner: Env<Meili>`, touches Meili
  alone. It is read once, at boot, and judged like what the source holds.
- 1ea472e: An app reads the nearest `fougere.config.ts`, up from where it runs, and its host's options
  override it — a workspace's file and an app's are no longer folded into one (`loadCascadedConfig`
  is gone, `loadNearestConfig` and `configFileNear` take its place). The `Config` builtin is gone too:
  a value the app reads is an entity listed in `values:`, injected and judged at boot.
- 6d694d1: An entry of `fronds:` is an object, never a string: `blog: { remote: 'http://…' }` for a frond that answers elsewhere, `'@fougere/log': { options: './lines.jsonl' }` for a module key. The string used to mean an address under one key and an argument under another; it now refuses, naming the object to write.
- d7cde0c: `Collect<User>` and `Present<Post>` are ports. A collector or a presenter realizes its key, and a link stands in front of either: `implements Partial<Collect<User>>` with `inner: Collect<User>`, or `implements Partial<Present<Post>>` with `inner`, whose methods are fields of its own. Two collectors of one type refuse with `port-implemented-twice` (`collector-ambiguous` is gone) and `ports:` settles them. A field two classes of one chain compute refuses with `presenter-field-twice`. `ModuleExtension`, its `install` and `steps`, and the `presenters` extension are gone: `app.extensions()` no longer lists `presenters`.
- 57ddbb7: A service extending `Repository<Post>` answers `Repository<Post>` whatever its name, beside its own — the way
  `StripePayment` answers `Payment`. It used to answer only when it was called `PostRepository`. Two such
  services refuse the boot (`repository-twice`).
- 9e17181: `fougere points` is `fougere ports`: each port of a frond with its links outside in and the realization they
  reach — `the rest of the call`, `the source`, said where no class is it — the class answering
  `Repository<Post>`, `Collect<User>` and `Present<Post>`, and `served at` for a frond another process serves.
- d4eab03: Two fronds may each declare an entity of one name: in one source they are two views of one table, its
  union, each reading and writing its own fields; a field declared two ways refuses the boot
  (`table-contradicted`). A GraphQL type is named after its frond first — `BlogPost`, `BlogPostList`,
  `CreateBlogPostInput` — always, so two fronds' `Author` are two types; root fields keep their names.
- 6b84cec: `collectors/`, `presenters/` and `repositories/` are no longer convention directories: every class a frond injects sits in `services/`, and what it extends says what it is — `Collect<User>`, `Present<Post>`, `Repository<Post>`. Move the files there; a class left in one of the three is not scanned, and `fougere check` names the directory. `conventions: { dirs }` loses the three keys, and `providerDirsOf` is gone.
- f7ccbed: `server: { use: [cors()] }` in `fougere.config.ts` stands srvx middlewares around what `fougere serve`
  answers beside its envelope — REST, GraphQL, and a request none of them claims, which a middleware
  may answer itself. Outside in, and never around the envelope its peers call. `serve()` takes the
  same list as `use`.

### Patch Changes

- Updated dependencies [97fbc58]
  - @fougere/schema@0.28.0-alpha.1

## 0.8.4-alpha.0

### Minor Changes

- A mirror resumes from the mark its caller kept, not from its own rows.

  `freshness()` read the newest `updated()` stamp, which says when WE wrote a row — a source
  compares `?since=` against its own clock and often never puts it on one. A pass that threw
  halfway still pushed the mark past its own gap, and the rows changed in between were never
  asked for again.

  `refresh(since?)` takes it. `freshness()`, `ageFieldOf()` and the refusal of a shape without
  an `updated()` field are gone with the reading that needed them, so a shape that dates
  nothing can be copied. `demos/mirror-catalog` keeps the mark in `PartnerCatalog` and moves
  it only after a pass returns.

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

- A boot that refuses releases what it took, from its first line — and a scope closes every
  sibling.

  `createApp` held the whole installation inline, 324 lines between reading the model and
  assembling the app, so its `try` could only open where `release` was already in scope: at
  the ascent. Everything before it opened sources and built storages and walked out holding
  them. `installFrond(frond, assembly)` names what a frond is put into — one container, one
  route table, one emission list — and `release` moved up beside the container, so before the
  app exists it runs the two levels that do.

  In the container, closing a child splices it out of `children` and the loop walked that same
  array: `[first, second]` released `second`, and `first` stayed open with whatever it held for
  the life of the process.

- A value is admitted and handed back in the domain's form, once.

  `validate`, then `null`, then `Boundary.decode` was written three times — the client facade
  and both of the storage guard's. `FieldValueValidator.parse` is the facade for the sequence,
  and the only judgement it carries is that `null` never reaches a codec.

  Two facades decode, which is the policy and not an oversight: the client one on what arrives,
  the guard on what a handler writes, because both hand the storage a parsed value. That asks
  the decoder for idempotence, which the shipped one happens to give on its first line and
  nothing required — `Decoder` says so now, and a test holds it.

  And a derived gesture writes through the store rather than the front facade: `upsertAll`
  reached `upsert` on `this`, so a caller that wrapped the port was traversed twice and a
  non-idempotent codec halved the row it stored.

- Four rules that were written twice, and the families that had no home.

  The surfaces a handler answers on — its own, or the default and every surface naming it
  without a facade of its own — was written in the effective model and again inline in the boot
  that registers the routes. They agreed on the rule and not on the name of the absence.
  `servedSurfaces` is where it lives, and `undefined` is the default surface as every key
  already spelled it.

  A presenter reads its binding plan when its façade is built, the way a handler already did:
  `computeBindingPlan` says of itself that it is decided once at boot and replayed per call,
  and the presenter rebuilt one per presentation from facts that were already settled.

  Two families were reaching down into a package root for a leaf that depends on nothing while
  the root reached back up into them — `storage` and the verdict's vocabulary. `core` keeps its
  storage port, its store frame and its criteria under `storage/`, an emission is a call and
  lives in `wire/`, and `schema` keeps `ValidationError` where `Registry` already was.
  Intra-package family cycles: core 5 → 2, schema 9 → 6, and what is left is stated.

- 771e703: The type a projection dispatches on, named once and imported from the standard.

  Nine places re-derived the same partition of shapes — two in `@fougere/app`'s form, one in
  `@fougere/core`'s criterion, five in `@fougere/adapter-sql`, one in `@fougere/cli` — and it
  had already diverged twice: `controlOf` had no `object|array` branch that its twin
  `renderOf` carries, and `pothos.ts` documents its own bug, a bounded set falling through to
  `String`.

  `Shapes.typeOf(shape)` answers `ShapeType`, which is `JSONSchema7TypeName` from
  `@types/json-schema` less `null` — a shape states that as the `[T,'null']` union — with
  `string` in the three forms this package actually tells apart: `date`, `choice`, `text`.
  Those three are the whole of what is ours; the rest is the standard's, and a type assertion
  fails the build if `SHAPE_TYPES` and the standard ever part ways.

  `Shapes.isNullable` stays: nullability is not a type, it is the other half of `Shapes.of`.

  `@fougere/app`'s two cascades are now `Record<ShapeType, …>` tables, which no longer compile
  if a type is left out. `@fougere/adapter-sql` and `@fougere/cli` still hold theirs.

- Updated dependencies [26f7987]
- Updated dependencies
- Updated dependencies
- Updated dependencies [32923e6]
- Updated dependencies
- Updated dependencies [771e703]
  - @fougere/schema@0.9.0-alpha.1
  - @fougere/container@0.8.3-alpha.1

## 0.8.3-alpha.0

### Patch Changes

- `handler-declaration` names the two addresses instead of describing one of them.

  It said "a module beside its entities" while `outside-convention` — the same question one
  file higher — said `rules/`. Two messages, one rule, and the reader was left to invent a
  place: inventing one is the drift both report. Both now read the names in force, so a
  project that restated `rules/` sees its own word.

- The provider scan's refusal names `rules/` too. It said "move it beside the directory, at
  the frond's root" — which is where `outside-convention` now reports a module, so the two
  messages sent a reader back and forth. Found by an agent given the check's output and
  nothing else: it followed one message into a blocking error, and the error sent it back.

## 0.8.2-alpha.0

### Minor Changes

- fb256c1: A frond's directories are a closed list, and `rules/` is the ninth.

  The eight names were closed for READING and open for writing: a scan steps over a
  directory it does not know, in silence, so an invented one was never refused — it was
  unseen. `rules/` names what the domain computes with nothing injected — a threshold, a
  formula, a word list. It is read into the type program, because a handler names one of
  its types in a signature, and it registers nothing: no class there answers a container
  key. `outsideConventions` reports what still sits outside them, naming the addresses
  rather than describing them.

  `Conventions.dirs` gains a required key. `ConventionsInput` stays partial, so no
  `fougere.config.ts` is affected.

- c1ad40c: A handler declares nothing but its handler.

  `handlerDeclarations` reads what a handler file holds besides its class and says where it
  goes, by the one question that separates the natures: does it arrive INJECTED or
  IMPORTED? Measured on one application: 15 declarations in three handlers, and zero in
  the five others — the destination already existed, the code drifted anyway.

## 0.8.1-alpha.0

### Patch Changes

- 9d24851: A stated collector is keyed the way a binding looks one up. The scan writes `lowerFirst`
  of the type it answers for, `frond()` wrote the class name as-is, and the boot asks for
  the key `computeBindingPlan` derives from a parameter's type — which is lowerFirst. So a
  host booting from a written statement held `User` while every lookup asked for `user`: a
  handler taking one fell through to the request input, and the boot refused a contract it
  had everything to resolve.

  Measured on `demos/nuxt-blog` with its hand-written `fronds.ts` set aside: `publish`,
  `mine` and `searchByTitle` answer.

## 0.8.0-alpha.0

### Minor Changes

- 34fbd31: A criterion can compare. `where` knew equality and membership, while nearly everything
  worth filtering on is a range — land over 1 500, price under 400 000, built after 1900 —
  and the only way out was `storage.client`, the path with no judge and no codecs.

  `gte`, `lte`, `gt`, `lt`, `ne`, `between`, `contains`, `notIn` and `isNull`. `eq` and `in`
  are deliberately absent: a bare value already means equality and an array already means
  membership, and a second spelling would make one criterion sayable two ways.

  A comparison is told from a value that IS an object by the FIELD, never by the criterion:
  `json()` admits any shape, so reading the criterion would make a stored object
  unfilterable the day its keys happened to spell an operator. Both realizations compile it
  — SQL and the store the memory and file adapters derive from — and a misspelled comparison
  is refused rather than dropped.

- ae49d25: A migration says what it declined to change. The pass is additive by design — it creates
  what is missing and never touches a column that exists — which is a promise worth keeping
  and a silence worth breaking: relax a `required` field and the table keeps its NOT NULL,
  so the write fails on a row, in production, long after the boot that could have named it.
  Measured twice on a real app, once as `CHECK constraint failed` and once as `NOT NULL
constraint failed`, both with a green boot.

  `Source.migrate` may now answer with what it found, and the boot voices it — the shape
  `seeding(report)` already had. `SchemaState` stays a set of names on purpose: `done()`
  reads it to decide whether a frozen step was applied, and a wider one would make a
  replayed migration answer wrong.

### Patch Changes

- 6ec8e59: A provider's container key is written down. It was read at boot off `ctor.name`, which
  held until a bundler lowered a `static readonly` field and renamed the declaration doing
  it: the provider registered as `_Communes` and every handler asking for `Communes` met a
  container miss. The scan reads the name from source, both emitters write it, and
  `ctor.name` answers only where nobody wrote it down.

  Measured on a real app: five operations depending on renamed providers answer with no
  bundler setting at all.

- 2478927: A statement carries the operations the scan read. `frond()` posted an empty Map, so a
  host booting from a written statement — which is what `@fougere/nuxt` hands its runtime —
  served a prefab's five CRUD ops and nothing an author had written. The scan reads a
  method's contract from source and a class carries none of it at runtime, so the statement
  is where it has to survive; `emitStatement` now writes it, beside the `deps` it already
  wrote for the same reason.

  A prefab's own `__ops` still answer, and a method written over one wins.

- 525b53e: An operation contract is written down in one place. `emitScan` held the serializer for
  contracts and schema references; `emitStatement`, which the Nuxt module writes from, held
  none and carried no operations at all. The half they can share now lives beside them,
  asking of each emitter's imports only what it needs: an alias for a value already
  imported, a named import, and the entity a class name belongs to.

  No output changes — a real scan renders byte for byte what it did before.

- 089ebb9: A statement carries what `frond.config.ts` states. The file is read BY the scan, so a
  host booting from a written statement never saw it — and it is the only answer for the
  kind of an operation whose name leads with no known verb, and for a method inherited from
  an installed base class. Renaming a method to please the scan was the workaround; the
  right word can stay now.
- f9b5837: The facade check asks for an operation someone wrote. It asked `post.list` — a prefab op,
  whose contract is a static that survives any build — and called the facade fine while every
  hand-written operation of a fresh project went unserved. `post.listPublished` is read
  from source at scan time and carried by nothing at runtime, so it answers only when the
  statement the host boots from carried it across.
- 6d9034d: Three small ones, each a silence.

  A relative `db.path` is counted from the config that named it, not from whoever is
  running. `apps/nuxt` runs from its own directory and made a SECOND, empty database beside
  itself while the workspace held the real one — nothing said, every table created, the
  seeds run, an empty domain served with a green boot. `resolveStorage` takes a root;
  `:memory:` and absolute paths pass through untouched, and the one case where the two
  disagree is named rather than acted on silently.

  A fresh project pins the version that scaffolded it. `latest` reads as "whatever is
  current" and is not: pnpm answers from a metadata cache, and a fresh project installed
  0.6 while the registry said 0.7.

  And a convention directory that refuses a file says where it belongs — measured twice on
  one project, both times a shared contract that had to move and nothing to say where.

- c5f5791: A web host applies the config it read. `applyConfig` had one caller, `boot()`, and the
  front-end hosts reach `createApp` directly — so `logLevel:` was read and never acted on.
  Its default now keeps the level the process already has, instead of raising every caller
  to `debug`; and the Nuxt module says so when Nitro's console would drop that level.
- 4287ac9: A filter is judged the way a write is. `where` was the one entrance to the read port with
  no judge at all — a field the entity does not declare passed, and so did a value the field
  would refuse on the way in — while the admin facade copies a browser's filter into it
  verbatim. A criterion may still name a set, which is the one thing the write facade refuses:
  an array is judged member by member, since that is what `IN` binds.

  And a filter on a field the facade does not hand back is SAID, not refused: `output(schema)`
  narrows what is returned and has never narrowed what is asked, so refusing it today would
  break a GraphQL relation batch on the way to closing a hole. Measured across the
  repository: zero warnings, which is what a refusal will need before it can be one.

## 0.7.0-alpha.0

### Minor Changes

- `fougere check` reports an adapter name no dependency answers to.

  A process only knows the adapters it loaded, so an entity stating a Postgres column type
  in an app running on `adapter/memory` cannot be told from a typo. The project can: its
  dependencies name every adapter it could load. `adaptersOf` reads them, the finding is
  `unknown-adapter`, and four real demos report zero.

### Patch Changes

- A realization may narrow the port, and the container key does not move.

  `depKeyOf` compared the type name to `Storage` exactly, so a handler asking for
  `RankedStorage<Card>` asked the container for `RankedStorage` and the boot refused. The
  subject is in the GENERIC. A class named `FileStorage` carries none and is untouched.

- 7376ae7: A composite unique constraint belongs to the schema it constrains, not to each of its
  members.

  `FieldGroup` and `Unique` are gone from the public surface. A field carries
  `role.unique` as a boolean, read through `Role.of(field).isUnique`; a group spanning
  several fields lives once in `SchemaConstraints`, answered by `getUnique()` as before.
  The wire format is unchanged in both directions, pinned byte for byte by the v1 fixtures.

  With the sentinel gone — `unique()` no longer writes an empty group waiting to learn its
  key — `FieldGroup.isSelf`, `resolvedOn`, `Role.resolvedOn` and `Field.rename` had nothing
  left to do.

- Six guarantees the code declared and did not hold.

  `output(schema)` filtered nothing on the memory frame — `storageOver` now applies the
  scope SQL puts in its SELECT, on both realizations. A composition read the DEFAULT
  source's transaction for every source; `transacts(source)` answers for the one the work
  runs in, so a frame whose own engine has transactions is no longer compensated. A refused
  ascent released nothing the boot had taken: `onDispose` is handed over before the ascent,
  since the caller never receives the app that would carry it back. `StorageGuard` skipped
  `upsert` and `upsertAll` and handed on the value it had not parsed. A migrated table
  promised less than a fresh one — `changeSQL` states `notNull()` whether or not a default
  fills the column, and `delta` proposes the UNIQUE index a live table never read. And the
  data layer travels as ONE subject, `FougereServerConfig.storage`, which naming a few of
  its members had left `transacted` and `close` behind, under Nuxt only.

- The unwind's check reported a detection it cannot make.

  It catches a write that landed before the re-read; one that lands after is overwritten
  unseen, because reading and restoring are two statements and a frame exists precisely
  where no engine can make them one.

- Updated dependencies
- Updated dependencies
- Updated dependencies [7376ae7]
- Updated dependencies
- Updated dependencies [47513d2]
  - @fougere/schema@0.6.0-alpha.1

## 0.6.0-alpha.0

### Minor Changes

- 8f390d0: A place rows live is a `Source`, and what realizes it is named in the config.

  **Four gestures, and the absence answers.** A `Source` states `storageFactory` (required),
  `migrate?`, `transacted?` and `close?`. What it is MADE OF is not there: `adapter/sql` keeps
  `dialect`, `db` and `sink` on its own `SqlSource`, reached by narrowing — the rule
  `Storage.client` already obeyed one level down. A source that hands out no transaction makes a
  `Together<[…]>` compensate instead of transacting, and the boot says which of the two it built,
  per frame.

  **The migration is the source's own gesture.** The router hands each source what lives there
  plus the names of what does not; a source knows its own engine. This fixes a real defect: every
  source was migrated as `'sqlite'`, the documented Postgres case included, because the router
  passed no dialect.

  **`source:` names the adapter.** `dialect` stays SQL's property, read by the only package that
  knows what it is worth — the shape `adapters:` already has on an entity. An adapter answers a
  name by registering at import, so nothing central lists them, and a name nothing answers is
  refused saying what this process does answer. The refusal "only `sqlite` resolves from a name"
  moved to `@fougere/adapter-sql`, where the reason is true.

  **Thirteen gestures from four.** `storageOver` derives the whole storage port from a `Rows`
  (`get`/`has`/`set`/`delete`/`all`/`client`). Measured on the Map realization: 14 lines of 140
  touched the store; the rest — pages, criteria, lifecycle stamps, the two refusals a `create`
  owes its caller — is the same wherever rows live. Writing a source is now four gestures, not
  thirteen.

  **Two new adapters.** `@fougere/adapter-memory` (rows in a Map, 37 lines, and the fallback an
  app with no `db` already ran on) and `@fougere/adapter-file` (one JSON per row, a directory per
  entity, `migrate` being a `mkdir`). They replace three divergent hand-written copies in the
  demos, each of which answered six of the thirteen gestures, forced the field name `id` and
  minted a uuid whatever the entity declared.

  **Renamed.** The cross-source reader a handler injects is `Reads`, not `Sources` — it is
  declared by `reads:` and reads over sources rather than being them. `ResolvedStorage.raw` and
  `.dialect` are gone: zero and one reader respectively.

- 5076973: One frond, five hosts — and the declarations that did not keep their promise are gone.

  **Five hosts, one frond, byte-identical.** The half of a Nuxt app that was never Nuxt now
  lives in `@fougere/app`, and each UI framework gets its own package: `@fougere/react`,
  `@fougere/svelte`, `@fougere/next`, plus `@fougere/vite` — one plugin serving three hosts.
  Express joins as an adapter, being the one host that is not Web-standard. The same frond
  runs under all of them without a line changed.

  **Breaking**

  - `@fougere/container-fougere` is gone. Its implementation moved into `@fougere/container`,
    which now exports `createContainer` alongside the `Container` type. The port never had a
    second adapter, and the scan knows the graph before boot, so what was left to bind late is
    a Map, a scope and a resolver of last resort. Update the import and drop the dependency.
  - `auto()` is now `created()`. Its dual `updated()` is literally built on it and names its
    moment; this one said "the server fills it" without saying when. Every template already
    spelled it `createdAt: auto()`.
  - `validateFields(fields, input, opts)` — the `pathPrefix` parameter is removed, so `opts`
    moves from the fourth position to the third. Every caller passed `''`: it was a parameter
    for a recursion nobody wrote, and it made the code read as if nested paths were handled.
  - A named boundary codec that no one registered now **throws** instead of converting as
    identity. A frond declaring `{ decode: 'celsius' }` against a consumer that never called
    `registerDecoder` used to receive the value unconverted while the card said otherwise. One
    axis, two spellings, one failure mode — the alias form already threw.
  - `OperationOverride.policy` is removed from `frond.config.ts`'s type. It had no reader at
    all, so setting it did nothing, silently.
  - `graphql` and `@pothos/core` are optional peers of `@fougere/app` rather than dependencies:
    an app that serves no GraphQL no longer installs them.
  - An adapter is published by the app, not mounted by the host.
  - Express surfaces are middlewares, because that is what an Express app speaks.

  **Fixed**

  - `@fougere/nuxt` declares the `h3` its runtime has always imported — seven imports across six
    server files, resolvable from nothing but Nitro's build.
  - `@fronds/<name>` resolves in the scan: two entry points were loading a neighbour's sources
    without the alias map.
  - A `list` op reaches GraphQL with its pagination arguments, and `required` no longer demands
    what the facade refuses.
  - `count` applies its own filter; the identity card reports an operation's overridden kind.
  - `presenterFor` is the dual `facadeFor` already had.
  - An operation's doc sentence now reaches both REST and GraphQL, instead of being dropped in
    each adapter's narrowed view of the same contract.
  - `dispose()` disposes: it used to clear the registry while its own doc promised to release
    the singletons it held, and `await using app` routed straight to it. Failures are collected
    rather than swallowed at the first one.

  **Also**

  Keywords so an adapter is found by the library it adapts; one id generator instead of two
  majors of it; and a mechanical floor in CI — oxlint, knip and v8 coverage, recorded rather
  than gated.

- cf5b52e: Apply decoded inputs and declared outputs at the facade boundary, harden public transports,
  correct HTTP and GraphQL semantics, and make scaffolds and published artifacts reproducible.
- 6f08e19: An entity's rows live where the app says, and reading across those places is one query.

  **Several sources.** `sources:` names the places that are not the default one, and the
  entities that live there. An app with one database declares nothing and behaves exactly as
  before. A source may also be an engine the caller built, so a pool Fougere did not open is
  still a place rows can live.

  **Reading across them.** `@fougere/adapter-duckdb` is new: a frond that declares `reads:`
  receives a cross-source reader, and one SQL query spans what can be attached. Measured
  before it was written — attaching Postgres pushes the filter down over 100 000 rows, so a
  real database is queried where it is and never copied. It is not a query builder and never
  sits on the ordinary read path: at page size it is ~100× slower than two indexed reads.

  **Reading a set, not a row at a time.** `findByKeys` answers a Map, and its dual answers
  the rows that point at each key — both directions of a relation, each in one query. A
  GraphQL relation is now read once per page instead of once per row.

  **Writing a page.** `upsert` and `upsertAll` write the row or make the existing one look
  like this, in one statement. `Mirror(Shape)` builds on both: a local copy of rows that live
  somewhere this app cannot query, where the subclass supplies only the pull. A shape with no
  `updated()` field is refused at the declaration — a copy that cannot say when it was pulled
  reads exactly like live rows.

  **Breaking**

  - `shapeTypeOf` is no longer exported from `@fougere/schema`. It is internal machinery
    above the judge; `entitySourceOf` is what a consumer calls.
  - A field declaration is judged on all five axes rather than the shape alone, so a
    malformed `lifecycle`, `role` or `boundary` is refused at `entity()` instead of at the
    first call that trips over it. Declarations that were already correct are unaffected.
  - A named `format` predicate that no one registered is refused by name.

- 934d74d: Go to definition lands on the code, not on a `.d.ts`.

  Every package compiles with `declarationMap`, so each `.d.ts` shipped a map pointing at
  `../../src/…` — and `"files": ["dist"]` left that target behind. The map resolved to
  nothing, in every editor, for every consumer. `src` is published now.

  Measured on `@fougere/core`: 233 → 334 kB packed, 854 kB → 1.3 MB unpacked. That is still
  below `kysely` (1.7 MB), which the same install pulls in anyway. What it buys is that a
  reader who follows a symbol arrives in the commented source rather than in a stripped
  signature — and in this codebase the comments carry the reasoning.

### Patch Changes

- b1e1133: An edge bundle no longer drags `node:path` in through `frond()`.

  `frond()` sits in `index` so an app can state what it hosts without a scanner, and it
  reached `conventions.ts`, whose one `join` put `node:path` in front of esbuild — which
  refused the Worker by name. `watchPathsOf` turns convention names into disk paths, so it
  now sits beside the scan that reads them.

- 8f21270: Nothing downloads or compiles when you install.

  `better-sqlite3` moves to 13, which carries its prebuilt binaries inside the tarball
  (`prebuilds/darwin-arm64.node`, `linux-x64`, `linuxmusl`, `win32-arm64`, …). Version 12
  fetched one at install time through `prebuild-install`, a package that is no longer
  maintained and that printed a deprecation warning on every `create fougere`.

  Measured on a bare install: no deprecation line, no `build/` directory, no `node-gyp`, no
  Python, 9.6 s — and it works offline, which the download never did.

  The scaffold templates move with it, since that is where a new app met the warning.

- Updated dependencies [5076973]
- Updated dependencies [cf5b52e]
- Updated dependencies [8f21270]
- Updated dependencies [6f08e19]
- Updated dependencies [934d74d]
  - @fougere/container@0.5.0
  - @fougere/schema@0.5.0

## 0.5.0-alpha.1

### Minor Changes

- 934d74d: Go to definition lands on the code, not on a `.d.ts`.

  Every package compiles with `declarationMap`, so each `.d.ts` shipped a map pointing at
  `../../src/…` — and `"files": ["dist"]` left that target behind. The map resolved to
  nothing, in every editor, for every consumer. `src` is published now.

  Measured on `@fougere/core`: 233 → 334 kB packed, 854 kB → 1.3 MB unpacked. That is still
  below `kysely` (1.7 MB), which the same install pulls in anyway. What it buys is that a
  reader who follows a symbol arrives in the commented source rather than in a stripped
  signature — and in this codebase the comments carry the reasoning.

### Patch Changes

- An edge bundle no longer drags `node:path` in through `frond()`.

  `frond()` sits in `index` so an app can state what it hosts without a scanner, and it
  reached `conventions.ts`, whose one `join` put `node:path` in front of esbuild — which
  refused the Worker by name. `watchPathsOf` turns convention names into disk paths, so it
  now sits beside the scan that reads them.

- Updated dependencies [934d74d]
  - @fougere/container@0.5.0-alpha.1
  - @fougere/schema@0.5.0-alpha.1

## 0.2.0-alpha.2

### Minor Changes

- 6f08e19: An entity's rows live where the app says, and reading across those places is one query.

  **Several sources.** `sources:` names the places that are not the default one, and the
  entities that live there. An app with one database declares nothing and behaves exactly as
  before. A source may also be an engine the caller built, so a pool Fougere did not open is
  still a place rows can live.

  **Reading across them.** `@fougere/adapter-duckdb` is new: a frond that declares `reads:`
  receives a cross-source reader, and one SQL query spans what can be attached. Measured
  before it was written — attaching Postgres pushes the filter down over 100 000 rows, so a
  real database is queried where it is and never copied. It is not a query builder and never
  sits on the ordinary read path: at page size it is ~100× slower than two indexed reads.

  **Reading a set, not a row at a time.** `findByKeys` answers a Map, and its dual answers
  the rows that point at each key — both directions of a relation, each in one query. A
  GraphQL relation is now read once per page instead of once per row.

  **Writing a page.** `upsert` and `upsertAll` write the row or make the existing one look
  like this, in one statement. `Mirror(Shape)` builds on both: a local copy of rows that live
  somewhere this app cannot query, where the subclass supplies only the pull. A shape with no
  `updated()` field is refused at the declaration — a copy that cannot say when it was pulled
  reads exactly like live rows.

  **Breaking**

  - TypeScript generation belongs to `EntityTypeSource` and `FacadeTypeSource`; the shape
    renderer stays private to the entity source.
  - A field declaration is judged on all five axes rather than the shape alone, so a
    malformed `lifecycle`, `role` or `boundary` is refused at `entity()` instead of at the
    first call that trips over it. Declarations that were already correct are unaffected.
  - A named `format` predicate that no one registered is refused by name.

### Patch Changes

- Updated dependencies [6f08e19]
  - @fougere/container@0.2.0-alpha.2
  - @fougere/schema@0.2.0-alpha.2

## 0.2.0-alpha.1

### Patch Changes

- Nothing downloads or compiles when you install.

  `better-sqlite3` moves to 13, which carries its prebuilt binaries inside the tarball
  (`prebuilds/darwin-arm64.node`, `linux-x64`, `linuxmusl`, `win32-arm64`, …). Version 12
  fetched one at install time through `prebuild-install`, a package that is no longer
  maintained and that printed a deprecation warning on every `create fougere`.

  Measured on a bare install: no deprecation line, no `build/` directory, no `node-gyp`, no
  Python, 9.6 s — and it works offline, which the download never did.

  The scaffold templates move with it, since that is where a new app met the warning.

- Updated dependencies
  - @fougere/container@0.2.0-alpha.1
  - @fougere/schema@0.2.0-alpha.1

## 0.2.0-alpha.0

### Minor Changes

- 5076973: One frond, five hosts — and the declarations that did not keep their promise are gone.

  **Five hosts, one frond, byte-identical.** The half of a Nuxt app that was never Nuxt now
  lives in `@fougere/app`, and each UI framework gets its own package: `@fougere/react`,
  `@fougere/svelte`, `@fougere/next`, plus `@fougere/vite` — one plugin serving three hosts.
  Express joins as an adapter, being the one host that is not Web-standard. The same frond
  runs under all of them without a line changed.

  **Breaking**

  - `@fougere/container-fougere` is gone. Its implementation moved into `@fougere/container`,
    which now exports `createContainer` alongside the `Container` type. The port never had a
    second adapter, and the scan knows the graph before boot, so what was left to bind late is
    a Map, a scope and a resolver of last resort. Update the import and drop the dependency.
  - `auto()` is now `created()`. Its dual `updated()` is literally built on it and names its
    moment; this one said "the server fills it" without saying when. Every template already
    spelled it `createdAt: auto()`.
  - `validateFields(fields, input, opts)` — the `pathPrefix` parameter is removed, so `opts`
    moves from the fourth position to the third. Every caller passed `''`: it was a parameter
    for a recursion nobody wrote, and it made the code read as if nested paths were handled.
  - A named boundary codec that no one registered now **throws** instead of converting as
    identity. A frond declaring `{ decode: 'celsius' }` against a consumer that never called
    `registerDecoder` used to receive the value unconverted while the card said otherwise. One
    axis, two spellings, one failure mode — the alias form already threw.
  - `OperationOverride.policy` is removed from `frond.config.ts`'s type. It had no reader at
    all, so setting it did nothing, silently.
  - `graphql` and `@pothos/core` are optional peers of `@fougere/app` rather than dependencies:
    an app that serves no GraphQL no longer installs them.
  - An adapter is published by the app, not mounted by the host.
  - Express surfaces are middlewares, because that is what an Express app speaks.

  **Fixed**

  - `@fougere/nuxt` declares the `h3` its runtime has always imported — seven imports across six
    server files, resolvable from nothing but Nitro's build.
  - `@fronds/<name>` resolves in the scan: two entry points were loading a neighbour's sources
    without the alias map.
  - A `list` op reaches GraphQL with its pagination arguments, and `required` no longer demands
    what the facade refuses.
  - `count` applies its own filter; the identity card reports an operation's overridden kind.
  - `presenterFor` is the dual `facadeFor` already had.
  - An operation's doc sentence now reaches both REST and GraphQL, instead of being dropped in
    each adapter's narrowed view of the same contract.
  - `dispose()` disposes: it used to clear the registry while its own doc promised to release
    the singletons it held, and `await using app` routed straight to it. Failures are collected
    rather than swallowed at the first one.

  **Also**

  Keywords so an adapter is found by the library it adapts; one id generator instead of two
  majors of it; and a mechanical floor in CI — oxlint, knip and v8 coverage, recorded rather
  than gated.

### Patch Changes

- Updated dependencies [5076973]
  - @fougere/container@0.2.0-alpha.0
  - @fougere/schema@0.2.0-alpha.0

## 0.1.0-alpha.0

### Minor Changes

- cf5b52e: Apply decoded inputs and declared outputs at the facade boundary, harden public transports,
  correct HTTP and GraphQL semantics, and make scaffolds and published artifacts reproducible.

### Patch Changes

- Updated dependencies [cf5b52e]
  - @fougere/container@0.1.0-alpha.0
  - @fougere/schema@0.1.0-alpha.0
