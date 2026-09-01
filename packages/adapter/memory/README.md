# @fougere/adapter-memory

> Rows in a Map — the source that ships no driver

What an app with no `db` runs on, and what a test runs on when the shape is the subject
and the engine is not.

```ts
// fougere.config.ts
export default defineFougere({
  db: { source: 'memory' },
  sources: { cache: { source: 'memory', entities: ['Draft'] } },
});
```

Nothing else to wire: importing this package is what makes `'memory'` an answered name.
`@fougere/app` already depends on it, so the fallback needs no declaration at all.

## It answers the whole port

The thirteen gestures, not six — and it reads the axes, which is the difference between a
store and a stand-in. A `primary(text())` with no generator is refused rather than given an
invented `id`; `created()` is stamped; a second `create` on one key is refused instead of
overwriting in silence.

That is not written here. `storageOver` (`@fougere/core`) derives the thirteen from the four
below, so this package is the four:

```ts
const store = new Map<string, Row>();

return {
  client: store,
  get: async (key) => store.get(key),
  has: async (key) => store.has(key),
  set: async (key, row) => { store.set(key, row); },
  delete: async (key) => store.delete(key),
  all: async () => [...store.values()],
};
```

## What it does not declare

No `transacted`: a Map has no unit of work. A
[frame](https://fougere.dev/docs/business/together) reads the absence, compensates instead of
transacting, and the boot says which of the two it built. No `migrate` either — a Map has no
shape to bring up to date.

Rows live for the life of the process and go with it. Nothing is written anywhere; for rows
that must survive a restart, see `@fougere/adapter-file`.
