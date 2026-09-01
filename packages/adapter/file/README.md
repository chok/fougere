# @fougere/adapter-file

> One JSON per row, a directory per entity

```ts
// fougere.config.ts
export default defineFougere({
  db: { path: '.data/app.db' },
  sources: {
    archive: { source: 'file', path: './rows', entities: ['Snapshot'] },
  },
});
```

`Snapshot` now reads and writes under `./rows/snapshot/<key>.json`; everything else stays in
`db`. The storage a handler receives is unchanged — where rows live is a fact about the app,
not about the code that uses them.

## What it costs, before you find out

`all()` reads the whole directory, so `list` with a `where` or an `orderBy` filters in
memory. That is right for a few thousand rows held for their durability and wrong on a hot
read path — the same trade `@fougere/adapter-duckdb` documents for a page-sized read.

Two processes over one directory have no lock. SQLite has one; a filesystem does not.

A key becomes a filename, so a key that would leave its directory is refused by name.

## What it does not declare

No `transacted`: a directory has no unit of work. So a
[frame](https://fougere.dev/docs/business/together) spanning this source and another
compensates rather than transacting, and the boot says so:

```
RateCard+Ledger|RateMirrorTogether — compensated: rateCard in 'archive', ledger in 'db' — no isolation
Account+LedgerTogether            — transaction, source 'db'
```

Two frames in one app, two guarantees, and the handlers are the same either way.

`migrate` is a `mkdir` per entity, which is the whole shape a directory has. Nothing here
emits a constraint, so a `ref()` across sources costs nothing.

## Writing your own source

This package is 105 lines, half of them filesystem guards. `storageOver` (`@fougere/core`)
derives the thirteen gestures of the storage port from four, so a new source supplies where
rows are and nothing else:

```ts
Sources.register('redis', (conf): Source => ({
  storageFactory: storageOver((_entity, name) => redisRows(conf.url, name)),
  name: conf.url,
}));
```
