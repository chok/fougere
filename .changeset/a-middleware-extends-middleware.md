---
'@fougere/core': minor
'@fougere/compiler': minor
---

**Breaking.** A middleware now extends `Middleware`, exported by `@fougere/core`:

```ts
import { Middleware, type AppNext, type OperationContext } from '@fougere/core';

export default class Audit extends Middleware {
  async around<T>(context: OperationContext, next: AppNext<T>): Promise<T> {
    return next();
  }
}
```

A middleware with a constructor calls `super()` first. A class in `middlewares/` that does not extend `Middleware` no longer runs, and the boot warns about it (`middleware-not-extended`) instead of skipping it in silence. A misspelled `around` no longer compiles, and `around` must give back what `next()` gave it.
