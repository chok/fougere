# tanstack-blog — a third host, and no adapter package

```bash
pnpm -C demos/tanstack-blog dev     # :3200
```

## What this demo measures

`demos/next-blog` needed `@fougere/next`. This one needs **nothing**: there is no
`@fougere/tanstack` package, and there is no plan for one. It imports
`@fougere/app/web` for the doors and `@fougere/react` for the hooks — neither of
which knows what a host is.

```ts
// src/routes/api.$.ts — the whole REST integration
import { createFileRoute } from '@tanstack/react-router';
import { fougereRest } from '@fougere/app/web';

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: ({ request }) => fougereRest(request),
      POST: ({ request }) => fougereRest(request),
      // …
    },
  },
});
```

`request` is a standard Web `Request` and `fougereRest` returns a `Response`, so
there is nothing between them. That is what `@fougere/next` turned out to be too,
once the Web-standard half was pulled out of it: 124 lines, of which one import is
actually Next.

## The frond is the same file

```bash
diff -r ../next-blog/fronds fronds     # no output
```

Byte-identical. Same entity, same handler, same seed, same `fougere.config.ts`.
Nothing under `fronds/` imports react, next, vue or nuxt.

## Verified against the running server

```
GET  /api/blog/posts            → {"items":[{…,"status":"published"}]}      200
POST /_fougere/call             → {"jsonrpc":"2.0","id":1,"result":[…]}     200
GET  /_fougere/session          → {"user":null}                             200
DELETE /api/blog/posts          → Method DELETE not allowed — try GET, POST 405
POST /api/blog/posts {status}   → VALIDATION_FAILED — status: Read-only     400
/ · /drafts · /new                                                          200
```

The 405 and the refusal come from the same table and the same judge Next and Nuxt
answer from. No projection was re-described to get them here.

## The one host-specific thing

The wire path is `/_fougere/call`, and a leading underscore means something in both
React hosts — a *private folder* in Next, a *pathless layout route* in TanStack
Router. Two different reasons, two different escapes:

```
Next        app/%5Ffougere/call/[[...surface]]/route.ts
TanStack    src/routes/[_]fougere.call.ts
```

Both serve `/_fougere/call`. The route generator normalises the `[_]` back to `_`
in the generated id, so the file name is the only place the escape appears.

## Known limit

No `build` script, for the same reason as `demos/next-blog`: designation reads
`Class.name`, and a production minifier renames it. See that demo's README — the
constraint is the framework's, not the host's, and it is unresolved.
