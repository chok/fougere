# Door lifecycle — measure and plan

Status: the open questions are decided (section 5, 2026-10-19). No file under `packages/` was changed. Every claim cites a file and a symbol.
The probe used for section 1.9 is a throwaway Node script that imported the built packages; it is
not committed. Its output is quoted where it is used.

Vocabulary used below:

- **op**: a handler method, `post.publish`.
- **door**: one way to call an op from outside — REST, GraphQL, JSON-RPC, the terminal, the web
  hosts, the in-process call.
- **middle**: what core does once per call, whatever the door (`HandlerFacade.execute` and
  `HandlerFacade.answer`).
- **edge**: what a door does before and after the middle.

---

## 0. Summary

1. **The middle is already one piece of code.** Every door reaches the middle through the same
   function (`Dispatcher.dispatch` → `OperationRoute.execute` → `HandlerFacade.execute`). No door
   validates, binds or projects on its own. The promise holds today.
2. **The edges are where the copies are.** REST alone has two full realizations that disagree
   (`adapter/rest/src/register.ts` `registerRoutes` and `app/shared/src/Outcome.ts` `serveRest`).
   There are nine body readers, three error mappers, and one door (GraphQL) that maps none and
   leaks internal error messages. Measured in 1.9.
3. **Recommendation:** open **one** hook per door at the start — a door middleware that wraps
   `decode → middle` and runs before `encode`. It covers three of the four test cases; the fourth
   (CSV) moves to a separate media-type project (3.4). The output of the
   middle becomes one ordered list (`AnswerStep`s, then `view.project` last and fixed). Ordering is
   a list, refused when ambiguous, like `middlewares:` already is. No topological sort.
4. **Before any hook:** merge the two REST realizations into one edge. Otherwise every hook is
   written twice, and the two copies already disagree on status codes.

---

## 1. The path of a call, door by door

### 1.0 The middle (shared by every door)

Order, read in the code:

| # | Step | Where |
|---|------|-------|
| m1 | resolve the route, count the call, publish `received`/`resolved` | `core/src/dispatch/Dispatcher.ts` `Dispatcher.dispatch`, `routeFor`; `dispatch/InFlight.ts` |
| m2 | judge the state as it arrived (skipped when `crossed`) | `dispatch/HandlerFacade.ts` `execute` → `facade.state.judge` |
| m3 | run the frond's middlewares (`around`) | `wire/AppMiddleware.ts` `runMiddlewares`, list built in `boot/install.ts` `registerMiddlewares` |
| m4 | enter the operation context (for `during` on log lines) | `HandlerFacade.execute` → `facade.enterOperation` |
| m5 | judge the state again (what middlewares wrote) | `HandlerFacade.answer` → `state.judge(…, entered)` |
| m6 | validate the input (skipped when code wrote `args`) | `dispatch/validateInput.ts` `validateInput` |
| m7 | bind arguments | `dispatch/ArgumentResolver.ts` `resolve` (door) or `given` (code); `BindingSources` registry for `fact`, `pipe`, `collector` |
| m8 | run the method | `HandlerFacade.resolveImplementation` + call |
| m9 | answer steps (skipped when `args` written, view closed, or no step) | `HandlerFacade.stepped`; steps from `boot/install.ts` `stepsOver` ← `Extension.steps`; the only one in the tree is `module/presenter/presenters.ts` `presenters` |
| m10 | project onto the view | `dispatch/OutputView.ts` `OutputView.project` |
| m11 | publish `completed`/`failed`/`settled`, release the flight | `Dispatcher.dispatch` |

Outside the middle, but shared:

- **decode back** (`dispatch/decoded.ts` `decoded`): applied by the facade a caller holds. It runs
  for doors that get their calls from `App.facadeFor` (`boot/bootstrap.ts` `callsAt`), and not for
  doors that use `createAppRunner` (`boot/runner.ts`).
- **error to HTTP** (`core/src/wire/http-error.ts` `toHttpError`, `toPublicError`): the one place
  that masks `INTERNAL_ERROR`. Called by `adapter/rest/src/register.ts`, `app/shared/src/Outcome.ts`
  and `transport/http/src/server.ts` (as `toPublicError`). Not called by GraphQL nor oclif.

`DispatchLifecycle` (`dispatch/DispatchLifecycle.ts`) only observes m1 and m11. One reader in the
tree: `@fougere/calls` (`calls/src/index.ts`, `app.observe`). Observability uses a middleware
(`observability/src/extension.ts`, `app.use(tracer.middleware)`), and so does `@fougere/log`
(`log/src/index.ts`, `app.use(callLines(…))`).

### 1.1 REST over an `HttpRouter` (Express, Fastify, Hono)

```
receive   http/src/express.ts createExpressRouter.on (app[method](path, …))      [Express owns routing]
          http/src/fastify.ts, http/src/hono.ts — same role
context   http/src/express.ts buildContext → RequestContext
host mw   http/src/router/HttpRouter.ts chain (router.use)                       [writes ctx.state]
match     done by the host framework, from the path generateRoutes computed:
          adapter/rest/src/routes/RouteDefinition.ts generateRoutes → routesOf → routeFor
decode    adapter/rest/src/register.ts registerRoutes: ctx.body()
            → http/src/express.ts readExpressBody / readRawBody
            → builds { params, query, input, state } by hand
call      route.handler → facade[op] (App.facadeFor → bootstrap.ts callsAt → entry/facade.ts callOperations)
          → middle → decoded (dates put back)
encode    register.ts registerRoutes: status by op NAME (findById null → 404, delete true → 204,
          delete false → 404, create → 201, else successStatus ?? 200); errors via toHttpError
send      http/src/express.ts sendResponse (res.set, res.status, res.json | res.send when raw)
```

- Copied: body reading (see 1.8), the 400/413 answers (`createExpressRouter.on` catch), status
  choice (see 1.2).
- Redoes part of the middle: none. But `encode` decides on the **op name** (`'findById'`,
  `'delete'`, `'create'`), which the contract already says better (`cardinality`, the REST method
  from `deriveMethod`).
- A non-JSON body becomes `{}` in silence: `readExpressBody` (`!contentType.includes('json')`) and
  `http/src/hono.ts` `body`. Fastify refuses it with its own 415.

### 1.2 REST through a web host (Nuxt, Next, Vite, Express helper)

A second REST realization. It does not use `registerRoutes`.

```
receive   Nuxt:    app/nuxt/src/runtime/server/api/crud.ts (h3 defineEventHandler)
          Next:    app/next/src/routes/rest.ts → app/shared/src/web.ts rest
          Vite:    app/vite/src/index.ts serveDoors → @fougere/app/web
          Express: app/shared/src/express.ts rest
state     app/shared/src/state.ts stateFor (better-auth cookie) | app/nuxt/src/runtime/server/stateOf.ts
decode    Nuxt: h3 readBody (no size limit) | web.ts: request.json() (no size limit)
          | express.ts: readExpressBody(req, maxBodyBytes())
match     app/shared/src/RouteMatch.ts tableOf (generateRoutes, then DROPS successStatus — see Matchable.ts)
          → matchRoute (own router, 405 with `allow`)
call      app/shared/src/Outcome.ts serveRest → invokeOn → createAppRunner (no `decoded`)
encode    Outcome.ts shapeRest: null → 404 for ANY op, `list` array → { items, total, … }, else 200
          errors via toHttpError
send      Nuxt: setResponseStatus / createError | web.ts: Response.json | express.ts: res.status().json()
```

- Copied: the whole REST edge (match, decode, encode). `shapeRest` and `registerRoutes` are two
  answers to the same question.
- Drops a decision: `protocols.rest.status` (`adapter/rest/src/RestProtocol.ts` `ROUTE`) reaches
  `RouteDefinition.successStatus`, which `Matchable` has no field for. On Nuxt, Next and Vite the
  override is read and ignored.
- Drops headers on success: `web.ts` `rest` writes `outcome.headers` only on error.

### 1.3 GraphQL

```
receive   (a) app/shared/src/web.ts graphql | app/shared/src/express.ts graphql | app/nuxt/…/routes/graphql.post.ts
              → app/shared/src/graphql.ts serveGraphQL → Protocols.resolve('graphql').executeOn
          (b) adapter/graphql/src/serve.ts registerGraphQL (on an HttpRouter)
match     graphql-js (schema built once per app and surface: adapter/graphql/src/app.ts schemaOf)
decode    adapter/graphql/src/OperationsConfig.ts buildArgsFromSignature → buildInvocation
          (args → params / input / pagination options, from the binding plan)
call      config.facade[op](invocation) → App.facadeFor → middle → decoded
encode    graphql-js ExecutionResult; list wrapper shaped in registerOperations; `_count` calls the op AGAIN
send      200 always (graphql.ts serveGraphQL), errors in the body
```

- Redoes part of the middle: `buildArgsFromSignature` decides "is this a mutation" by name
  (`opName === 'create' || opName === 'update'`) to strip non-client fields. The input view
  (`Visibility.of(...).input`) is what the middle validates anyway.
- Relation resolvers (`adapter/graphql/src/auto-register.ts`, the `findById` and `list` calls in
  `registerAll`) call the target facade with `state: {}`: the caller's state does not follow a
  nested field.
- `registerGraphQL` (b) calls `graphql()` with no `contextValue`, so `buildInvocation` reads
  `gqlCtx?.state ?? {}` → the router middleware's `ctx.state` never reaches the op.
- **No error mapping at all.** See 1.9: an internal message leaves the process.

### 1.4 JSON-RPC between processes

```
receive   transport/http/src/serve/RunningReceiver.ts answering (node:http)
          | transport/http/src/receive.ts (Web Request: hono, Worker, Next)
decode    bodyWithin / the loop in answering (limit = maxFrameBytes), JSON.parse
          transport/http/src/server.ts handleRpc: envelope check, SENT allow-list, verify → state, crossed: true
call      runner = createLocalRunner/createAppRunner (boot/runner.ts) → entry/transport.ts createTransportEntry → middle
encode    handleRpc: result | toPublicError(failure)
send      200 + JSON always
```

- Shares with the browser envelope (1.6): `handleRpc` is reused by `app/shared/src/Outcome.ts`
  `serveRpc`. Good.
- Copied: body reading (two readers inside this one package).

### 1.5 Terminal (oclif)

```
receive   app/oclif/src/index.ts serve → oclif Config + insertLegacyPlugins
match     oclif command id `address:op` (commandsOf)
decode    oclif flags/args → app/oclif/src/bridge.ts inputOf | paramsOf
call      app.facadeFor(address)[op]({ input } | { params })   — no state at all
encode    this.logJson(result)
send      stdout; a throw is printed by oclif (no toPublicError — acceptable for a local user)
```

- Redoes part of the middle: none. It reads the contract to build flags, which is a derivation.

### 1.6 Browser call envelope (`/_fougere/call`)

```
receive   Nuxt: app/nuxt/src/runtime/server/routes/call.post.ts | web.ts call | express.ts call
decode    Nuxt: readJsonBody → readWebBody → parseRawJson (3 branches, each with the limit)
          web.ts call: content-length check only, then request.json() (no count when the header is absent)
call      Outcome.ts serveRpc → handleRpc (refuses `args` from a page) → createAppRunner → middle
encode    handleRpc
send      JSON, 200
```

### 1.7 In-process call

```
code      the facade a handler asks for: boot/install.ts registerValue(facadeKey, facadeOperations(…))
          → entry/facade.ts facadeOperations → sending → dispatcher.dispatch
          (args written → ArgumentResolver.given; validateInput and answer steps skipped)
host      Next: app/next/src/invoke.ts invoke | Nuxt: app/nuxt/src/runtime/server/utils/invoke.ts invoke
          → app/shared/src/Outcome.ts invokeOn → createAppRunner → middle
```

No edge. This is the reference: whatever a door adds must leave this path untouched.

### 1.8 What is copied, counted

**Body readers: 9 places**, with 4 different limit behaviours.

| Where | Limit |
|---|---|
| `http/src/express.ts` `readRawBody`, `readExpressBody` | counted while reading |
| `http/src/hono.ts` `body` (`c.req.json()`) | none |
| `http/src/fastify.ts` `body` | Fastify's own |
| `transport/http/src/receive.ts` `bodyWithin` | header, then counted |
| `transport/http/src/serve/RunningReceiver.ts` `answering` | counted |
| `app/nuxt/src/runtime/server/routes/call.post.ts` `readJsonBody`, `readWebBody`, `parseRawJson` | header, then counted |
| `app/nuxt/src/runtime/server/api/crud.ts` (h3 `readBody`) | none |
| `app/shared/src/web.ts` `call` | header only |
| `app/shared/src/web.ts` `rest`, `graphql` | none |

**Status decided: 3 places** — `register.ts` `registerRoutes`, `Outcome.ts` `shapeRest`,
`graphql.ts` `serveGraphQL` (always 200), plus the transport's fixed 200.

**Error mapping: 3 places plus 2 absent** — `toHttpError` (REST ×2), `toPublicError` in
`handleRpc`; nothing in GraphQL; oclif prints.

**State resolved: 5 ways** — `HttpRouter` middleware (`ctx.state`), `stateFor(headers)`,
`stateOf(event)` (Nuxt), `verify()` (JSON-RPC), nothing (oclif, `registerGraphQL`).

### 1.9 Measured: the same op through every door

Probe: one frond, ops `find`, `boom` (throws `new Error('secret at /etc/db.sqlite')`), `remove`
(returns `false`), and the Crud names `findById` (returns `null`), `create`, `delete` (returns
`true`). Called through `registerRoutes`, `serveRest`, `executeOn` and `serveRpc`.

```
registerRoutes GET    /api/blog/posts/:id      → 404 {"error":"Not found"}
serveRest      GET    /api/blog/posts/1        → 404 {"message":"Not found"}
registerRoutes POST   /api/blog/posts          → 201
serveRest      POST   /api/blog/posts          → 200
registerRoutes DELETE /api/blog/posts/:id      → 204 null
serveRest      DELETE /api/blog/posts/1        → 200 true
registerRoutes DELETE /api/blog/posts/:id/remove → 200 false     (the 404 rule is for the NAME 'delete' only)
serveRest      DELETE /api/blog/posts/1/remove   → 200 false
registerRoutes POST   /api/blog/posts/boom → 500 {"code":"INTERNAL_ERROR","message":"Internal error"}
serveRest      POST   /api/blog/posts/boom → 500 {"code":"INTERNAL_ERROR","message":"Internal error"}
rpc            post.boom → {"code":"INTERNAL_ERROR","message":"Internal error", …}
gql  mutation { boom { id } } → [{"message":"secret at /etc/db.sqlite", "path":["boom"]}]
```

Three facts from this:

1. The two REST edges disagree on 3 of 6 ops, and on the shape of a 404 body.
2. A status rule keyed on an op name does not follow an op that means the same thing under
   another name (`remove`).
3. GraphQL hands an internal error message to the caller. This is a defect today, independent of
   this plan (fix: a `formatError`/resolver wrapper that goes through `toPublicError`).

---

## 2. The steps

### 2.1 The middle (core, one time, no door touches it)

```
judge state → [ Middleware ( judge state again → validate → bind → run → answer steps → project ) ]
```

These are m2–m10. Nothing moves. What changes is only how the output half is written (2.3).

### 2.2 The edges (per door)

| Door | receive | match | decode | encode | send |
|---|---|---|---|---|---|
| REST | native request (`Request` or Node `req`) | route table from `generateRoutes` | headers, then body → `{ params, query, input }` | value → status, headers, body; error → `toHttpError` | native response |
| GraphQL | HTTP request | graphql-js field | args → invocation (`buildInvocation`) | field value / error | one HTTP response for the whole document |
| JSON-RPC | HTTP request | `address.op` | envelope, `SENT`, `verify` | result / `toPublicError` | 200 JSON |
| oclif | argv | command id | flags → invocation | `logJson` | stdout |
| in-process | — | — | — | — | — |

The native context at each step, for REST:

| Step | What a hook can read | What it can write |
|---|---|---|
| receive | method, URL, headers | — |
| match | the route, the op's `EffectiveOperation` | — |
| decode | headers, the body stream (not yet read) | refuse |
| (middle) | `OperationContext`, unchanged | — |
| encode | the answer, the request's `Accept` | status, headers, body |
| send | the native response object | anything (this is the host's level) |

### 2.3 Where `AnswerStep`, `view.project` and `DispatchLifecycle` go

**Output becomes one ordered list, dual of `BindingSources`.**

- Today: `HandlerFacade.answer` runs `stepped` (a list from `Extension.steps`) and then
  `view.project` (hard-coded). That is already a list plus one fixed last item.
- Proposal: the list is the facade's `steps`, and `project` is always its last item, held by core
  and not removable. `project` is what the card promises (`CardOp.output`), so no extension may run
  after it. One loop, no special case: `for (const step of [...steps, project]) value = await step(value, …)`.
- The three skips stay where they are: `written` (code wrote `args`), `view.closed`, no step. They
  are conditions on the list, not other mechanisms.
- **Media type is not a core step.** It is a property of the bytes, so it belongs to `encode`, at
  the door. Core answers a value; the door turns it into bytes. Choosing that representation is
  **out of scope here**: it is the media-type project (see 3.4).
- **Writing state is out of scope, and not settled.** Middlewares do write `context.state`, and
  `HandlerFacade.answer` judges what they wrote (`state.judge(…, entered)`), but that only covers a
  value living for one call. Keeping a value across calls is a separate project: the dual of a
  binding source, where an op writes (`keep('cart', id)`), a `state:` key in the config picks
  where it lives (cookie, session, localStorage), and `@fougere/http` writes `Set-Cookie` for every
  HTTP door.
- **Dual of `BindingSources`, but not a registry yet.** `BindingSources` is a `Registry` because a
  parameter's kind arrives as data (`kind: 'collector'`). An answer step arrives with its extension,
  in ascent order (`stepsOver` in `boot/install.ts`). A registry would add a name with nothing to
  look it up. Keep the list; give it the same type and loop as an input source.

`DispatchLifecycle` stays an observer — it never participates in decisions
(`DispatchLifecycle.publish` swallows observer errors) — and it widens to the edges: the door
lifecycle publishes its steps to it (decision 8).

### 2.4 How many hooks to open

**Recommendation: one per door, at first — a door middleware wrapping `decode → middle`.**

```
REST:  receive → match → [ RestMiddleware ( decode → middle ) ] → encode → send
```

- It runs **before** the body is read (case 3) because `decode` happens inside `next()`.
- It sees the **answer** after `next()` (case 1).
- It can **add headers** through a response-headers bag that `encode` merges (case 2).
- `next()` resolves to the projected answer `T`, never to bytes. So a middleware that does not
  declare `Response<…>` can only return `T` (the rule `AppMiddleware` already states).

What each extra hook would cost:

| Extra hook | Gives | Costs |
|---|---|---|
| at `match` | rewrite which op answers | the card's derived paths stop being the truth; a hidden route |
| separate `decode` step list | custom body formats (multipart, CSV in) | a second list beside the middleware; an input contract the scan cannot see |
| separate `encode` list (encoders by media type) | one CSV encoder for every op | not a list of types (what the owner rejects is a type each adapter must learn, like `Redirect` or `File`), but a project of its own: see 3.4 |
| at `send` | streaming, files, SSE | bypasses `encode`, so nothing it sends can be on the card; this is `router.use` / the host already |

None of the four test cases needs them. Open them when a case does, one at a time.

### 2.5 How a hook is placed

**An ordered list, refused when ambiguous — the rule `middlewares:` already uses.**

- Measured: every ordering in the tree is a list stated by its owner, and ambiguity refuses:
  `middlewares: ['Timing', 'Audit']` (`compiler/src/scan/scanner.ts`, codes `middlewares-unordered`,
  `middlewares-unlisted`), `pipes: { fact: [...] }`, `ports: { Payment: ['Retrying', 'Stripe'] }`.
- `@fougere/graph` is used for seeds, relations, dependency cycles and hosting
  (`core/src/boot/seed.ts`, `boot/dependencyCycles.ts`, `module/relation/*`) — never for the order
  of code around a call.
- "After X" needs a sort, and a sort gives one order among several valid ones. A wrapper order is a
  decision, and the tree's rule is that a decision has one owner who writes it.
- Global before per-handler: the frond-wide `RestMiddleware()` stands outside the per-handler one,
  the way a frond's middlewares stand outside its child's (`Assembly.middlewaresOf`).

### 2.6 The shape of a door middleware

```ts
// fronds/blog/middlewares/Powered.ts — frond-wide: decorates and refuses, never replaces
export class Powered extends RestMiddleware() {
  async around<T>(context: RestContext, next: AppNext<T>): Promise<T> {
    const answer = await next();
    context.response.headers.set('x-powered-by', 'fougere');
    return answer;
  }
}

// fronds/blog/middlewares/PostRest.ts — per handler: methods named like the ops
export class PostRest extends RestMiddleware(PostHandler) {
  async findBySlug(context: RestContext, next: AppNext<Post>): Promise<Post | Response<301, { location: string }>> { … }
}
```

- `RestMiddleware()` returns a class that extends core `Middleware`. A static marks its door
  (`'rest'`), read from the `Protocols` registry (`core/src/Protocol.ts`), which already holds
  `rest` and `graphql`. No new registry.
- Core's `registerMiddlewares` (`boot/install.ts`) skips a middleware that names a door; the REST
  adapter collects it. Without that skip, core would run it around every op of every door.
- Per handler: the scan checks each method name against the handler's ops (refused otherwise, like
  `operations:` overrides refuse a key naming nothing, `core/tests/operation-overrides.test.ts`).
- `Response<Status, Headers, Body>` is read by its **fields** `status` and `headers` on the checked
  type, not its type arguments: the scan loses type arguments behind an alias (KNOWN_ISSUES, "A
  type alias of a port does not bind", `handler-parser.ts` `parseCheckedType`). A `status` that is
  not a literal refuses the boot.
- It lives in `middlewares/`, the existing directory, ordered by the existing `middlewares:` list.

Which of the six existing forms each part uses: the middleware is a **wrapping**; the door marker
is a **reading** of the `Protocols` registry; `Response<…>` is a **reading** by the scan; an open
status is a **boot refusal**. No new concept.

---

## 3. The four test cases

### 3.1 A 301 from an old slug, in a per-handler REST middleware

```ts
export class PostRest extends RestMiddleware(PostHandler) {
  constructor(private slugs: OldSlugRepository) { super(); }

  async findBySlug(context: RestContext, next: AppNext<Post>): Promise<Post | Response<301, { location: string }>> {
    try {
      return await next();
    } catch (error) {
      if (!(error instanceof FougereError) || error.code !== ErrorCode.NOT_FOUND) throw error;
      const moved = await this.slugs.findOne({ where: { old: context.params.slug } });
      if (!moved) throw error;
      return { status: 301, headers: { location: `/api/blog/posts/by-slug/${moved.slug}` } };
    }
  }
}
```

- Hook: the door middleware (around `decode → middle`), per handler, method `findBySlug`.
- `encode` sees a `Response` and writes it as is.
- GraphQL and JSON-RPC calling `post.findBySlug` with the old slug still get `NOT_FOUND`. That is
  correct: a redirect is an HTTP fact.
- Card / OpenAPI: `findBySlug` gains, under its REST realization, `responses: [{ status: 301,
  headers: ['location'] }]`, read from the declared return type. The 200 stays the op's own output.

### 3.2 A custom header on every response of a frond

```ts
export class Powered extends RestMiddleware() {
  async around<T>(context: RestContext, next: AppNext<T>): Promise<T> {
    try { return await next(); }
    finally { context.response.headers.set('x-frond', 'blog'); }
  }
}
```

- Hook: the frond-wide door middleware; writes the headers bag, returns `T`.
- `finally` puts it on errors too.
- Card / OpenAPI: nothing. A header written on a bag is not a declared response, and the frond-wide
  form cannot declare one. Decided (5.5): it stays invisible.

### 3.3 An upload refused on its headers (2 GB) before the body is read

```ts
export class UploadLimit extends RestMiddleware() {
  async around<T>(context: RestContext, next: AppNext<T>): Promise<T> {
    const declared = Number(context.request.headers.get('content-length'));
    if (declared > 2 * 1024 ** 3) {
      throw new FougereError({ code: ErrorCode.PAYLOAD_TOO_LARGE, message: 'Uploads stop at 2 GB.' });
    }
    return next();   // decode — and the body read — happen in here
  }
}
```

- Hook: the frond-wide door middleware, before `next()`.
- This only works if `decode` is inside `next()`. Today `registerRoutes` reads the body **before**
  calling anything (`await ctx.body()` is its first line). This is the one test case that forces
  the edge to change shape.
- Note: a header can lie or be absent. The counted limit stays in the body reader
  (`maxBodyBytes`, `wire/BodyLimit.ts`). The middleware is the early, cheap refusal.
- Card / OpenAPI: nothing today. `refusalsOf` (`core/src/wire/refusals.ts`) lists the framework's
  refusals (`SERVICE_UNAVAILABLE`, `VALIDATION_FAILED`, `BAD_REQUEST`, the gateway pair) and not
  `PAYLOAD_TOO_LARGE`, though every door that reads a body can answer it. Adding it there is the
  derived form: it follows from having an input, like `VALIDATION_FAILED`. A size the middleware
  picks itself (2 GB) is not on the card — decided in 5.7.

### 3.4 `text/csv` instead of JSON for the same op (by `Accept`)

> **Replaced by the media-type project (decided 2026-10-19).** The code below shows what a door
> middleware *can* do. It is not the intended form: a `toCsv` written op by op is a copy waiting to
> happen. The media type is a project of its own — a generic projection chosen by `Accept`, where the
> card itself becomes a media type (OpenAPI, SDL). What the owner rejects is a type each adapter must
> learn (`Redirect`, `File`…), not encoders. This plan builds nothing for this case.

```ts
export class PostRest extends RestMiddleware(PostHandler) {
  async list(context: RestContext, next: AppNext<Page<Post>>)
    : Promise<Page<Post> | Response<200, { 'content-type': 'text/csv' }, string>> {
    const page = await next();
    if (!context.request.headers.get('accept')?.includes('text/csv')) return page;
    return { status: 200, headers: { 'content-type': 'text/csv' }, body: toCsv(page.items) };
  }
}
```

- Hook: the per-handler door middleware, method `list`.
- The op still answers `Page<Post>`; the middle, its validation and its projection are unchanged.
  Only REST learns a second representation.
- `encode` must send a string body without JSON-encoding it. `ResponseResult.raw` already exists
  (`http/src/router/ResponseResult.ts`, written by `sendResponse` in `express.ts`/`hono.ts`), so the
  wire half is there.
- Card / OpenAPI: `list` → 200 → two media types: `application/json` (the op's output schema) and
  `text/csv` (body `string`). Derived from the return type's `headers['content-type']` literal.

---

## 4. What breaks or moves

| Change | Size (estimate) | Tests that pin today's behaviour |
|---|---|---|
| **Merge the two REST edges** into one in `adapter-rest` (`registerRoutes` + `serveRest`/`shapeRest`/`matchRoute`), with the router and the web hosts as thin `receive/send` shells. One status rule, read from the contract and `protocols.rest.status`, not the op name | ~200 lines moved, ~120 removed | `adapter/rest/tests/fastify.test.ts` (201/204/404), `app/shared/tests/serve.test.ts` (`shapeRest`: 200, 404), `app/shared/tests/restRoutes.test.ts`, `app/shared/tests/express.test.ts`, `testing/src/DoorContractCase.ts` |
| **Move `decode` inside the door chain** (read the body after the door middleware runs) | ~30 lines in the merged edge | `http/tests/express.test.ts`, `http/tests/adapters.test.ts` (body, 400, 413) |
| **One body reader per runtime** (Web `Request`, Node stream) with the counted limit, used by REST, the browser envelope and JSON-RPC | −150 lines across 9 sites | `transport/http/tests/limit.test.ts`, `receive.test.ts`, `app/nuxt/tests/*` (none pin the limit today) |
| **Output as one list** (`steps` + `project` last) in `HandlerFacade.answer` | ~20 lines | `core/tests/egress-objects.test.ts`, `core/tests/extension-doors.test.ts`, `adapter/rest/tests/presenter-value.test.ts`, the GraphQL presenter tests |
| **Core skips door middlewares** in `registerMiddlewares` | ~10 lines | `core/tests/middleware-frond.test.ts`, `middleware-base.test.ts`, `compiler/tests/middleware-form.test.ts` |
| **Scan: `RestMiddleware(Handler)` methods and `Response<…>` fields**, refusals for an unknown op name and an open status | ~150 lines in `compiler/src/scan/` | new tests in `compiler/tests/` |
| **Card / effective op: declared REST responses** | ~40 lines (`EffectiveOperation`, `CardOp` or `protocols.rest`, `Card.diff`) | `core/tests/card-entities.test.ts`, `testing/tests/drift.test.ts` |
| **`RestMiddleware`, `RestContext`, `Response`** in `adapter-rest` | ~80 lines | new |
| Independent fixes found on the way: GraphQL error masking; `registerGraphQL` passes no `contextValue`; relation resolvers drop `state` | ~15 lines | `adapter/graphql/tests/serve.test.ts`, `relation-batch.test.ts` |

Total: roughly 600 lines touched, net smaller once the REST merge and the body readers are counted.
GraphQL, JSON-RPC and oclif get **no** door middleware in this plan; they only share the body
reader and the error mapping.

---

## 5. Decisions

Decided by the owner on 2026-10-19. Each line names what was decided and the measured reason.

1. **Status codes: 201/204, read from the contract, never from the op name.** 201 for a POST on
   the collection (no parameter designates a row) that answers a row of its entity. 204 when the op
   answers nothing; a DELETE answering a boolean gives 204 on `true` and 404 on `false`. 404 when an
   op answering one row answers `null`, whatever its name. 200 otherwise. `protocols.rest.status`
   wins over all of these, on every host. Cost measured: the browser primitives go through
   `/_fougere/call` (`CALL_ENDPOINT`, `app/shared/src/Designation.ts`), never through REST, so the
   change on Nuxt, Next and Vite reaches outside REST clients only. In the tree, one reads REST
   (`demos/multi-frond/test.ts`), and it reads no status.
2. **Declared responses stay off the card for now.** The card publishes no REST path or method
   today; a 301 tied to a path it does not name would be half a fact. They live in
   `EffectiveOperation.protocols.rest`, and a future OpenAPI document is REST's card.
3. **A process serves the REST door of the fronds it hosts.** `blog` embedded in A: A serves its
   REST. `blog` split into B: B serves its REST, with its door middlewares, and the host routes
   `/api/blog` to B. A door middleware is the frond's code (`middlewares/`), like its handlers, so it
   runs where the frond runs and finds its dependencies (`OldSlugRepository`) there: moving the frond
   moves its door, with no line of code changed. Today A projects the REST of a frond it does not
   host and relays each call over JSON-RPC (`adapter/rest/src/routes/RouteDefinition.ts` `routesOf`,
   "remote proxy facades"): a side effect, removed. Two consequences: `fougere serve <frond>` serves
   REST, and a process no longer projects REST for a frond it does not host — a change of behaviour,
   said in the PR that makes it.
4. **A body already parsed by the host is accepted, with no refusal.** Case 3.3 reads the headers,
   and they are still there; what is lost is only avoiding the read, which the host then owns. One
   sentence in the docs.
5. **A header a frond-wide middleware writes stays off the card.** The frond-wide form decorates and
   refuses, nothing more. A header that must be published is declared by `Response<…>` on a handler.
6. **No door middleware for GraphQL and JSON-RPC for now — REST is the first realization of a door
   concept, not a REST feature.** The door middleware is written as a concept every door may have
   (a static naming its door, read from `Protocols`), and REST is its first realization. JSON-RPC
   links trusted peers and has no measured native need; GraphQL answers one response for many ops.
   Each gets its own the day a real case asks.
7. **A door middleware's refusals stay out of the op's `errors`.** A GraphQL or JSON-RPC caller never
   meets them, and adding them would put codes that cannot happen into a facade's `switch`. They are
   published on REST's side, with the responses.
8. **The door lifecycle publishes its steps to the same observer as the middle.** `decoded`,
   `encoded`… join `received`, `completed`, `settled` on `DispatchLifecycle`, observe-only as today.
   Observability subscribes once and sees the edges of every door, where each adapter would
   otherwise instrument itself, and where its middleware sees the middle only — a slow serialization
   or a slow upload is invisible today. The steps come from the shared edge mechanism (phase 3 on),
   never from events written in each adapter. A request is not a call: one GraphQL request calls
   several ops, so the observer relates a request to its calls the way a trace relates a parent to
   its children.
9. **A body that is not JSON is refused with 415.** The silent `{}` is what the tree refuses
   elsewhere: JSON-RPC used to drop `body` in silence and now refuses it by name (`SENT`,
   `transport/http/src/server.ts`). Fastify already answers 415. GET and HEAD carry no body. Accepting
   multipart, the day it is needed, is a hook at `decode`.

### Out of scope

- **The media type** (case 3.4): a generic projection chosen by `Accept`, the card itself as a
  media type (OpenAPI, SDL). A project of its own.
- **Writing state that lives across calls**: the dual of a binding source — an op writes
  (`keep('cart', id)`), a `state:` key in the config picks cookie, session or localStorage, and
  `@fougere/http` writes `Set-Cookie` for every HTTP door. A project of its own, not settled by the
  middlewares writing `context.state` for one call.

---

## 6. Implementation plan

Base: `main` at `572b018` (fetched 2026-10-19, same commit as section 1). Seven phases. Each one is
its own PR and leaves `main` green. Section 5 is decided, so no phase waits on a question any
more; the order below is the order of dependencies.

```
0 pin today ──┬── 1 GraphQL fixes
              ├── 2 one body reader ──┐
              ├── 4 output as one list │
              └───────────────────────┴── 3 one REST edge ── 5 frond-wide door middleware
                                                               └── 6 per-handler + Response<…> ── 7 docs + demo
```

Every phase runs the same checks before its push: the changed packages' `test`, `pnpm -r typecheck`,
`pnpm arch`, `pnpm arch:cycles`, and `pnpm import:check` whenever an export moves (phases 2, 3, 5, 6).

### Phase 0 — pin what the doors answer today

No behaviour change. Tests only.

- `testing/src/DoorContractCase.ts` `checkDoors` compares bodies across `local`, `rpc`, `rest` and
  `graphql`, and reaches REST through `serveRest` alone. It never compares a status, and never calls
  `registerRoutes`. That is why the gaps in 1.9 passed.
- Add `registerRoutes` as a fifth facade there (through a fake `HttpRouter`, as in the 1.9 probe),
  and compare the **status** as well as the body.
- The GraphQL test where an op throws a plain `Error` fails today, so it lands with its fix, in
  phase 1: a red test may not sit on `main`.
- Status assertions that split the two REST edges stay out until phase 3. A test may not be
  skipped to stay green, so phase 0 only adds what holds today.
- Size: ~120 lines of tests. Gated on: nothing.

### Phase 1 — GraphQL: mask errors, carry state

Three defects that exist today and need no decision.

- In `adapter/graphql/src/OperationsConfig.ts` `registerOperations`, the resolver catches the
  failure and rethrows it as a `GraphQLError` whose message and `extensions` come from
  `toPublicError` (`core/src/wire/http-error.ts`). An `INTERNAL_ERROR` then reads `Internal error`,
  as it does on REST and JSON-RPC.
- `adapter/graphql/src/serve.ts` `registerGraphQL` passes `contextValue: { state: ctx.state }`.
- `adapter/graphql/src/auto-register.ts` `registerAll`: the relation resolvers pass the caller's
  `ctx.state` instead of `state: {}`.
- Tests: the masking test (written here, since it is red before the fix), plus one per state fix in `adapter/graphql/tests/serve.test.ts`
  and `relation-batch.test.ts`.
- Size: ~20 lines of code. Gated on: nothing.

### Phase 2 — one body reader

Nine readers become two (1.8).

- CLAUDE.md says every door reads `maxBodyBytes`. Measured, four do not: Hono, Nuxt's REST route,
  and `rest`/`graphql` in `app/shared/src/web.ts`. This phase makes the sentence true.
- **Where it lives.** `transport/http` depends on `@fougere/core` and not on `@fougere/http`
  (checked in each `package.json`), so the shared reader goes in core, beside the limit:
  `core/src/wire/BodyLimit.ts` gets `readWithin(chunks: AsyncIterable<Uint8Array>, declared?: number)`.
  It refuses on the declared length first, then while counting. Both a Web `ReadableStream` and a
  Node `IncomingMessage` iterate as `AsyncIterable`, so one function serves both runtimes.
- `@fougere/http` takes no dependency on core, by its own rule (`MAX_BODY_BYTES` in
  `http/src/express.ts`), so it keeps one reader of its own. Hono's `body` moves onto it.
- Moves onto `readWithin`: `transport/http/src/receive.ts` `bodyWithin`,
  `transport/http/src/serve/RunningReceiver.ts` `answering`,
  `app/nuxt/src/runtime/server/routes/call.post.ts` (its three branches),
  `app/nuxt/src/runtime/server/api/crud.ts`, and `call`/`rest`/`graphql` in `app/shared/src/web.ts`.
- What changes for users: a body over `maxBodyBytes` on those four doors now gets 413 instead of
  being read whole.
- A body that is not JSON is refused with 415 on every reader (decision 9). `readExpressBody` and
  Hono's `body` stop returning `{}` for it.
- Tests: `transport/http/tests/limit.test.ts` and `receive.test.ts` stay green. New: one 413 test
  for each door that had no limit, and a 415 test for each REST reader. Nothing pins Nuxt's limit
  today.
- Size: −150 lines net.

### Phase 3 — one REST edge

`registerRoutes` and `serveRest` become one function, and the hosts become shells.

- In `adapter-rest`: `restEdge(app)` returns `answer(request)`. The request is
  `{ method, path, query, headers, body: () => Promise<unknown>, state }`, and the answer is a
  `ResponseResult` or `pass`. It holds:
  - match: `app/shared/src/RouteMatch.ts` `matchRoute` moves in, keeps the 405 with `allow`, and
    carries `successStatus` (`Matchable` gains it);
  - decode: `body()` is called inside the edge, not by the host;
  - call: through `App.facadeFor`, so `decoded` applies on every host (today it applies only behind
    `registerRoutes`);
  - encode: one status rule (decision 1), `toHttpError`, headers written on success too.
- `adapter/rest/src/register.ts` `registerRoutes` becomes `router.on(method, path, ctx => answer(…))`.
- `app/shared/src/Outcome.ts` `serveRest` and `shapeRest` delegate to `restEdge`. Callers keep
  their names: `testing`, `app/shared/src/express.ts`, `web.ts`, Nuxt `crud.ts`.
- **The status rule is decision 1**, read from the contract: the method `deriveMethod` chose, the
  binding plan (does a parameter designate a row), the output schema and the cardinality. Nothing
  reads `operationName` any more. `protocols.rest.status` wins, on every host.
- The two 404 body shapes (`{error}` and `{message}`) become the `toHttpError` shape, `{ code, message }`.
- **The edge answers for the fronds this process hosts** (decision 3). `routesOf` stops projecting
  a frond that answers elsewhere; `fougere serve <frond>` mounts the edge, so the served process
  answers its own REST. Said in the PR as a change of behaviour: a client calling `/api/blog` on A
  goes to B.
- **The edge publishes its steps** (decision 8): `decoded` after `body()`, `encoded` before the
  host sends, to `DispatchLifecycle`, carrying the request so an observer relates it to its calls.
- Tests to rewrite: `app/shared/tests/serve.test.ts` (`shapeRest` answers 200 today),
  `restRoutes.test.ts` and `app/shared/tests/express.test.ts`. `adapter/rest/tests/fastify.test.ts`
  (201/204/404) keeps its expectations and gains a renamed op (`remove`) answering the same. Phase
  0's status assertions go in here, across both entries.
- Size: ~200 lines moved, ~120 removed.

### Phase 4 — the middle's output as one list

A refactor. No behaviour change.

- In `core/src/dispatch/HandlerFacade.ts` `answer`, `stepped` followed by `view.project` becomes a
  single loop over `[...this.facade.steps, project]`. `project` is built by `viewOf`, is always
  last, and cannot be removed. The three skips (`written`, `view.closed`, no step) stay as
  conditions on the list.
- `AnswerStep` (`dispatch/AnswerStep.ts`) keeps its type. `OutputView.project` is wrapped to that
  type.
- Tests: `core/tests/egress-objects.test.ts`, `extension-doors.test.ts`, the presenter tests in
  `adapter/rest` and `adapter/graphql`. All unchanged and green.
- Size: ~20 lines. Gated on: nothing. Can ship in parallel with phases 1 to 3.

### Phase 5 — the frond-wide REST door middleware

Cases 3.2 (header) and 3.3 (upload refused on its headers).

- `adapter-rest` exports `RestMiddleware()` and `RestContext`. `RestMiddleware()` returns a class
  extending core `Middleware` with a static `door = 'rest'`. `RestContext` extends
  `OperationContext` with `request.headers`, `params`, and a `response.headers` bag that encode
  merges in.
- Core's `registerMiddlewares` (`core/src/boot/install.ts`) leaves out a middleware whose class
  names a door. It is still built once per frond scope, at its first call. A reading
  `App.doorMiddlewares(address, door)` hands the instances to the adapter in order: inherited
  first, then the frond's own (`Assembly.middlewaresOf`).
- The REST edge from phase 3 runs that chain around `decode → dispatch`. The body is read inside
  `next()`.
- The scan (`compiler/src/scan/scanner.ts`, the `middlewares/` reading) accepts the subclass. The
  `middlewares:` order and its two refusals cover it unchanged.
- A door middleware runs in the process that hosts its frond, which is the one serving that
  frond's REST (decision 3) — no refusal needed. A body the host parsed before us is accepted
  (decision 4).
- `RestMiddleware()` is the REST realization of a door middleware (decision 6): the static `door`
  and the core skip are written for any door, not for `'rest'`.
- The refusal walk (`compiler/src/scan/refusals.ts`) does not follow a door middleware's throws
  (decision 7).
- Tests: `core/tests/middleware-frond.test.ts` (a door middleware does not run behind JSON-RPC or
  the in-process call), new `adapter/rest/tests/door-middleware.test.ts` (header on success and on
  error, 413 before `body()` is called), `compiler/tests/middleware-form.test.ts`.
- Size: ~200 lines.

### Phase 6 — per handler, and `Response<…>`

Case 3.1 (301). Case 3.4 (CSV) is out of scope: the media-type project.

- `RestMiddleware(PostHandler)`: each method is the `around` for the op of the same name.
- `Response<Status, Headers, Body>` is an interface in `adapter-rest`. The scan reads its `status`
  and `headers` fields off the checked return type, not its type arguments.
- New boot refusals: a method that names no op of its handler, a `status` that is not a literal,
  and a `Response` returned from the frond-wide form.
- `EffectiveOperation.protocols.rest` gains `responses: { status, headers }[]`. The card does not
  carry it (decision 2), and a frond-wide header never joins it (decision 5).
- Encode writes a `Response` as given.
- Tests: `compiler/tests/` for the field reading through an alias and for the three refusals.
  `adapter/rest/tests/` for the 301, and for GraphQL and JSON-RPC still answering `NOT_FOUND`.
- Size: ~200 lines.

### Phase 7 — docs and a demo

- A site page for the door middleware, and links from `site/content/docs/4.business/10.ports.md`
  (which today points to `router.use` for HTTP needs).
- The page says that a header a frond-wide middleware writes is not in the contract, and that a
  header to publish is declared by `Response<…>` on a handler (decision 5); and that a body the host
  parsed first is accepted (decision 4).
- A CLAUDE.md paragraph. KNOWN_ISSUES gains one entry, stated and left as is: REST is the only door
  with a door middleware so far (decision 6).
- `demos/door-lifecycle`: cases 3.1 to 3.3, like the other one-concept demos, with its line in
  CLAUDE.md's `## Commands`.

### Order of work

Phases 0 and 1 are done and merged (#18, #17): the GraphQL leak of an internal message is closed.
Then 2 and 4, in either order. Then 3, 5, 6 and 7, each on the one before it. No phase starts
without the owner's go.
