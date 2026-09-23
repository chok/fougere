---
'@fougere/core': minor
'@fougere/auth-better': minor
'@fougere/app': minor
'@fougere/compiler': minor
'@fougere/nuxt': minor
'@fougere/transport-http': minor
'@fougere/schema': minor
---

The auth is a frond, and a call's state is declared.

`auth: betterAuth({ … })` becomes `fronds: { auth: betterAuth({ … }) }`: the entry holds the
frond, which carries its extension, so `only:` leaves the engine out of a process that does not
serve it. An extension declares what a call's `state` may hold (`Extension.state`); the state is
judged where it entered, a receiver marks a call `crossed`, and `Collector(User)` hands on a
`User` rebuilt from what crossed. A date inside `json(Entity)` or `list()` is now read back as a
`Date`.
