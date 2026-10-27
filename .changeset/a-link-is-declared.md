---
'@fougere/core': minor
'@fougere/compiler': minor
---

A link may stand in front of a port without being one: `implements Partial<Payment>` with
`constructor(private inner: Payment)` writes only what it changes, and every method it leaves out is
the inner's, forwarded as it is built. The scan reads the clause TypeScript erases, the statement
carries it as `implements`, and a `frond()` written by hand states it. Without the clause a class
asking for a port is an ordinary service: a link is declared, never guessed. A class implementing a
port without asking for it is still warned, `Partial<X>` included, naming the inner to take.
