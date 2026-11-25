---
'@fougere/core': minor
'@fougere/schema': patch
'@fougere/services': minor
'@fougere/cli': minor
---

`services:` names the programs the app needs running beside it — `{ meili: { type: 'docker', image: 'getmeili/meilisearch:v1.12', port: 7700, health: '/health' } }` — each entry its type's, `process` and `docker` brought by `@fougere/services`. `fougere up` starts every service whose `<NAME>_URL` the environment does not give, waits until it answers, then every process of `processes:` and every app's `dev` script, in one terminal. `fougere env <process>` prints what a process is told: its name, where it listens, where its neighbours answer, every service's address.
