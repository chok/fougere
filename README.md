<div align="center">

# 🌿 Fougere

**Declare a business object once. Everything else is derived.**

A TypeScript framework where one entity class is the source of truth — and where
moving a domain to another machine is one line of config, not a rewrite.

[![CI](https://github.com/chok/fougere/actions/workflows/ci.yml/badge.svg)](https://github.com/chok/fougere/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](#)
[![Status](https://img.shields.io/badge/status-pre--release-orange.svg)](#where-it-stands)

</div>

---

## The shape you write four times

Every app does this. A post has a title, at most 160 characters. You say so to the
validator, to the database, to the form, and to TypeScript — and then you keep those
four sentences agreeing with each other, by hand, forever.

```ts
// schemas/post.ts — the shape, first time
export const postSchema = z.object({ title: z.string().min(1).max(160) });

// server/db/schema.ts — the shape, again
export const posts = sqliteTable('posts', { title: text('title').notNull() });

// server/api/posts.post.ts — wired by hand
const body = postSchema.parse(await readBody(event));

// app/components/PostForm.vue — the rules, again
const rules = { title: [required, maxLength(160)] };
```

The bug is never in one of those files. It's in the day two of them stopped agreeing.

## The shape you write once

```ts
// fronds/blog/entities/Post.ts
export default class Post extends entity({
  id: primary(),
  slug: text({ min: 1, max: 80 }),
  title: text({ min: 1, max: 160 }),
  summary: optional(text({ max: 300 })),
  // Server-owned: stamped from the session at create, never client-written.
  authorId: readOnly(text()),
  // Born draft, flipped by the publish OPERATION — never by a client
  // writing the field. readOnly closes the inbound door.
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
  publishedAt: readOnly(optional(date())),
}) {}
```

Derived from it, with nothing to keep in sync:

| | |
| --- | --- |
| **Validation** | the same judge in the browser and at the façade — unknown keys refused |
| **Storage** | the SQL table and its migrations |
| **Forms** | `useFormFor(Post)` — fields, rules, per-field error mapping |
| **API surface** | `post.list`, `post.create`, `post.publish`… |
| **GraphQL** | `type Post { … }` and its inputs |
| **Types** | the class *is* the type |

That's the first idea: **single-schema**. A field carries four axes — its shape, its
role, its lifecycle (*who* writes this value and *when*) and its boundary (which
direction it may cross). `readOnly` above isn't a comment about intent; it removes
the field from the inbound door.

## The second idea: the gradient

A **Frond** is a domain — its entities, its handlers, its collectors, its seeds.
It runs inside your app's process, or in its own process behind JSON-RPC, and the
code that consumes it does not change. Not "barely changes". Does not change.

```ts
// fougere.config.ts — the entire topology statement
export default defineFougere({
  db: { dialect: 'sqlite', path: '.data/site.db' },
  remotes: { blog: 'http://blog-node:4100' },  // delete this line → same app, in-process
});
```

```ts
// app/pages/blog/index.vue — identical either way
import Post from '@frond/blog/entities/Post';

const { items } = await useQuery(Post, 'list');
const publish = useCommand(Post, 'publish');

await publish.execute({ params: { id } });   // every mounted query on Post revalidates
```

Split, the host going down is a typed `503` in your pages, not a stack trace. It
comes back, the pages recover.

## Rules are operations, not field writes

The interesting part of a domain is never `update()`. It's the transition — and a
transition has a judge.

```ts
export default class PostHandler extends Crud(Post) {
  /** Judge: the author, a draft, a body worth publishing. Realize: stamp the pair. */
  async publish(id: string, user: User | null): Promise<Post> {
    const author = requireUser(user, 'publish');
    const post = await requireOwn(this.orm, id, author, 'publish');

    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published', entity: 'post', operation: 'publish' });
    }
    if (!post.body?.trim()) {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Cannot publish an empty draft', entity: 'post', operation: 'publish' });
    }

    return this.orm.update(id, { status: 'published', publishedAt: new Date() });
  }
}
```

`publish` is now an operation on the wire, a `useCommand` in the browser, a GraphQL
mutation and a REST route. You declared none of those.

## A Frond does not have to be TypeScript

[`demos/rust-frond`](./demos/rust-frond) is a `telemetry` domain written in Rust. There
is no `class Sensor extends entity({…})` anywhere in that demo — the declaration lives
in `src/main.rs`. The frond honours two contracts, and both are JSON: the wire
(JSON-RPC 2.0 at `POST /_fougere/call`) and the map (`rpc.discover`, which returns what
it hosts, schemas included).

The consumer asks for the map, rebuilds a **live** schema from it, and refuses a bad
payload before any network happens:

```
✗ couleur  — Unknown field
✗ celsius  — 250 is greater than 80.
✗ checksum — Read-only
```

The language, the storage and the judge belong to the frond. Everything else is the
contract.

## Try it

```bash
git clone git@github.com:chok/fougere.git && cd fougere
pnpm install
pnpm -r --filter './packages/**' build

pnpm -C site dev                   # :3000 — the site, built with Fougere
```

The site is the fullest thing to read: its blog is a real Frond with a judged
draft→publish, its docs are the reference, and it is itself the proof of the claim.

Then watch the gradient move:

```bash
pnpm -C demos/nuxt-blog dev:blog   # the blog Frond alone, in its own process (:4100)
pnpm -C demos/nuxt-blog dev        # the Nuxt app that consumes it (:3000)
```

Comment out `remotes:` in `demos/nuxt-blog/fougere.config.ts` and run only the second
command. Same app, same code, one process.

To start your own:

```bash
node packages/cli/dist/bin.js new my-app --frond blog:catalogue --app nuxt:web --local
```

## Where it stands

**Pre-release.** The packages are not on npm yet, so a Fougere app lives as a pnpm
workspace next to the framework (`--local` above wires it). What follows has been
seen running, not planned:

- the five client primitives (`useQuery`/`useCommand`, `useFormFor`, `useCurrentUser`,
  `invoke`) are the only path — there is no escape hatch to maintain;
- a judged business feature (draft→publish) exercised in a browser;
- the split lived daily: host killed → typed `503` in the pages, restarted → recovery;
- identical user code in-process and split, all the way through a production build;
- [this site](./site) — landing page, docs and blog — is a Fougere app.

Known limits, stated plainly, because you'd find them anyway:

- **storage** is SQLite with auto-DDL today; the other dialects exist in `schema-sql`
  but are not the walked path;
- **a computed field costs one read per row** — name a view for the operation
  (`Crud(Post, { list: PostCard })`) or batch in the handler;
- **a split link is loopback-only**: the receiving side trusts the identity it is
  handed, so do not expose `serve()` beyond `127.0.0.1`;
- the full list lives in [`CLAUDE.md`](./CLAUDE.md#known-issues), kept honest rather
  than short.

## The repo

| | |
| --- | --- |
| [`packages/schema`](./packages/schema) | `entity()`, the field vocabulary, the four axes, validation |
| [`packages/schema-sql`](./packages/schema-sql) · [`-graphql`](./packages/schema-graphql) · [`-rest`](./packages/schema-rest) | the projections — Kysely tables, Pothos types, REST routes |
| [`packages/core`](./packages/core) | the scanner, the call contract, `Crud`, bootstrap |
| [`packages/transport`](./packages/transport) | the JSON-RPC 2.0 wire — it moves the call, never reshapes it |
| [`packages/fougere-nuxt`](./packages/fougere-nuxt) | the client primitives and the server surface |
| [`packages/auth-better`](./packages/auth-better) · [`container`](./packages/container) · [`cli`](./packages/cli) | auth translation, DI, the scaffolder |
| [`site/`](./site) | the site of Fougere, built with Fougere |
| [`demos/`](./demos) | `nuxt-blog` is the flagship; the others isolate one idea each |

## Docs

Reference documentation lives in [`site/content/`](./site/content) (English and French),
and reads best served — `pnpm -C site dev`.

- [Philosophy](./site/content/en/docs/2.concepts/1.philosophy.md) — the model, and why it is shaped this way
- [Entities and the four axes](./site/content/en/docs/3.schema/1.entities.md) — the field vocabulary
- [The gradient](./site/content/en/docs/6.infra/1.gradient.md) — in-process, split, and what stays identical
- [Adopting it in an existing app](./site/content/en/docs/02.existing-app.md) — feature by feature, honestly priced

---

<div align="center">
<sub>MIT · built by <a href="https://github.com/chok">chok</a></sub>
</div>
