# @fougere/adapter-file

> One file per row, a directory per entity — JSON or YAML

```ts
// fougere.config.ts
import '@fougere/adapter-sql';
import '@fougere/adapter-file';

export default defineFougere({
  sources: {
    main: { type: 'sqlite', path: '.data/app.db' },
    archive: { type: 'file', path: './rows', rows: ['Snapshot'] },
  },
});
```

`Snapshot` now reads and writes under `./rows/snapshot/<key>.json`; everything else stays in
`main`. The storage a handler receives is unchanged — where rows live is a fact about the app,
not about the code that uses them.

## JSON or YAML

A row is read in the format its extension names — `.json`, `.yaml` or `.yml` — so a directory
written by hand in YAML answers like one this source wrote. A row already on disk is rewritten
in its own format; a new one in `format`, `json` when unsaid:

```ts
archive: { type: 'file', path: './rows', format: 'yaml', rows: ['Snapshot'] },
```

One key in two formats — `s1.json` beside `s1.yaml` — is two answers to one row, and is
refused naming both files.

## One file per value

An entity listed in `values:` is ONE file named after it, beside the directories of rows —
`config/prod/meili.yaml` for `Meili` under `path: 'config/prod'`, in either format. It is read
once at boot and injected into the constructor that asks for a `Meili`; see
[Values](https://fougere.dev/docs/business/values).

```ts
config: { type: 'file', path: `config/${process.env.APP_ENV}`, values: ['Meili', 'Catalog'] },
```

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

This package is 142 lines, most of them filesystem guards and the two formats. `storageOver` (`@fougere/core`)
derives the thirteen gestures of the storage port from four, so a new source supplies where
rows are and nothing else:

```ts
const REDIS = Format.of('source/redis').key('type', Format.tokens(['redis'])).key('url', Format.text)
  .needs('type', 'url').closed();

declare module '@fougere/core' {
  interface FougereSources { redis: Accepted<typeof REDIS> }
}

Sources.register('redis', {
  format: REDIS,
  open: (entry) => ({ storageFactory: storageOver((_entity, name) => redisStore(entry.url, name)), name: entry.url }),
});
```
