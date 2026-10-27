---
'@fougere/http': minor
'@fougere/adapter-rest': minor
'@fougere/adapter-graphql': minor
'@fougere/app': minor
'@fougere/transport-http': patch
'@fougere/next': patch
---

An engine is already a router, so Fougere ships none: `HttpRouter`, `createHonoRouter`,
`createFastifyRouter`, `createExpressRouter`, `Middleware`, `PASSTHROUGH`, `httpLogger`,
`readExpressBody` and `HttpError` leave `@fougere/http`, which keeps the words the doors share —
`HttpMethod`, `ResponseResult`, `HttpCarrier`. `registerRoutes`, `registerDescribed` and
`registerGraphQL` are gone with them: an app mounts on any engine with `answer(app, request)`, now
its own subpath, `@fougere/app/answer`, which loads no boot and runs on a Worker. It answers GraphQL
over GET too, a mutation there refused. `pageDoor` is exported from `@fougere/transport-http/receive`,
`useFougereAuth` moves beside the boot, and `stateFor` takes the app it reads.
