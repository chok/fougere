# sveltekit-blog — a second UI framework, one package

```bash
pnpm -C demos/sveltekit-blog dev     # :3500
```

## One package, not two

`@fougere/svelte` holds the four primitives. There is **no `@fougere/sveltekit`**,
and that is not an omission: SvelteKit serves Web-standard `Request`/`Response` from
`+server.ts`, and it hands every `load` function its own `event`, so there is no
ambient-request lookup to package. The doors mount straight from `@fougere/app/web`.

Compare: `@fougere/next` exists and is 124 lines, of which the substance is one
import — `next/headers`. A host package earns its existence only when the host has
something genuinely its own.

```ts
// src/routes/_fougere/call/+server.ts
import { fougereCall } from '@fougere/app/web';
export const POST = ({ request }: { request: Request }) => fougereCall(request);
```

No underscore escape either — SvelteKit routes a `_fougere` directory literally.

## Stores, not runes — a packaging decision

`@fougere/svelte` is written with `svelte/store`, not runes. A `.svelte.ts` file
needs the Svelte compiler to run over it, so a library shipping runes ships SOURCE
and forces every consumer's bundler to compile it. This scaffold's own `vite.config.ts`
says as much: it forces runes mode for the project *except* under `node_modules`.

Stores are plain TypeScript, build with `tsc` like every other package here, and a
component still writes `$posts` and `bind:value={$values[field.name]}`. The
consumer's ergonomics are unchanged; only the packaging is honest.

The one thing Svelte says out loud that the others hide: the link has to forget a
read when its page goes. React does it in an effect teardown, Vue in
`onScopeDispose`, and here it is `onDestroy(() => drafts.dispose())`.

## Verified against the running server

```
GET  /api/health              → {"ok":true,"from":"the app, not fougere"}  200
GET  /api/blog/posts          → {"items":[…]}                              200
POST /_fougere/call           → {"jsonrpc":"2.0","id":1,"result":[…]}      200
GET  /_fougere/session        → {"user":null}                              200
DELETE /api/blog/posts        → Method DELETE not allowed — try GET, POST  405
POST /api/blog/posts {status} → VALIDATION_FAILED — status: Read-only      400
/ · /drafts · /new                                                         200
```

`/api/health` is the app's own route under the prefix the REST door also claims —
SvelteKit matches the specific route first, so mounting the door took nothing away.

`diff -r ../next-blog/fronds fronds` is empty.
