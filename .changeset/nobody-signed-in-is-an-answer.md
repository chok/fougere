---
'@fougere/auth-better': patch
'@fougere/app': patch
---

`session.get` answers `{ user }`, `{ user: null }` when nobody is signed in — an answer, where a bare
`null` read as a missing row and REST answered 404 for every anonymous caller.
