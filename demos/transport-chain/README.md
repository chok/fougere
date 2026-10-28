# transport-chain — what carries a call, and the list that decides it

```
cart ──▶ catalog     two crossings: list, then charge
```

```bash
pnpm dev
```

```
[link]                             {"items":2,"cents":1650}           crossed: product.list, product.charge
[journal, link]                    {"items":2,"cents":1650}           crossed: product.list, product.charge
[journal, link] — again            {"items":2,"cents":1650}           crossed: —
[journal, cut, link]               "refused — the line dropped on product.charge" crossed: product.list
[journal, cut, link] — replayed    {"items":2,"cents":1650}           crossed: product.charge
[retrying, journal, cut, link]     {"items":2,"cents":1650}           crossed: product.list, product.charge
[retrying, refusing, link]         "refused — the far side refused product.charge" crossed: product.list, product.charge
```

## What the domain code says about any of this

Nothing.

```ts
export default class CartHandler {
  constructor(private productFacade: Facade<ProductHandler>) {}

  async checkout(): Promise<{ items: number; cents: number }> {
    const products = await this.productFacade.list() as { id: string }[];
    const cents = await this.productFacade.charge() as number;
    return { items: products.length, cents };
  }
}
```

Seven behaviours, one file, never touched. No step, no `yield`, no workflow syntax — and the
last column proves the difference is real: line 3 answers without a single call leaving the
process, and line 5 replays a failed checkout by crossing only what had not answered yet.

## Why this works at all

A transport is a function:

```ts
export type Transport = (call: FrondCall, invocation: InvocationContext) => Promise<unknown>;
```

A call is a frozen value — `address` plus `invocation` — because it already has to survive
JSON-RPC. Which means a link can hold it, keep the answer, and hand back the same one later.
That is what a replay engine does, and the five links here are fifteen lines each:
`journal.ts`, `retrying.ts`, `cutting.ts`, `refusing.ts`, `memory.ts`.

## A retry belongs to the crossing

Line 7 crosses `charge` once. The far side answered, and a refusal asked twice says the same
thing twice. `retrying.ts` asks again only when the call got no answer — a thrown line,
`BAD_GATEWAY`, `GATEWAY_TIMEOUT`, `SERVICE_UNAVAILABLE` — and hands any other `FougereError`
straight back. That line can be drawn here and nowhere else: the transport holds the code a
crossing failed with, where a link in front of `Payment` holds an error already translated.

## What is NOT induced

- **Durability.** The journal is an array. A real one outlives the process.
- **Resuming the body.** Line 5 is a second run started by this script. Nobody restarts a
  handler on its own; that is what a worker is for.
- **An identity per execution.** The journal is keyed by `address.op`, so two concurrent
  checkouts would share it. A run id would have to travel in the invocation.

Those three are what Temporal sells, and they do not fall out of anything. What falls out is
the *seam they need* — and it is the part that usually cannot be bought.

## The order is the declaration

`[retrying, journal, …]` and `[journal, retrying, …]` are different systems: the first absorbs
a cut inside one run, the second records the refusal and needs a replay. Nothing in the domain
says which — exactly like `ports: { Payment: ['Auditing', 'Stripe'] }`, read from the outside
in, and `pipes: { postPublished: ['Redact', 'Stamp'] }`.

The chain here is composed in `src/main.ts` by hand. `remoteTransport` takes a factory, not a
list, so this one is the family member whose order is not yet stated in `fougere.config.ts`.

## See it elsewhere

```bash
pnpm -C demos/ports-swap dev       # the same shape, on a port
pnpm -C demos/crossing-cost dev    # what a crossing costs when nothing wraps it
```
