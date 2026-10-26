# @fougere/adapter-env

> The process environment as a source — `MEILI_URL` is Meili's `url`

```ts
// entities/Meili.ts
export default class Meili extends entity({ url: url(), key: text(), timeoutMs: number({ integer: true, default: 2000 }) }) {}

// fougere.config.ts
import '@fougere/adapter-env';

export default defineFougere({
  sources: {
    main: { type: 'sqlite', path: '.data/app.db' },
    env: { type: 'env', values: ['Meili'] },
  },
});

// services/Search.ts
export default class Search {
  constructor(private meili: Meili) {}
}
```

`Search` receives `{ url, key, timeoutMs }`, judged at boot. A variable that is missing, or
that does not hold what its field declares, refuses the boot and names it:

```
meili.key: Required — sources.env, MEILI_KEY
```

## The names

A field is read from `ENTITY_FIELD`, in SNAKE_CASE and with no prefix: `timeoutMs` is
`MEILI_TIMEOUT_MS`. The text is read as the field's shape says — a number, a boolean (`true`,
`false`, `1`, `0`), JSON for an object or a list — and what does not read that way is refused
by the field.

Under `rows:`, a segment of the name is the key, read from the END, since the fields are
known: `INDEX_BOOKS_URL` is the row `books`, `INDEX_PROD_AUTHORS_URL` the row `prod_authors`.
Two fields that end alike — `url` and `booksUrl` — would read one variable two ways, and are
refused when the storage is made.

## What it does not do

Nothing is written: a write is refused, naming the variable to change. And it is never the
source that holds the rest — a type that is read-only cannot be, so `env` beside `main` leaves
`main` the default.

One environment per deployment, not a pattern inside it: production and staging are two
processes, each started with its own variables. A value that differs by file is read from a
directory the config computes:

```ts
config: { type: 'file', path: `config/${process.env.APP_ENV}`, values: ['Catalog'] },
```
