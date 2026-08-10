# react-router-blog — a fourth host, still no adapter

```bash
pnpm -C demos/react-router-blog dev     # :3400
```

React Router v7 in framework mode. Like the TanStack demo, it needs **no Fougere
package of its own**: `@fougere/app/web` for the doors, `@fougere/react` for the
hooks.

```ts
// app/routes/fougere.rest.ts — the whole REST integration
import { fougereRest } from '@fougere/app/web';

export const loader = ({ request }: { request: Request }) => fougereRest(request);
export const action = ({ request }: { request: Request }) => fougereRest(request);
```

`loader` takes GET, `action` takes the rest — that split is React Router's, not
ours. `fougereRest` reads the verb off the request and matches it against the table
`schema-rest` generates, which is why the 405 below names the right verbs.

## What it did NOT need

An escape for the leading underscore. Next needs `%5F` (a `_` folder is private) and
TanStack Router needs `[_]` (a `_` segment is a pathless layout) because both derive
the URL from the file name. React Router declares its paths in `app/routes.ts`, so
`_fougere/call` means `/_fougere/call`, full stop.

## Verified against the running server

```
GET  /api/blog/posts          → {"items":[…]}                              200
POST /_fougere/call           → {"jsonrpc":"2.0","id":1,"result":[…]}      200
GET  /_fougere/session        → {"user":null}                              200
DELETE /api/blog/posts        → Method DELETE not allowed — try GET, POST  405
POST /api/blog/posts {status} → VALIDATION_FAILED — status: Read-only      400
/ · /drafts · /new                                                         200
```

`diff -r ../next-blog/fronds fronds` is empty — same entity, same handler, same seed.
