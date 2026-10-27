---
'@fougere/auth-better': minor
'@fougere/app': minor
'@fougere/nuxt': minor
'@fougere/next': minor
'@fougere/react': patch
'@fougere/svelte': patch
---

Who is signed in is an operation of the auth frond, `session.get`, answering the user a call
carries or `null`; `useCurrentUser` and the server hydrations ask it through the call envelope, and
an app with no auth answers nobody. `/_fougere/session`, Nuxt's `/api/me` and `sessionViewOf` are
gone — the view used to strip a `passwordHash` field by name, which better-auth's user does not
have. `sessionOf(fetcher)` and `sessionOn(app, state)` read it from a page and from a server.
