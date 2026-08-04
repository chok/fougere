---
title: What is Fougere
description: A TypeScript framework built around two ideas — single-schema and the gradient.
---

# What is Fougere

Fougere is a TypeScript framework built around two ideas.

**Single-schema.** One entity class declares your data once — and judges its own input:
the same `validate()` runs in the browser and at the façade. The judge is itself a
projection — derived from the shape axis — but a normative one, shipped with the class:
every other projection must agree with it, and it cannot drift on its own. SQLite tables, GraphQL
types, form contracts and API surfaces are *projections* of that declaration — nothing
is written twice.

```ts
import { entity, primary, text, auto, oneOf, date, readOnly, optional } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 160 }),
  body: optional(text()),
  createdAt: auto(),
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

That is why the split costs the HTTP hop and nothing else: no serialization the local
path avoids, no framework tax layered on top of the network.

## Reading order

**Concepts** — [Philosophy](/docs/concepts/philosophy) · [The Frond](/docs/concepts/frond)

**Server side** — [Getting started](/docs/getting-started) · [Existing Nuxt app](/docs/existing-app) ·
[The CLI](/docs/cli) ·
[Entities](/docs/schema/entities) · [Views](/docs/schema/views) · [Handlers](/docs/business/handlers) ·
[Presenters](/docs/business/presenters) · [Collectors](/docs/business/collectors) · [Errors](/docs/business/errors) · [Seeds](/docs/business/seeds)

**Client side** — [Queries & commands](/docs/client/queries-commands) ·
[Forms](/docs/client/forms) · [Session](/docs/client/session) · [invoke](/docs/client/invoke)

**Topology** — [The gradient](/docs/infra/gradient) · [Surfaces](/docs/infra/surfaces) ·
[Deployment](/docs/infra/deployment)

> **Status.** Fougere is pre-release: the `@fougere/*` packages are not yet on npm, and this
> documentation describes the API as it exists in the repository today. This site runs on it.
