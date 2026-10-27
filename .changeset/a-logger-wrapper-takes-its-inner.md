---
'@fougere/core': minor
---

`new Logger(inner)` takes the logger it stands in front of and writes with its line, carry and operation,
so `class Masking extends Logger { constructor(inner: Logger) { super(inner) } }` loses nothing it leaves
out. A name still makes a fresh one — `new Logger('app')`.
