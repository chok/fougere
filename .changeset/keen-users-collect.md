---
"@fougere/core": patch
---

A stated collector is keyed the way a binding looks one up. The scan writes `lowerFirst`
of the type it answers for, `frond()` wrote the class name as-is, and the boot asks for
the key `computeBindingPlan` derives from a parameter's type — which is lowerFirst. So a
host booting from a written statement held `User` while every lookup asked for `user`: a
handler taking one fell through to the request input, and the boot refused a contract it
had everything to resolve.

Measured on `demos/nuxt-blog` with its hand-written `fronds.ts` set aside: `publish`,
`mine` and `searchByTitle` answer.
