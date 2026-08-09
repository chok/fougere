# emit-split — one fact, two processes

A post is published. Search re-indexes it. `blog` never names `search`.

```bash
pnpm install
pnpm -r build          # if packages/*/dist is missing

# terminal 1
pnpm dev:search        # the search frond alone, on :4210

# terminal 2
pnpm dev               # publishes twice: in this process, then across the wire
```

## What to watch

The **pid** in each line. The first publication is indexed in the emitting process; the
second is indexed in the other terminal.

```
1. Both fronds in THIS process
  [search · pid 34732] indexed p1 — "Ferns are not plants that give up"

2. search declared remote — remotes: { search: 'http://127.0.0.1:4210' }
  { id: 'p2', status: 'published' }
                                       ← and in terminal 1:
                                       [search · pid 34697] indexed p2 — …
```

## What is written, in full

```ts
// fronds/blog/handlers/PostHandler.ts — the emitter names a SUBJECT
constructor(private published: Emit<PostPublished>) {}
await this.published({ id, title, at: new Date() });

// fronds/search/handlers/IndexHandler.ts — another frond
async reindex(fact: Fact<PostPublished>): Promise<void> { … }
```

There is no topic, no subscription call, no listener list. **Accepting a `Fact<T>` IS the
subscription** — the scan reads the signature, and that is the whole mechanism. Adding a
third listener does not reopen `PostHandler`.

And `remotes:` is the only line that differs between the two runs. `search/` sits on disk
in both: it is scanned either way, so the emitter knows its signature; declaring it remote
only says it is not hosted here.

## What this demo does NOT show

- **Durability.** `Emit<T>` is a resolver, not a channel: it answers *who*, then hands over
  to the door that already exists. Kill terminal 1 and the fact is lost — the dispatch logs
  the failure and the publication succeeds anyway. At-least-once means putting a real
  channel underneath, in the transport.
- **Discovery in the other direction.** Here the emitter declares where the listener runs.
  A listener that wants to hear a frond it does not know about is the open half.
