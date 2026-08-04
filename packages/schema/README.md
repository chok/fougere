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

## Installation
```bash
pnpm add @fougere/schema
```

---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://chok.github.io/fougere/) (en/fr).
