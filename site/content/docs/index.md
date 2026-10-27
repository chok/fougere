---
title: What is Fougere
description: You write your data and what your app does. Fougere writes the rest, and lets you move any part to another process without touching it.
---

# What is Fougere

You write your data and what your app does with it. Fougere writes the rest: the table,
the validation, the API, the forms, the typed client, the tests. And any part of your app
can later run in its own process without a line of your code changing.

## What you write

A post, in a blog:

```ts
// fronds/blog/entities/Post.ts
export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 160 }),
  body: optional(text()),
  createdAt: created(),
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
}) {}
```

And what the blog does with it:

```ts
// fronds/blog/handlers/PostHandler.ts
export default class PostHandler extends Repository<Post> {
  constructor(private posts: Repository<Post>) {
    super();
  }

  async publish(id: Post['id'], user?: User): Promise<Post> {
    const post = await requireOwn(this.posts, id, user);
    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published' });
    }

    return this.posts.update(id, { status: 'published' });
  }
}
```

`fronds/blog/` is a **frond**: one domain of your app, with its data and what it does.

## What you get

Nothing below is written by you:

- **the type** — `Post` is the TypeScript type of a row, no `Infer<…>`;
- **the validation** — the same rules in the browser and on the server, `title` refused
  past 160 characters in both;
- **the table** — and the migration when a field changes
  ([Storage](/docs/business/storage));
- **the API** — `POST /api/blog/posts/:id/publish`, a GraphQL mutation, a JSON-RPC call
  ([Surfaces](/docs/infra/surfaces));
- **the page's client** — `useCommand(post, 'publish')`, typed down to the errors it can
  answer: `CONFLICT` here ([Queries & commands](/docs/client/queries-commands));
- **the form** — `useFormFor(Post)` knows `status` is not the user's to write
  ([Forms](/docs/client/forms));
- **the tests** — one line, `checkAll(await testApp())`, tries every refusal the fields
  imply ([Testing](/docs/infra/testing));
- **a command line** — the same operations as a terminal tool, flags read off the fields
  ([demo](/docs/demos));
- **a refusal at startup** — when something cannot hold, the app does not start, and says
  which file to fix.

## Where it runs

Today the blog runs inside your Nuxt app. Tomorrow it runs on its own server:

```ts
// fougere.config.ts
fronds: { blog: 'http://127.0.0.1:4100' }
```

That line is the whole change. The page still calls `publish`, the handler is the same
file; the call now crosses the network, and costs that trip and nothing else
([The gradient](/docs/infra/gradient)).

## Why it holds

Your code never says *how* it runs: no SQL, no route, no HTTP, no host. It says what your
data is and what your app does. Everything above is read from that, so nothing can drift
from it, and one field changed is one place to read in a diff.

The longer version: [Philosophy](/docs/concepts/philosophy).

## Reading order

**Concepts** — [Philosophy](/docs/concepts/philosophy) · [The Frond](/docs/concepts/frond) ·
[The base](/docs/concepts/the-base)

**Server side** — [An app you already have](/docs/existing-app) ·
[Bring your schema](/docs/bring-your-schema) · [Getting started](/docs/getting-started) ·
[The CLI](/docs/cli) ·
[Entities](/docs/schema/entities) · [Views](/docs/schema/views) ·
[Standard Schema](/docs/schema/standard-schema) · [Handlers](/docs/business/handlers) ·
[Collect and present](/docs/business/collect-and-present) · [Errors](/docs/business/errors) · [Seeds](/docs/business/seeds) ·
[Facts](/docs/business/facts) · [Storage](/docs/business/storage) · [Repositories](/docs/business/repositories)

**Client side** — [Queries & commands](/docs/client/queries-commands) ·
[Forms](/docs/client/forms) · [Session](/docs/client/session) · [invoke](/docs/client/invoke)

**Topology** — [The gradient](/docs/infra/gradient) · [Surfaces](/docs/infra/surfaces) ·
[Deployment](/docs/infra/deployment) · [Hosts](/docs/infra/hosts) ·
[Sources](/docs/infra/sources)

> **Status.** Fougere is in alpha: the `@fougere/*` packages are on npm under the `alpha`
> tag, and this documentation describes the API as it exists in the repository today.
> This site runs on it.
