---
'@fougere/defaults': minor
'@fougere/vite': minor
'@fougere/next': minor
---

A Vite or Next build writes `.fougere/fronds.generated.ts` beside its facade, and a server whose
install left the compiler out — a production install, the starters list it as a dev dependency —
boots from it instead of scanning. Measured on `demos/react-router-blog`: built, compiler removed,
`react-router-serve` answers.
