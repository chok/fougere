---
'@fougere/oclif': minor
'@fougere/cli': minor
---

`frond.config.ts` says which parameters the terminal takes by position: `operations: { 'serve.execute': { terminal: { positional: ['process'] } } }`. Unsaid, the first required text stays the positional one.
