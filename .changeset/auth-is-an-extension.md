---
'@fougere/core': minor
'@fougere/auth-better': minor
'@fougere/app': minor
'@fougere/adapter-sql': minor
'@fougere/defaults': minor
'@fougere/compiler': minor
---

An auth provider is an extension, and its rows live in a frond.

`betterAuth()` returns an `Extension` that brings a frond named `auth` — `session`,
`account`, `verification`, and `user` when the app names none — and registers its runtime
under `AUTH` in its `up`. Its writes now go through the frond's guarded storages, and its
tables migrate with every other frond's.

Gone with the slot: `CreateAppOptions.auth` and `.db`, `App.auth`, `AuthConfig`,
`AuthContext`, `SourceView.auth`, and `AuthRuntime.entities`/`.storages` — a host reads the
runtime with `authOf(app)` (`@fougere/app`) and a storage with `app.storageFor('session')`.
`fougere.config.ts` keeps `auth: betterAuth({ … })`. The default user's class is now named
`User`, so its table is `users` rather than `auth_users`.
