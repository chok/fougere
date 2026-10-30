---
title: "What is Fougere"
description: "You write your data and what your app does. Fougere writes the rest, and lets you move any part to another process without touching it."
kind: "intro"
---

You write your data and what your app does with it. Fougere writes the rest: the table, the
validation, the API, the forms, the typed client, the tests. And any part of your app can later run
in its own process without a line of your code changing.

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
  async publish(id: Post['id']): Promise<Post> {
    const post = await this.findById(id);
    if (post?.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published' });
    }

    return this.update(id, { status: 'published' });
  }
}
```

`fronds/blog/` is a **frond**: one domain of your app, with its data and what it does.

## What you get

None of this is written by you:

- **the type** — `Post` is the TypeScript type of a row;
- **the validation** — the same rules in the browser and on the server: a `title` past 160
  characters is refused in both;
- **the table** — and the migration when a field changes ([SQLite or Postgres](/docs/data/sql));
- **the API** — `POST /api/blog/posts/:id/publish`, a GraphQL mutation
  ([REST, OpenAPI, GraphQL](/docs/serve/rest-graphql));
- **the page's client** — `useCommand(post, 'publish')`, typed down to the errors it can answer:
  `CONFLICT` here ([Pages](/docs/serve/pages));
- **the form** — `useFormFor(Post)` knows `status` is not the user's to write
  ([A form](/docs/serve/forms));
- **the tests** — `checkAll(await testApp())` tries every refusal the fields imply
  ([Test](/docs/run/test));
- **a refusal at startup** — when something cannot hold, the app does not start, and says which
  file to fix.

## Where it runs

Today the blog runs inside your app. Tomorrow it runs on its own server:

```ts
// fougere.config.ts
fronds: { blog: { remote: 'http://127.0.0.1:4100' } }
```

That line is the whole change. The page still calls `publish`, and the handler is the same file;
the call now crosses the network, and costs that trip and nothing else
([Configuration](/docs/concepts/configuration)).

## The one rule

Your code says **what** a thing is: its fields, its operations, where one domain ends. It never says
**how** it runs: no SQL, no route, no HTTP, no host, no address. Everything else is either derived
from your code — the type, the validation, the table, the form, the API — or chosen apart from it,
in `fougere.config.ts` — the database, the protocols, where each frond runs.

Two things follow:

- **Nothing drifts.** A rule written once on the entity is the rule everywhere it is read. When you
  find the same rule in two places, move it into the entity.
- **HTTP is one projection among others.** An operation is a method called with its own arguments.
  It can be called in memory, over JSON-RPC, as a REST route, a GraphQL field or a terminal command,
  and none of those forms is the floor under the rest. An app with no server at all — a test, a
  script — is a whole app.

## Where the schema goes

What you declared is the argument of everything Fougere hands back, in one of three forms:

| Form | What you write |
|---|---|
| a class you **extend** | `extends Repository<Post>`, `extends Collect<User>` |
| a value you **receive** | `constructor(posts: PostRepository, announce: Emit<PostPublished>)` |
| a call you **write** | `useQuery(post, 'list')`, `useFormFor(Post)` |

The argument is always a class of yours — an entity, a fact, a handler. Never a string: rename the
class and the compiler follows every reader of it. And never a decorator: `extends` says the same
thing in the language, and registers nothing behind your back.

## Read on

- The [tutorial](/tutorial/1-crud) builds a blog in six steps, from a CRUD to a split.
- The **concepts**, in order: [Entity](/docs/concepts/entity), [Handler](/docs/concepts/handler),
  [Repository](/docs/concepts/repository), [Frond](/docs/concepts/frond),
  [Facade](/docs/concepts/facade), [Fact](/docs/concepts/fact), [Port](/docs/concepts/port),
  [Configuration](/docs/concepts/configuration).
- The **tasks** in the sidebar, grouped by need, each naming the concepts it uses.
- The [reference](/reference): every package, every config key, every refusal.

## Why “Fougere”

A fern is made of fronds, each repeating the shape of the whole plant. Fields make an entity,
entities and their operations make a frond, and an app is made of fronds.

> **Status.** Fougere is in alpha: the `@fougere/*` packages are on npm under the `alpha` tag, and
> these pages describe the code as it is in the repository today. This site runs on it.
