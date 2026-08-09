# emit-multirepo — two repositories that never read each other

`blog/` and `search/` are two separate projects. Neither contains one line of the other:
`search` even declares its **own copy** of `PostPublished`.

```bash
pnpm install
pnpm -r build

# three terminals
npx tsx broker.ts                          # the stand-in carrier, :4300
cd search && pnpm dev                       # repository B — subscribes
cd blog   && pnpm dev                       # repository A — publishes twice
```

## What you should see

```
[broker · pid 41109] on http://127.0.0.1:4300
[broker]  + subscriber for postPublished
[search · pid 41166] listening for: postPublished

[blog · pid 41212] 1. No carrier
                      { id: 'p1', status: 'published' }
                      …and that is all. Nothing failed, nobody heard.      ← the failure

[blog · pid 41212] 2. With a carrier
                      { id: 'p2', status: 'published' }
[broker]  postPublished → 1 subscriber(s)
[search · pid 41166] indexed p2 — "A frond is a leaf that repeats itself"  ← the fix
```

**`p1` is lost in silence.** That is the point of step 1, and it is the honest failure mode
of a repository boundary — nothing throws, nothing warns above debug level.

## Why step 1 fails

Fougere finds a fact's listeners by **reading their code**. In one project that works, even
across processes ([emit-split](../emit-split) shows it). Across repositories the code is not
there, the index is empty, and the emission reaches nobody.

The rule behind it: *colocation gives the CONTRACTS, `remotes:` only gives the LOCATION.*
A repository boundary is where derivation stops.

## Why step 2 works

Neither side learns anything about the other. Each derives its half from its own code and
they meet on **a name**:

```ts
// blog — the name comes from the fact, never written by hand
onEmit: async (fact, payload) => fetch(`${BROKER}/publish`, { … body: { topic: fact, payload } })

// search — read off its own signatures, declared nowhere else
const topics = app.listensTo();            // ['postPublished']
```

`app.listensTo()` comes from the `Fact<PostPublished>` in `IndexHandler`. Delete that
parameter and the subscription disappears with it.

On arrival the payload goes through the **same local dispatch** the emitter would have used
in-process — so the judge, the binding and the middlewares apply. A fact off a wire is
validated against the entity it is.

## What this demo is not

- **The broker is forty lines of stand-in.** Real deployments put NATS, Redis or Kafka
  there. Nothing about the shape changes: subscribers announce names, publishers hand a
  name and a payload.
- **Still nothing is durable.** Stop `search`, publish, restart it: the fact is gone. The
  stand-in holds no queue, which is exactly what a real broker adds.
- **`search` writes its own `PostPublished` by hand** because `fougere sync` cannot fetch
  it: a fact carries no operations, and the identity card only publishes what has a door.
  That gap is real, and this file stands in for it.
