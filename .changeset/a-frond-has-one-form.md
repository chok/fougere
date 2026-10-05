---
'@fougere/core': minor
---

What `frond()` takes derives from what the scan produces: the five entries share `Subject`
(`ctor`, `deps`, `filePath`), and `DeclaredSubject`, `DeclaredHandler` and `Declared` pick
from them. `pipes`, `surfaces` and `reads` are `FrondConfig`'s, read by the descriptor and the
declaration alike.

`FrondConfig.bindings` is gone: nothing read it, and `ports:` is what binds an
implementation.
