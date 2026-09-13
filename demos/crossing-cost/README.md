# crossing-cost — what a call crosses, and the line that decides it

```
cart ──▶ pricing ──▶ catalog     a chain of three
cart ──▶ catalog                 and a shortcut past the middle
cart ──▶ ledger                  declared, answered by nobody
```

```bash
pnpm dev
```

## What the domain code says about any of this

Nothing. `CartHandler` asks for its two neighbours by TYPE:

```ts
constructor(
  private priceFacade: Facade<PriceHandler>,
  private productFacade: Facade<ProductHandler>,
) {}
```

No address, no client, no branch. `fougere.config.ts` is the whole topology statement.

## The two numbers

Run it as it stands, and every Frond is here:

```
Cart.checkout      answers local   reaches catalog, pricing   0 hop(s)
Price.total        answers local   reaches catalog            0 hop(s)
Product.list       answers local   reaches —                  0 hop(s)
```

Uncomment the two lines in `fougere.config.ts` and run it again:

```
Cart.checkout      answers local   reaches catalog, pricing   2 hop(s)
```

**Same file, same signature, different cost.** `placement` says where an operation ANSWERS;
`reach` says where its work GOES. Three numbers a process writes down today are a function of
that second one — how often a trace is sampled, where a latency histogram's bounds sit, and what
a load threshold may assume. One value for every operation treats `Product.list`, which reaches
nobody, as the same subject as `Cart.checkout`, which pays two round trips.

## The Frond nobody serves

`ledger` is in `remotes:` and no code reaches it, no process answers it. It is reported anyway:

```
ledger    elsewhere  http://127.0.0.1:4630
```

That is the half a counted graph cannot hold. A dependency is observed by counting calls, and a
call that never happened leaves nothing to count — so a Frond that is down does not appear as
broken, it stops existing. Ask any app for `rpc.topology` and the `declared` half names it while
the counted half does not.

## Why a chain of three

`cart → pricing → catalog` is why this demo has a middle at all. A layout in two columns — what
runs here on the left, what does not on the right — puts `pricing` and `catalog` in the same
column and has to route the line between them around whatever else sits there. Ranking by depth
does not: what calls is always before what it calls, however long the chain.

It is the same reason `fougere graph` and the admin panel's Topology page buy their placement
rather than hand-writing it.

## See it elsewhere

```bash
fougere graph                                    # the Fronds, then the entities
fougere explain Cart.checkout --root .           # Placement and Reach, side by side
fougere load --out ""                            # a k6 scenario for these three ops
```
