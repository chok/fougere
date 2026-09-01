# together-frame — two writes that stand or fall as one

`Storage<T>` is the port whose every gesture is **one statement**, and one statement is
atomic in every engine. `Together<[…]>` is the port whose unit is a **block**.

```ts
constructor(private together: Together<[Account, Ledger]>) {}

await this.together.run(async ([accounts, ledger]) => {
  await accounts.update(from, { balance: debited.balance - amount });
  await accounts.update(to,   { balance: credited.balance + amount });
  await ledger.create({ id, from, to, amount });
});
```

Resolved by type, like `Storage<E>`, `Facade<H>` and `Emit<F>` — the type names the
subject, the container holds the realization. Nothing is registered, nothing is ambient:
the block is visible at the call site.

## Run it

```bash
pnpm -C demos/together-frame dev
```

Then uncomment `sources:` in `fougere.config.ts` and run it again. **The handlers are not
touched.** One line of boot output changes:

```
Account+LedgerTogether — transaction, source 'db'
Account+LedgerTogether — compensated: account in 'db', ledger in 'accounting' — no isolation
```

## What each realization gives

All-or-nothing, both times. On one engine the members are rebuilt over a real transaction
and the engine gives the unwind **and** the isolation. Across engines a transaction cannot
exist, so the frame records the before-image of every write and replays the inverses in
reverse order — the port has thirteen known gestures, which is what makes an inverse
derivable rather than declared:

```
create(x)      →  delete(x.id)
update(id, p)  →  update(id, before)      one read before
delete(id)     →  create(row)             one read before
upsertAll(p)   →  restore what was there, delete what was not
```

What is lost is the isolation, and case 2 shows it — a reader on its own connection,
asked from inside the block:

```
transaction   inside the block, ada is 800 — and an outside reader sees ada 900
compensated   inside the block, ada is 800 — and an outside reader sees ada 800
```

The boot says which realization it built rather than letting the author assume the
stronger one. That is the whole point of stating it out loud.

## The mirror (case 4) — the second list

```ts
constructor(private together: Together<[RateCard, Ledger], [RateMirror]>) {}

await this.together.run(async ([rates, ledger], [mirror]) => { await mirror.refresh(); });
```

The first list is the entities the unwind covers. The second is **providers**, rebuilt
inside the frame so that what THEY write is covered too: `RateMirror` writes its pages
through `Storage<RateCard>`, so it receives the framed storage through its ordinary
constructor — no locator, no second injection path, and not one line of `Mirror` knows a
frame exists.

Two lists rather than one, because in a signature an entity and a provider are both
written as a class name and their instance types do not separate them. The type would have
to guess — by looking for methods, or for a brand — and both answers are worse than saying
it. They are two different facts anyway: what the unwind covers, and what is rebuilt to
make that true.

The rate that was overwritten comes back to its old value rather than being deleted, which
is the half an `upsert` hides.

## What a frame refuses, at boot

| | |
|---|---|
| a member whose frond is in `remotes:` | it registers no storage here — nothing to record, nothing to undo |
| a member that is neither an entity nor a class of the frond | a typo, whose only other symptom is a frame quietly one member short |
| a provider whose writes name an entity absent from the first list | they would escape the unwind |

And at the call, in a compensated frame only: `upsert` on an entity that declares a unique
constraint besides its key. The inverse of an upsert is derivable exactly when the conflict
is the key; MySQL's `onDuplicateKeyUpdate` fires on any unique constraint, so the question
is asked of the declaration and never of the engine.
