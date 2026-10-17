---
'@fougere/core': minor
'@fougere/adapter-rest': minor
'@fougere/adapter-graphql': minor
'@fougere/app': minor
'@fougere/nuxt': minor
'@fougere/compiler': minor
'@fougere/http': minor
'@fougere/schema': minor
---

The REST route of an operation is read off its contract. `update` answers `PATCH` (a `PUT` there answers `405`), an op taking `Partial<Post>` or only fields of the row it points at is a `PATCH` with those fields in the body, one taking a whole `Post` a `PUT`, and anything else a `POST`. A URL is three parts, each said by its owner: `protocols: { rest: { prefix } }` in `fougere.config.ts`, the frond's name (or `protocols: { rest: { path } }` in its `frond.config.ts`), then the op. A server calling `generateRoutes` now answers `/api/<frond>/posts`, like the web hosts.

Breaking: `operations:` in `frond.config.ts` is keyed `'<address>.<op>'` — `{ 'cart.total': { kind: 'query' } }`; a bare name is refused with the keys it could have been. `generateRoutes` loses its `prefix` and `overrides` options and `rest()` its mount path: the prefix comes from `fougere.config.ts`, which may name an op's route only for a frond with no sources in the project.

`Verbs.register('total', 'query')` in a frond's `vocabulary/` teaches a verb once, and the refusal of an op whose kind nothing tells gives the three lines that would settle it. A written scan or statement keeps `operations:` and `pipes:`, and a view derived from an entity as its cut.
