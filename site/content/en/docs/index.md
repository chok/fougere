---
title: What is Fougere
description: One idea — you declare the domain, and everything else derives from it, down to the process it runs in.
---

# What is Fougere

Fougere is a TypeScript framework built on one idea: **you declare the domain, and
everything else derives from it — down to the process it runs in.**

Stated in the negative, it becomes checkable: *the declaration names nothing outside
itself.* No table, no protocol, no host, no address appears in it. Two consequences follow,
and they are ordinarily sold as two separate features:

| The declaration does not name… | so that thing is… | its usual name |
|---|---|---|
| its table, its GraphQL type, its form, its judge | **derived** from it | single-schema |
| its host, its storage, its door, its address | **chosen outside** it | the gradient |

One rule read in two directions — what a declaration produces, and what it may be
surrounded by. The rest of this page is those two readings.

## What is derived from it

**Single-schema.** One entity class declares your data once — and judges its own input:
the same `validate()` runs in the browser and at the façade. That judge is itself a
projection, derived from the shape axis, but a normative one shipped with the class:
every other projection must agree with it, and it cannot drift on its own. SQLite tables,
GraphQL types, form contracts and API surfaces are *projections* of that declaration —
nothing is written twice.

```ts
import { entity, primary, text, created, oneOf, date, readOnly, optional } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 160 }),
  body: optional(text()),
  createdAt: created(),
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
  publishedAt: readOnly(optional(date())),
}) {}
```

::derivation-diagram
::

That single class is simultaneously:

- the **TypeScript type** of a row (`function render(p: Post)` — no `Infer<typeof …>`),
- the **validator** of client input (`Post.validate(input)`),
- the **metadata** every adapter reads (`Post.getFields()`),
- the **designation** pages use to call operations (`useQuery(Post, 'list')`),
- the **nominal name** dependency injection matches in handler signatures (`user: User | null`).

## What is chosen outside it

**The gradient.** Business logic lives in *Fronds* — self-contained modules of entities,
handlers, collectors and seeds. A Frond runs in-process today and in its own process
tomorrow, behind JSON-RPC 2.0, with **identical user code**. The entire topology statement
is one line of config:

```ts
// fougere.config.ts
remotes: { blog: 'http://127.0.0.1:4100' }
```

There is no RPC without travel: a call is a value `(entity, operation, invocation)`; the
runner executes it directly in memory when the Frond is local and frames it onto the wire
when it is remote. Transports move the value — they never reshape it.

So the split costs the hop and the JSON that rides it, and nothing else: no serialization
the local path avoids, no framework tax layered on top of the network.

The four families the rule refuses to name, drawn — the gradient being the fourth one read
as a movement rather than a list:

::agnostic-core
::

And it is checkable with `diff`: the five demos that serve this same blog under Next,
TanStack Start, React Router, SvelteKit and Express share a `fronds/` directory that is
identical byte for byte, and three of those hosts need no Fougere package at all. So
*progressive* here means only this — each step outward
[states its price](/docs/infra/gradient#five-rungs-and-the-price-of-each), and none of them
asks you to rewrite what you wrote.

## Reading order

**Concepts** — [Philosophy](/docs/concepts/philosophy) · [The Frond](/docs/concepts/frond) ·
[The base](/docs/concepts/the-base)

**Server side** — [Getting started](/docs/getting-started) · [Existing Nuxt app](/docs/existing-app) ·
[The CLI](/docs/cli) ·
[Entities](/docs/schema/entities) · [Views](/docs/schema/views) ·
[Standard Schema](/docs/schema/standard-schema) · [Handlers](/docs/business/handlers) ·
[Presenters](/docs/business/presenters) · [Collectors](/docs/business/collectors) · [Errors](/docs/business/errors) · [Seeds](/docs/business/seeds) ·
[Facts](/docs/business/facts) · [The ORM port](/docs/business/orm) · [Repositories](/docs/business/repositories)

**Client side** — [Queries & commands](/docs/client/queries-commands) ·
[Forms](/docs/client/forms) · [Session](/docs/client/session) · [invoke](/docs/client/invoke)

**Topology** — [The gradient](/docs/infra/gradient) · [Surfaces](/docs/infra/surfaces) ·
[Deployment](/docs/infra/deployment) · [Hosts](/docs/infra/hosts) ·
[Sources](/docs/infra/sources)

> **Status.** Fougere is in alpha: the `@fougere/*` packages are on npm under the `alpha`
> tag, and this documentation describes the API as it exists in the repository today.
> This site runs on it.
