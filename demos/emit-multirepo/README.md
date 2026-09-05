# emit-multirepo — two repositories that never read each other

`blog/` and `search/` are two separate projects. Neither contains one line of the other's
source — `search` gets the fact's shape the way a stranger does, off the wire.

```bash
pnpm install
pnpm -r build

# once — the contract crosses the boundary, then Ctrl-C the server
cd blog   && pnpm serve                     # repository A, standing still, :4301
cd search && pnpm sync                      # writes .fougere/remotes/blog/ — generated, gitignored

# three terminals
npx tsx broker.ts                           # the stand-in carrier, :4300
cd search && pnpm dev                       # repository B — subscribes
cd blog   && pnpm dev                       # repository A — publishes twice
```

## What you should see

```
[broker · pid 60877] on http://127.0.0.1:4300 — log + cursors
[broker]  + search for postPublished
[search · pid 60948] listening for: postPublished

[blog · pid 61012] 1. No carrier
                      { id: 'p1', status: 'published' }
                      …and that is all. Nothing failed, nobody heard.      ← the failure

[blog · pid 61012] 2. With a carrier
                      { id: 'p2', status: 'published' }
[broker]  #1 postPublished → 1 online, kept in the log
[search · pid 60948] indexed p2 — "A frond is a leaf that repeats itself"  ← the fix
[broker]    search acked #1
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
in-process — so the validator, the binding and the middlewares apply. A fact off a wire is
validated against the entity it is.

## Where the shape comes from

The name is derived on both sides. The **shape** is not: `search` must know that a
`postPublished` carries an `id`, a `title` of at least one character and an `at`. Nothing on
this disk says so.

It comes from the identity card, which publishes two lists per frond — the doors you may
call, and the facts that leave:

```json
{ "name": "blog",
  "doors": [{ "name": "post", "ops": [...], "schema": {...} }],
  "facts": [{ "name": "postPublished", "schema": {...} }] }
```

`fougere sync` turns the second into a class under `.fougere/remotes/blog/`, and `search`
re-exports it into its own `entities/` in one line — the only thing this repository states
about someone else's fact is that it accepts it:

```ts
// search/fronds/search/entities/PostPublished.ts
export { default } from '../../../.fougere/remotes/blog/entities/PostPublished.js';
```

That re-export is not decoration: the boot validates an arriving fact against an entity of a
**scanned** frond, and a package under `.fougere/` is not one. With it, a payload the
emitter's own declaration refuses is refused here too:

```
[search] postPublished → indexHandler.reindex
  { path: 'title', message: 'String is too short (0 < 1).' }
```

The fields used to be copied by hand into that file. Two declarations, nothing comparing
them, and the drift would have shown up as a fact silently refused.

## Catching up after being offline

Stop `search`, publish, start it again — the fact arrives:

```
[broker]  #1 postPublished → 0 online, kept in the log      ← nobody listening
[broker]  + search for postPublished — replaying 1 it never acked
[search]  indexed p2 — "A frond is a leaf that repeats itself"
[broker]    search acked #1
```

**None of that is Fougere.** Durability is three things and all three are in `broker.ts`:
a log, a cursor per named subscriber, and an ack that only moves the cursor once the fact
was handled. `Emit` is a resolver — it answers *who* — and a resolver holds nothing.

What Fougere owes a carrier is the ability to answer "did it land?", and that is
`app.deliver()`: it resolves when every local listener is done, and rejects when one
refused. Watch a fact the subscriber cannot read:

```
[search]  #2 refused — not acking, it will come back
[broker]  + search for postPublished — replaying 1 it never acked   ← on the next connect
```

Had `deliver` resolved blindly — which it did until it was made to wait — the subscriber
would have acked a fact it never handled, and the log would have moved past it forever.

## The same thing without a broker — a tunnel

Same two repositories, same `PostHandler`, same `IndexHandler`. **Only the carrier
changes**, and this one needs nothing deployed:

```bash
cd blog   && pnpm tunnel      # holds a socket open, publishes every 3 s
cd search && pnpm tunnel      # connects and introduces itself
```

```
[blog] postPublished → 0 listener(s) down the tunnel          ← nobody yet
[blog] a listener introduced itself: postPublished            ← the handshake
[blog] postPublished → 1 listener(s) down the tunnel
[search · pid 43776] indexed p15 — "Frond number 15"
…
[blog] postPublished → 0 listener(s) down the tunnel          ← listener killed
```

The emitter still reads nobody's code. It **learns** from the handshake:

```ts
// search — the payload of the handshake IS what the code accepts
socket.write(JSON.stringify({ subscribe: app.listensTo() }));
```

Stop `search` and the count drops back to zero: the emitter forgets, and the facts
published meanwhile are gone. Nothing is held, by anyone.

### Which carrier, and why

| | how the emitter learns who listens | needs |
|---|---|---|
| **direct call** ([emit-split](../emit-split)) | by **reading their code** | one project |
| **tunnel** | the listener **introduced itself** | the listener knows the emitter's address |
| **broker** | nobody — both meet on **a name** | something deployed |

Only the last two cross a repository boundary. A tunnel is lighter — two processes, no
infrastructure — and its price is that the listener must know where to call, and that the
emitter holds one connection per listener.

## What this demo is not

- **The broker is eighty lines of stand-in.** Real deployments put NATS, Redis or Kafka
  there. Nothing about the shape changes: subscribers announce names, publishers hand a
  name and a payload.
- **The sync is manual and one-way.** Nothing tells `search` that the blog's fact has
  changed shape; re-running `pnpm sync` is a decision someone takes.
