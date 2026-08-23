# multi-frond — importing a frond that lives somewhere else

Two apps. `remote-blog` hosts the `blog` frond and serves its identity card on
`rpc.discover`. `consumer` hosts its own `catalog` frond locally and imports
`blog` from the wire — and the import reads the same either way:

```ts
import Post from '@fronds/blog/entities/Post';   // generated from remote metadata

const CreatePost = Post.omit('id', 'createdAt');
```

`sync` is what makes that import resolvable: it asks the remote for its card and
writes real Entity files under `.fougere/remotes/blog/`. Validation, `pick`/`omit`,
Standard Schema — all identical to a local frond, because the schema was rebuilt,
not stubbed.

## Run it

Three terminals, in order — each step needs the one before it.

```bash
pnpm remote     # the blog host, :4001
pnpm sync       # asks :4001 for its card, generates @fronds/blog
pnpm dev        # the consumer, :3002
pnpm test       # or: the whole exchange, headless
```

## Why there is no `build`

`consumer` has `build:synced`, not `build`. Its build is only meaningful once
`sync` has run, and `sync` needs a live host on `:4001` — so a recursive build
across the monorepo has no server to ask and would fail by design. The name says
the precondition instead of hiding it.
