---
'@fougere/app': minor
'@fougere/nuxt': minor
'@fougere/next': minor
'@fougere/vite': patch
'@fougere/testing': patch
---

Every host answers through `answer` (`@fougere/app/web`). Express mounts one middleware,
`fougere()`, read through srvx's `NodeRequest` — `call()`, `rest()`, `session()` and `graphql()` are
gone, and what is served is `protocols:` alone. Nuxt mounts one handler on each of its routes, and a
REST or GraphQL refusal answers the same body there as on every other host. Next has one route
subpath, `@fougere/next/route`, in place of `/call`, `/rest` and `/session`. `serveRest`, `serveRpc`,
`refusedRpc`, `rpcParseError`, `serveGraphQL` and their `Outcome` are gone from `@fougere/app`:
a host hands a `Request` and receives a `Response`.
