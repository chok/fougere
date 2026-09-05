# next-blog — the same frond, a second host

`demos/nuxt-blog` proves a Frond does not care whether it runs in-process or behind
JSON-RPC. This one proves it does not care which framework hosts it either.

```bash
pnpm -C demos/next-blog dev     # :3100
```

## What to look at

`fronds/blog/` is ordinary user code — an entity, a handler, seeds. Grep it for
`next`, `react`, `nuxt` or `vue` and you get nothing: the only imports are
`@fougere/schema` and `@fougere/core`. It is the same shape `demos/nuxt-blog`
carries, minus the author relation this demo has no use for.

Three doors answer from that one declaration:

```bash
curl localhost:3100/api/blog/posts                      # REST projection
curl -X POST localhost:3100/_fougere/call \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"post.list","params":{}}'
```

and the pages: `/` reads through a server component (`invoke`), `/drafts` through
the couple (`useQuery` + `useCommand`), `/new` through the form contract
(`useFormFor`).

## What installing it actually took

Three files, one line each — Next has no module API, so routes are mounted the way
better-auth and tRPC mount theirs:

```
app/_fougere/call/[[...surface]]/route.ts   export { POST } from '@fougere/next/call';
app/_fougere/session/route.ts               export { GET } from '@fougere/next/session';
app/api/[...fougere]/route.ts               export { GET, POST, PUT, PATCH, DELETE } from '@fougere/next/rest';
```

plus `serverExternalPackages` in `next.config.mjs`, because the scan reads frond
sources off disk at boot and they must not be bundled. Nothing else in an app moves:
pages, layouts, your own `app/api/*` handlers and an existing auth setup are
untouched — Next resolves a static route before a catch-all, so adding the REST door
takes nothing away.

## The validator, from the browser

`/new` renders two inputs, not six — `title` and `body`. `id` and `createdAt` are
filled by the lifecycle axis; `status` and `publishedAt` are `readOnly`, so they are
not in `Visibility.input` and no form can offer them — the same reason a `create`
naming `status` is refused at the façade. Try it:

```bash
curl -X POST localhost:3100/api/blog/posts \
  -H 'content-type: application/json' \
  -d '{"title":"x","body":"y","status":"published"}'
# VALIDATION_FAILED — status: Read-only
```

`title` carries `minlength`/`maxlength` on the input because its shape declares
`min`/`max`. The page states no rule of its own; it spreads what the entity says.

## Production builds

`pnpm build` works, and `next.config.mjs` is why:

```js
import { withFougere } from '@fougere/next/config';
export default withFougere();
```

Designation is class + verb — `invoke(Post, 'list')` reads `Post.name` — and Next's
minifier renames the class, so a production build used to ask for an entity nobody
hosts (`Entity 'j' is not hosted here. Hosted here: post`). `withFougere` replaces
the minimizer with terser configured to keep class names, and lists the packages a
boot loads at runtime. Everything else is still mangled.

The fix lives in the adapter, not in the framework: a host-specific problem gets a
host-specific answer, and no entity has to declare anything twice.

Two things measured on the built output:

```
.next/static/chunks/*.js    class Post extends …    ← the browser keeps the name
```

and the production server boots **once** for all four doors — the repeated boots
visible in `next dev` are a dev-mode artifact of per-route compilation.

`.mjs` rather than `.ts`: Next loads a TypeScript config through a CommonJS require,
and `@fougere/next` is ESM-only, so the subpath does not resolve there.

## The topology is still one line

`fougere.config.ts` has `remotes:` commented out. Uncomment it, start the blog frond
in its own process, and none of the pages, the handler or the entity change.
