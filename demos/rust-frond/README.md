# rust-frond — a Frond outside TypeScript

A `telemetry` frond written in Rust, consumed by TypeScript that knows none of its
entities. There is **no** `class Sensor extends entity({...})` anywhere in this repo:
the declaration lives in `src/main.rs`.

```bash
cargo run --release     # the Rust frond, :4200
npx tsx consumer.ts     # the TS consumer, in another terminal
```

## What it proves

The frond honours two contracts, and both are JSON:

1. **the wire** — `POST /_fougere/call`, JSON-RPC 2.0, `method = "entity.op"`,
   `params` = the InvocationContext. See `packages/transport/http/src/jsonrpc.ts`.
2. **the map** — `rpc.discover` returns what it hosts, schemas included.
   See `RPC_ENTITY` in `packages/core/src/wire/call.ts`.

Everything else belongs to it: the language, the storage, the validator.

The moment that counts is step 4 of the consumer. `Card.toSchema()`
(`packages/schema/src/projection/card/Card.ts`, `toSchema`) rebuilds a **live** schema from
the map, and the TS validator refuses a payload before any network:

```
✗ couleur  — Unknown field
✗ celsius  — 250 is greater than 80.
✗ checksum — Read-only
✗ label    — String is too short (1 < 2).
```

Those messages come from `@cfworker/json-schema`, on the TS side, applied to rules that
no line of TypeScript declares. "The truth travels, the realization varies" — literally.

## The 4 axes on the wire

`shape` IS JSON Schema, at the top level of the field. The other three live under
`x-fougere`:

| axis | in `src/main.rs` | effect on the TS side |
|---|---|---|
| `role.primary` | `id` | excluded from `Visibility.input` |
| `lifecycle.create: 'now'` | `recordedAt` | excluded from `Visibility.input`, stamped by Rust |
| `lifecycle.create: {generate}` | `id` | not required at creation |
| `boundary.in: 'closed'` | `checksum` | `Read-only` if a client supplies it |

## What the demo does not do

- **The static type.** `Card.toSchema()` returns a `SchemaConstructor<Fields>` — full
  runtime, literal keys lost. Getting `sensor.label` typed would need a map → `.d.ts`
  projection, which does not exist (no codegen in `packages/cli/src`).
- **The map is hand-written** (`sensor_card()`). A real Rust frond would derive it —
  `#[derive(Entity)]` on the struct, with `schemars` underneath. That is where Rust
  beats TS: a macro sees the declaration, where Fougere pays for an AST scan.
- **The documented losses** of `card.ts:18-22` apply: a relation would travel by name,
  and so would a custom generator.

## What the consumer still does by hand

It calls `rpc.discover` itself. It no longer has to — since `0e51395`, the remote router
reconstructs each entity's schema at discovery time and `App.schemaFor(entity)` serves it
(`core/src/boot/remote.ts`, `createRemoteRouter` ; `core/src/boot/bootstrap.ts`, `schemaFor`). The explicit call is kept here
because it is the demo's subject: showing the map arrive, and the validator being rebuilt
from it. An app would ask `schemaFor`.
