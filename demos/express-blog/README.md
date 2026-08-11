# express-blog — the additive case

```bash
pnpm -C demos/express-blog dev     # :3300
```

The only demo where Fougere is **not** the framework. `express()` is the server, it
renders its own HTML, it has its own routes, and Fougere is a guest:

```ts
app.use(fougereCall());       // your pages
app.use(fougereSession());    // your session
app.use(fougereRest());       // a public API — only because this demo wants one
```

Middlewares, like `express.json()` and `cors()` above them. `fougere()` mounts all
three in one line; mounting them separately is what an existing app usually wants,
since the envelope serves YOUR pages while REST is a surface anyone with the URL can call.

But mounting is not publishing. Whether REST answers at all is declared in
`fougere.config.ts`:

```ts
adapters: { rest: true }
```

Take that away and `/api/blog/posts` returns Express's own 404 while the envelope, the
pages and `/api/health` keep working — measured. The host puts the door in place; the
app decides what it serves.

`/api/health` still answers, and would even if registered after: a path Fougere does
not serve calls `next()`, which is Express's own passthrough — the earlier
`mountDoors` had invented one.

## Why Express costs an adapter and TanStack did not

Express is the only host in this repo that is not Web-standard: it hands a Node
`IncomingMessage`, and it parses nothing unless the app happens to have mounted
`express.json()`. `packages/http/src/express.ts` is that conversion, and it works
either way — it drains the stream itself when no parser ran, and trusts `req.body`
when one did. An adapter that only works when the host app is configured a
particular way would be useless for the case this demo exists to show.

One consequence visible here: this demo *does* mount `express.json()`, so malformed
JSON is refused by Express's own parser (a 400 HTML page) before Fougere sees it.
The adapter's own `400 BAD_REQUEST` is for apps without a parser; it is pinned in
`packages/http/tests/express.test.ts`, not here.

## Verified against the running server

```
GET  /api/health              → {"ok":true,"from":"the app, not fougere"}   200
GET  /api/blog/posts          → {"items":[…]}                               200
POST /_fougere/call           → {"jsonrpc":"2.0","id":1,"result":[…]}       200
GET  /_fougere/session        → {"user":null}                               200
DELETE /api/blog/posts        → Method DELETE not allowed — try GET, POST   405
POST /api/blog/posts {status} → VALIDATION_FAILED — status: Read-only       400
GET  /                        → the published post, rendered by Express
```

## The frond is the same file

```bash
diff -r ../next-blog/fronds fronds     # no output
```

There is no client package here and there is nothing to render with: an Express app
brings its own view layer. What it gets from Fougere is the three doors and a
server-side read named the same way every other host names it — `invokeOn(app, Post,
'list')`.
