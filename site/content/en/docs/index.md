---
title: What is Fougere
description: An overview of the shared schema and local or remote execution.
---

# What is Fougere

Fougere is a TypeScript framework built around two ideas.

**Single-schema.** One entity class describes data and validates input. The same
`validate()` method runs in the browser and at the façade. The class also contains the
metadata read by the SQLite and GraphQL adapters, forms, and API surfaces. All of them
read that one declaration.

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

The class provides:

- the **TypeScript type** of a row (`function render(p: Post)` — no `Infer<typeof …>`),
- the **validator** of client input (`Post.validate(input)`),
- the **metadata** every adapter reads (`Post.getFields()`),
- the **designation** pages use to call operations (`useQuery(Post, 'list')`),
- the **nominal name** dependency injection matches in handler signatures (`user: User | null`).

**The gradient.** Business logic is grouped into *Fronds*, composed of entities,
handlers, collectors, and seeds. A Frond runs locally by default. It can be routed to a
JSON-RPC 2.0 host with one configuration entry:

```ts
// fougere.config.ts
remotes: { blog: 'http://127.0.0.1:4100' }
```

A call is represented by `(entity, operation, invocation)`. The runner executes it in
memory for a local Frond. For a remote Frond, the transport encodes it and sends it to
the host. The second path therefore adds an HTTP hop, JSON serialization, and the usual
network constraints.

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
