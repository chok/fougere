# sse-live — the listeners are not trusted peers

```bash
pnpm -C demos/sse-live dev
```

```
1. alice drafts "Ferns unfurl in silence"
   carrier  postChanged → alice           payload on the wire: { entity: 'post' }
   alice's screen  Ferns unfurl in silence (draft)  · 1 nudge(s)
   bob's screen    0 rows                           · 0 nudge(s)

2. alice publishes it
   carrier  postChanged → alice, bob      payload on the wire: { entity: 'post' }
   alice's screen  Ferns unfurl in silence (published)  · 2 nudge(s)
   bob's screen    Ferns unfurl in silence (published)  · 1 nudge(s)
```

## Read it against `emit-multirepo/blog/tunnel.ts` first

That demo already holds a connection open, keeps a `Map` of listeners, fans a fact out
over it and drops an entry on close. **None of that is what this one is about.** A socket
is a socket, and the registry is five lines in both files.

Two things differ.

**A listener is not a peer.** The tunnel's listener introduces itself by naming the facts
it accepts — read off its *own signatures*, because it is a Fougere process. A reader has
no signatures and does not speak for the others, so the carrier has to decide who may be
**told**, and it decides from the fact. That is `mayBeTold` in `live.ts`, and it is why
step 1 above reaches alice and not bob.

**The push carries `{ entity }` and nothing else.** Not the row, not the title, not even
the id. Every title on that screen was answered by `PostHandler.list` to a caller it had
identified. A push cannot leak what it does not carry, which turns the fan-out into a
question of permission instead of a question of content.

## The two judges are not a duplication

`mayBeTold` (in the carrier) and `PostHandler.list` (in the frond) answer different
questions, and the asymmetry is the design:

| | question | cost of getting it wrong |
|---|---|---|
| `mayBeTold` | may this reader be *told* something moved? | a wasted query |
| `list` | what may this reader *read*? | a leaked draft |

Only the second one is load-bearing. That is what buys the right to keep the first one
this simple — and it is why the fact carries `author` and `status` but not `title`: a
carrier needs to route, never to display.

## What it does not show

The **browser half**. `@fougere/app-shared` already keeps a registry of mounted queries
per entity (`mountedKeys`/`revalidate`, `client.ts`), so a real client's `onEntityMoved`
is one call instead of the re-query written here by hand. The server stays as dumb as it
is here either way: it pushes an entity name, and the client decides which of its mounted
reads that touches.

And nothing is held. A reader that is offline when a post is published learns nothing and
gets no catch-up — same trade as the tunnel, and the reason `emit-multirepo/broker.ts`
exists next door.

## Files

**`fronds/blog/`** — an entity, a fact, a collector, a handler. Nothing in there knows a
connection is being held open, and nothing knows there is more than one reader.

**`live.ts`** — the carrier: the connection registry, the permission gate, and the client
loop. ~130 lines you own, not a package you install.

**`main.ts`** — the wiring, which is one `onEmit`, and the narrative.
