/** What `extends Middleware` buys before anything runs: the compiler holds a class to `around`. */
import { describe, it, expect } from 'vitest';
import { Middleware, type AppNext, type OperationContext } from '../src/index.js';

describe('Middleware', () => {
  it('refuses a misspelled around at compile time, and leaves nothing of it at runtime', () => {
    // @ts-expect-error -- `arond` leaves the abstract `around` unimplemented.
    class Misspelled extends Middleware {
      async arond<T>(_context: OperationContext, next: AppNext<T>): Promise<T> {
        return next();
      }
    }

    expect((Misspelled.prototype as { around?: unknown }).around).toBeUndefined();
  });

  it('answers what next() answered, and nothing else', () => {
    class Wrapping extends Middleware {
      async around<T>(_context: OperationContext, next: AppNext<T>): Promise<T> {
        // @ts-expect-error -- a caller reads the handler's signature, so the answer keeps its type.
        return { data: await next() };
      }
    }

    expect(new Wrapping()).toBeInstanceOf(Middleware);
  });
});
