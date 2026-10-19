# Door lifecycle — measure and plan

Status: proposal. No file under `packages/` was changed. Every claim cites a file and a symbol.
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
   `decode → middle` and runs before `encode`. It covers the four test cases. The output of the
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
  the door. Core answers a value; the door turns it into bytes.
- **Written state is not a core step either.** Middlewares already write `context.state`, and
  `HandlerFacade.answer` already judges what they wrote (`state.judge(…, entered)`). That is the
  existing form.
- **Dual of `BindingSources`, but not a registry yet.** `BindingSources` is a `Registry` because a
  parameter's kind arrives as data (`kind: 'collector'`). An answer step arrives with its extension,
  in ascent order (`stepsOver` in `boot/install.ts`). A registry would add a name with nothing to
  look it up. Keep the list; give it the same type and loop as an input source.

`DispatchLifecycle` stays an observer around the whole middle (m1, m11). It must not become a
hook point: its contract is "never participates in decisions" (`DispatchLifecycle.publish` swallows
observer errors). One reader today.

### 2.4 How many hooks to open

**Recommendation: one per door, at first — a door middleware wrapping `decode → middle`.**

```
REST:  receive → match → [ RestMiddleware ( decode → middle ) ] → encode → send
```

- It runs **before** the body is read (case 3) because `decode` happens inside `next()`.
- It sees the **answer** after `next()` (cases 1, 4).
- It can **add headers** through a response-headers bag that `encode` merges (case 2).
- `next()` resolves to the projected answer `T`, never to bytes. So a middleware that does not
  declare `Response<…>` can only return `T` (the rule `AppMiddleware` already states).

What each extra hook would cost:

| Extra hook | Gives | Costs |
|---|---|---|
| at `match` | rewrite which op answers | the card's derived paths stop being the truth; a hidden route |
| separate `decode` step list | custom body formats (multipart, CSV in) | a second list beside the middleware; an input contract the scan cannot see |
| separate `encode` list (encoders by media type) | one CSV encoder for every op | a registry of formats — a list of types again, which the owner rejected |
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
  form cannot declare one. If it must be published, that is an open question (5.5).

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
  picks itself (2 GB) is not on the card — see 5.7.

### 3.4 `text/csv` instead of JSON for the same op (by `Accept`)

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

## 5. Open questions (for the owner)

1. **Which status set wins when the two REST edges merge?** `registerRoutes` answers 201 / 204 /
   404-on-false; the web hosts answer 200 everywhere (the comment in `shapeRest` defers this to
   "whoever owns what a verb means"). Merging forces a choice, and either one changes behaviour for
   half the hosts.
2. **Where do declared responses live on the card?** `CardOp` is protocol-neutral today (no path,
   no method). Put `responses` under a REST member of the op, or keep them off the card and only
   in a future OpenAPI file? Nothing generates OpenAPI today (KNOWN_ISSUES, "Nothing generates
   OpenAPI").
3. **Where does a per-handler REST middleware run when its frond is remote?** The REST request
   arrives in process A; `PostHandler` answers in process B. Run the middleware in A (where the
   request is, but A may not hold the frond's code or its dependencies like `OldSlugRepository`) or
   refuse REST for a remote frond's door middleware at boot?
4. **Is `decode` inside the door chain acceptable for every host?** Express may have parsed the
   body before us (`readExpressBody` reads `req.body` when a parser ran). Then case 3 cannot be
   honoured, only reported. Refuse at boot, warn, or accept?
5. **Should the frond-wide form be able to publish a header** (case 3.2) on the card, or is a
   decorating header always invisible by design?
6. **Do GraphQL and JSON-RPC get door middlewares later**, or is REST the only door with native
   needs? The plan opens REST only.
7. **Is a door middleware allowed to refuse with any `FougereError` code**, and if so does the
   refusal join the op's `errors` on the card (the scan walks refusals upward from throw sites,
   `compiler/src/scan/refusals.ts`) — or are door refusals kept apart from the op's contract?
8. **Should `DispatchLifecycle` see the edges** (time spent in `decode`/`encode`), or stay on the
   middle only?
