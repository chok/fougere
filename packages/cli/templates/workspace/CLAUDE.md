# Working in this application

Built with **Fougere**. This file is read by coding agents before they touch anything — it states
the few facts that change what they should write.

## One declaration, everything derives

A field belongs to its entity and to nowhere else. Adding it there alone produces the SQL column,
the validation, the input contract, the write and the output shape. Additive storage changes need no
hand-written migration; renames, removals and type changes still do. No DTO or permitted-params list
needs to stay in step.

```ts
// fronds/<frond>/entities/Product.ts — and nothing else
sku: text({ min: 3, max: 32 }),
```

Two consequences worth stating, because they are what makes it hold:

- **An input view derives from the entity** — `Order.omit('id', 'status').extend({ items })`, never
  a parallel entity that repeats the same fields. A field added to the entity is then accepted
  without touching the view.
- **A handler writes what the input carries** (`{ ...attributes }`), it does not enumerate its
  fields — otherwise a new field is judged, then silently not written.

If you are about to write the same constraint in two places, you have missed the derivation.

## A surface is a door, never a logic

Every door goes through the handler **façade**, which is the judge: validation, unknown-key refusal,
collectors. A resolver or route you wire yourself against the ORM — or worse, against the database —
is a second door with no judge behind it, and the rules declared in the entities stop applying there.

Before adding a surface, reach for its **projection**:

| surface | the call |
|---|---|
| REST | `generateRoutes(app)` then `registerRoutes(router, routes)` — `@fougere/schema-rest` |
| GraphQL | `registerAll(builder, app)` then `registerGraphQL(router, builder.toSchema())` — `@fougere/schema-graphql` |

Hand-writing the types (`buildSchema`, raw SDL, one Pothos resolver per field) rebuilds what the
projection already derives, and drops the judge on the way. `registerType` / `registerOperations`
exist to add what a projection cannot derive — never to replace it.

## Reading data

`EntityOrm`, injected by type, is the only data access:

```
list(options?)        every row — `options.where` filters, plus paging and sorting
findById(id)          one row by id
findBy(criteria)      one row by criteria      — findBy({ email })
findAllBy(criteria)   every row of a criteria  — findAllBy({ order_id }) IS a one-to-many relation
create / update / delete
```

Read a relation with `findAllBy`. Never read a whole table to filter it in memory.

## Checking your work

```bash
pnpm typecheck    # the compiler — free, immediate, and it catches most of it
```

Run it. It is the first judge, and the cheapest.
