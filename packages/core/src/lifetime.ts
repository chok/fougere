import type { RegisterOptions } from '@fougere/container';

/** A class that closes is one per scope, closed by it; any other is built per consumer. */
export function lifetimeOf(ctor: abstract new (...args: never[]) => unknown): Pick<RegisterOptions, 'lifetime'> {
  const prototype = ctor.prototype as Partial<AsyncDisposable & Disposable>;
  const closes = typeof prototype[Symbol.asyncDispose] === 'function' || typeof prototype[Symbol.dispose] === 'function';

  return closes ? { lifetime: 'singleton' } : {};
}
