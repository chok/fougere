---
title: "What is Fougere"
description: "You write your data and what your app does. Fougere writes the rest, and lets you move any part to another process without touching it."
kind: "intro"
---

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
  ([Storage](/docs/extending/source-adapter));
- **the API** — `POST /api/blog/posts/:id/publish`, a GraphQL mutation, a JSON-RPC call
  ([Surfaces](/docs/serve/rest-graphql));
- **the page's client** — `useCommand(post, 'publish')`, typed down to the errors it can
  answer: `CONFLICT` here ([Queries & commands](/docs/serve/pages));
- **the form** — `useFormFor(Post)` knows `status` is not the user's to write
  ([Forms](/docs/serve/forms));
- **the tests** — one line, `checkAll(await testApp())`, tries every refusal the fields
  imply ([Testing](/docs/run/test));
- **a command line** — the same operations as a terminal tool, flags read off the fields
  ([demo](/docs/adopt/demos));
- **a refusal at startup** — when something cannot hold, the app does not start, and says
  which file to fix.

## Where it runs

Today the blog runs inside your Nuxt app. Tomorrow it runs on its own server:

```ts
// fougere.config.ts
fronds: { blog: { remote: 'http://127.0.0.1:4100' } }
```

That line is the whole change. The page still calls `publish`, the handler is the same
file; the call now crosses the network, and costs that trip and nothing else
([The gradient](/docs/concepts/configuration)).

## Why it holds

Your code never says *how* it runs: no SQL, no route, no HTTP, no host. It says what your
data is and what your app does. Everything above is read from that, so nothing can drift
from it, and one field changed is one place to read in a diff.

The longer version: [Philosophy](/docs).

## The one rule

Everything on this page comes from one rule: **Fougere tells what your code is from how
it runs.** An entity says what your data is; the table, the protocol, the host and the
address are how it runs. So everything else is either *derived* from your code (the type,
the validation, the table, the form) or *chosen apart* from it, in the config (the
database, the host, where each part runs). A detail of how it runs may sit next to your
code when that is simpler — a column type for one field — and nothing derived reads it. You describe your data, what your app does and where one domain ends; Fougere then
connects that to Nuxt, HTTP, SQL or another process.

## One declaration, many uses

An [entity](/docs/concepts/entity) describes your data without saying where it is stored.
From that one class come the TypeScript type, the validation, the form, the database table
and the GraphQL type. When you find the same rule written in two places, move it into the
entity, and both places will read it from there.

## Operations, not field writes

Your app changes things with **commands**, reads them with **queries**, and, when it helps,
announces what happened with **events**. `extends Repository<Post>` gives you the five usual operations.
A business step gets its own verb: [`publish`](/docs/concepts/handler) checks its rules
and then changes `status`, rather than letting the page write that field itself.

## The Frond owns

A [frond](/docs/concepts/frond) holds one domain: its entities, its operations and its
rules. Another frond reaches it only through what it exposes, never through its files.
Your app puts fronds together, and their logic stays inside them, not in your pages or
your stores.

## Topology is configuration

The same rule, applied to the clearest case of how it runs: where. The
[config](/docs/concepts/configuration) says whether a frond runs in your process or on another
host, and your code calls it the same way in both cases. Fougere does not hide the
difference: your code simply never said which side it was on. A local call stays in
memory; a remote one goes over the network.

The boundary also lets a Frond have its own repository and release cycle: only its
**contract** must travel, never its source — `fougere sync` reads it off the running host,
`fougere build-frond` turns it into an installable package
([where the code lives](/docs/adopt/another-repository)).

## HTTP is a projection, not a foundation

Many frameworks start from a route: everything hangs off a request, the model, the
validation and the business code included. Here everything starts from the **operation**:
a public method, called with its own arguments, that has never heard of HTTP.

This is not a matter of style; it is what makes the rest possible. An operation that
ignores transport can be called in memory, put on a JSON-RPC wire, translated into a REST
route, a GraphQL field or a shell command — with none of those forms privileged.
`@fougere/core` depends on no server, and an app
[answers a Web Standard `Request`](/docs/serve/rest-graphql#the-framework-is-not-the-process):
you bring Hono, Express, Nitro, a Worker — or nothing.

The corollary is that JavaScript takes you everywhere it goes. The declaration and its
validator run in the browser as they do at the façade: the same object, not a faithful copy.

### Transport is a leaf

A complete Fougere application may have no HTTP at all. Entities, operations, storage,
validation, injection and seeds all work without a server ever starting. A shell command, a
worker, a test, an in-memory call are not degraded versions of the application: they are
whole uses of it.

That is why HTTP sits at the **same rank** as the other projections, not beneath them. One
declaration yields the SQL table, the GraphQL type, the form contract and the route: four
readings of a single statement, none of them the ground the others stand on.

Two consequences, and they are what makes the principle useful:

- were transport the foundation, you could not remove it — so no in-memory call, so no
  [gradient](/docs/concepts/configuration);
- the [surfaces](/docs/serve/rest-graphql) could not return the same verdict, since one of them
  would be the floor beneath the rest.

So this is not a claim of independence from any server, nor an implementation choice. It is
the rule stated at the top of this page — one declaration, many projections — applied where
many frameworks put their foundation.

### Ports, and a different arrow

::core-and-arcs
::

The vocabulary is the ordinary one — `Storage` and `Transport` are ports, the packages
under `adapter/` implement them — so a reader arriving from a ports-and-adapters
architecture is on familiar ground. One thing differs. There, the arrow states a
**dependency**: nothing in the core may point outward. Here it states a **derivation**: the
table, the GraphQL type, the form contract and the route are *read off* the declaration. A
dependency direction is a rule you have to keep; a derivation is a fact you cannot break.

## Why “Fougere”

A fern consists of fronds that repeat a structure similar to the whole plant. The name
refers to the framework's composition: fields form an entity, entities and their
operations form a Frond, and an application composes several Fronds.

## What you write, and where the schema goes

The base of a Fougere application is not what the framework ships. It is the entity you
wrote.

Everything Fougere hands back is indexed by that declaration, and it comes in three
forms. Knowing the three is enough to predict where the schema goes in an API you have
never seen: between the parentheses of a class you extend, in the type of a value you
receive, or as the first argument of a call you write.

| Form | What you write | Examples |
|---|---|---|
| a class you **extend** | `extends Repository<Post>` | `entity`, `Repository`, `Present`, `Collect`, `Mirror` |
| a value you **receive** | `constructor(posts: Repository<Post>)` | `Repository<E>`, `Emit<F>`, `Fact<F>`, `Facade<H>` |
| a call you **write** | `useQuery(post, 'list')` | `facade`, `useQuery`, `useCommand`, `useFormFor` |

The parameter is always something you declared yourself — usually an entity, sometimes a
[fact](/docs/concepts/fact) or a [handler](/docs/concepts/handler). Nothing in that
column is a string, a name, or a key registered elsewhere: rename the class and the
compiler follows every reader of it.

## A class you extend

Five of them. What varies is not their nature but how much your declaration determines —
`Collect<User>` can derive almost nothing from "I resolve a User", while `Repository<Post>`
derives five whole operations from Post's table.

| | It names | What you inherit | What you write |
|---|---|---|---|
| [`entity({…})`](/docs/concepts/entity) | the fields | the type, the validator, the metadata | the field map |
| [`Repository<Post>`](/docs/concepts/handler) | one entity, or the several it owns | five operations and every gesture of the rows — or none, from two on | nothing, or the ones you redefine |
| [`Present<Post>`](/docs/data/computed-field) | an entity | the target the scan reads | one method per computed field |
| [`Collect<User>`](/docs/access/authentication#who-calls-collect) | any class | the target the scan reads | `collect(ctx)` |
| `Mirror<BookCard>` | a shape | a repository, the loop and the write | `pull()` |

Only the first is mandatory. A handler that extends nothing is an ordinary handler; a
repository you never write still resolves. Where extending *is* the declaration —
presenters, collectors — the base carries a target and no behaviour at all.

Each of them is documented where it is used, and the links above go there. One has no
page of its own, because it belongs to no single step: it is the base itself.

## A value you receive

The second form is a constructor parameter, resolved by **type** — never by parameter
name, never by a string key:

```ts
export default class PostHandler {
  constructor(
    private posts: Repository<Post>,
    private announce: Emit<PostPublished>,
  ) {}
}
```

`Repository<E>` is the default repository shape: it forwards the guarded storage port and
resolves even when no repository file exists. Injecting `Storage<E>` directly into a
handler, presenter or collector is refused at boot; name storage access through a
[repository](/docs/concepts/repository). [`Emit<F>`](/docs/concepts/fact) announces a
fact, and accepting a `Fact<F>` is the subscription — no topic, no register call.
[`Facade<H>`](/docs/concepts/facade) is the one whose parameter
is not an entity: it names another Frond's handler, which is a declaration of yours all
the same.

## A call you write

The third form is the client side, and it is `Facade<H>` again — a page names the handler
that answers, exactly as a handler names another Frond's:

```ts
import { post } from '@fronds/facade';

const { items } = await useQuery(post, 'list');
const publish = useCommand(post, 'publish');
const form = useFormFor(Post, { op: 'update', params: { id } });
```

Same designation as the server, so the local validator is the remote validator and a form
contract is not a second declaration of the entity. The handler type is imported for its
TYPE only — erased at build — and it is what gives the page the operations that exist and
what each answers, so no row shape is written by hand.

`useFormFor` keeps the entity, and that is the line: a form **is** a set of fields, while a
call is a facade. The two are different subjects, so they take different arguments.

One exception worth stating: [`useCurrentUser()`](/docs/access/authentication) takes no argument.
It reads its entity from the session rather than from a call site.

## Why a class, and never a decorator

A decorator would have to *modify* the runtime to attach the storage, the target, or the five
operations. `extends` states the same thing in the language: the type follows without a
second declaration, `getFields()` is a plain static, and nothing is registered behind your
back.

It also survives where a scan cannot reach. `Repository` declares its operations at runtime, on
the class, so an installed Frond whose source no parser can open still publishes its
contract. Decorator metadata would need a compiler flag and a reflection library to say as
much, and would say it only where both were configured.

## One API for each common need

Common operations have a recommended API:

| Need | API |
|---|---|
| read from a page | [`useQuery`](/docs/serve/pages) |
| change state from a page | [`useCommand`](/docs/serve/pages) |
| manage a form | [`useFormFor`](/docs/serve/forms) |
| call from the server | [`invoke`](/docs/serve/pages) |
| validate input | [`Entity.validate`](/docs/concepts/entity) |

These APIs share the same entity-and-operation designation. They also pass the context
expected by collectors and normalize errors. A manually assembled call must handle those
responsibilities explicitly.

> **Status.** Fougere is in alpha: the `@fougere/*` packages are on npm under the `alpha`
> tag, and this documentation describes the API as it exists in the repository today.
> This site runs on it.
