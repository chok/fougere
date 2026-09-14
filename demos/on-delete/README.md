# on-delete — what a deletion does to the rows that name it

`ref(User, { onDelete })` says what becomes of a row when the one it names goes. It names no
database, no process and no key.

```ts
// fronds/blog/entities/Post.ts
authorId: ref(User, { onDelete: 'cascade' }),        // their posts go with them
editorId: optional(ref(User, { onDelete: 'set null' })),  // the post stays, the field empties
```

```ts
// fronds/discussion/entities/Comment.ts
postId: ref(Post, { onDelete: 'cascade' }),   // it goes with the post it hangs off
authorId: ref(User),                          // unstated: its author may not go while it stands
```

## Who carries it out

| the two sides | who | what it costs |
|---|---|---|
| one source that keeps relations | the engine, `on delete …` | nothing — one statement |
| two sources | the framework, deepest first | one read per relation |
| two processes | the one that holds the rows | a crossing, then its own tree |

One line of `fougere.config.ts` moves between the first two:

```ts
// sources: { archive: { path: '.data/archive.db', entities: ['Comment'] } },
```

Run it as it stands, then uncomment and run again. The entities do not change, and neither
does what is left.

```
4. deleting ada — her posts go, and the comments hanging off them too
   before  users ada,bob · posts p1,p2 · comments c1 · p1.editor none
   →       done
   after   users bob · posts — · comments — · p1.editor gone
```

What DOES change is who refuses, and it reads differently:

```
one engine   FOREIGN KEY constraint failed
split        comment.authorId holds 1 row(s) naming this one, and states onDelete 'restrict'
```

## Why one hop decides for the whole tree

A cascade the engine runs never passes through the framework: it deletes the rows itself, and
nothing here sees it happen. So a hop the engine owns ABOVE a hop it does not would take posts
out with their comments left behind, naming nothing.

One unkeyed hop anywhere below, and the framework takes the whole tree. The engine's own
cascade then finds nothing left to do, because the framework walks deepest first and the row
goes last.

## What the order buys

Children before their parent means no intermediate state is ever wrong: an interruption leaves
FEWER children, never an orphan. That is what lets a release cross a process without a
two-phase commit — there is nothing to undo, only something to finish.

`@fougere/workflow` is what finishes it. Its journal is one entity, and the run says somebody
started:

```
the journal holds 3 run(s): user:bob done, user:carol done, user:ada done
```

Leave the package out and the same hops happen in the same order; what is interrupted simply
stops. The rows are consistent either way.

```bash
pnpm -C demos/on-delete dev
```
