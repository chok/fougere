# one-declaration — six lines in, four consumers out

```bash
pnpm -C demos/one-declaration dev
```

One entity is declared. Four different consumers are then asked what they make of
it. **Nobody wrote any of the four**, and none of them can drift from the others.

## What you write

```ts
class Reading extends entity({
  id: primary(),
  station: text({ min: 2, max: 40 }),
  celsius: number({ min: -90, max: 60 }),
  recordedAt: created(),
}) {}
```

## What comes out

**The table** — `min: 2` became a database constraint, not a runtime check:

```sql
create table if not exists "reading" (
  "id" text not null primary key,
  "station" text not null,
  "celsius" real not null,
  "recorded_at" text not null,
  constraint "reading_station_check" check (length("station") >= 2 and length("station") <= 40),
  constraint "reading_celsius_check" check ("celsius" >= -90 and "celsius" <= 60))
```

So raw SQL, another process, or a human at a prompt meets the bound too.

**The identity card** — 488 bytes of plain JSON Schema:

```json
"station": { "type": "string", "minLength": 2, "maxLength": 40 }
```

Any validator on earth reads it. This is the document `demos/rust-frond` publishes:
a Frond written in Rust, consumed from TypeScript, with no shared code.

**The io projection** — nobody wrote "a client cannot supply an id":

```
a client may send    station, celsius
a client receives    id, station, celsius, recordedAt
```

`primary()` and `created()` state it, and the door reads them.

**The judge** — the same verdict in the browser, at the façade, and across a split
(proven in `packages/core/tests/judge-local-remote.test.ts`):

```
{ station: "x", celsius: 200 }   →  station: String is too short (1 < 2). · celsius: 200 is greater than 60.
```

## Why this is the whole point

`min: 2` is written once and lands in four places — a `CHECK` in the database, the
judge at the door, the card that crosses a language boundary, and the browser's own
`minlength` attribute. Write those by hand and you have four places to keep
consistent, in four languages, one of which you do not control.

## What is not shown here

The form contract — `formFieldsOf` derives `minlength`/`max`/`pattern` from the same
shape, but it lives inside `@fougere/nuxt` and the package exposes only its Nuxt
module. Its own doc comment says "usable by any renderer"; no renderer outside the
package can reach it today.
