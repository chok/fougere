---
'@fougere/cli': minor
---

`fougere new` writes `tests/boots.test.ts`, run by `pnpm test`: it boots the whole project as `fronds:` places it, on an in-memory database and without the other processes running, so a project that would refuse to boot fails in CI rather than at deploy.
