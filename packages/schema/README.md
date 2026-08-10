# @fougere/schema
> The entity and its 4 axes
An entity declares fields; every field carries four independent axes — `shape` (which
IS JSON Schema), `role` (primary, ref…), `lifecycle` (who writes the value, and when)
and `boundary` (readOnly / writeOnly). Everything else in Fougere is a projection of
them: tables, GraphQL types, form contracts, validation.

This package names no adapter and depends on no engine.

```ts
import { entity, primary, text, auto, readOnly } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text(),
  authorId: readOnly(text()),
  createdAt: auto(),
}) {}

Post.validate({ title: 'Bonjour' }); // → { success, data } | { success: false, errors }
```

## It is a Standard Schema

Every entity — and every derivation of one — exposes `~standard`, so it is accepted
anywhere [Standard Schema](https://standardschema.dev/) is, with no adapter package.

```ts
export class PostDraft extends Post.pick('title') {}

PostDraft['~standard'];
// → { version: 1, vendor: 'fougere', validate }

PostDraft['~standard'].validate({ title: '' });
// → { issues: [{ message: 'String is too short (0 < 1).', path: [{ key: 'title' }] }] }
```

Validation is synchronous, and the spec types are inlined rather than depended on, so
this package stays zero-dependency.

One difference from most vendors, and it is deliberate: **the judge does not fill
defaults**. A field declared `bool({ default: false })` may be absent — that is legal,
and the value comes back without the key. Filling belongs to the storage, at the point
of persistence, so the same input judged twice never gains a field on the way through.

## Installation
```bash
pnpm add @fougere/schema
```

---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://chok.github.io/fougere/) (en/fr).
