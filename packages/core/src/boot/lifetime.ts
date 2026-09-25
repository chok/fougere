import type { RegisterOptions } from '@fougere/container';

/**
 * A class that closes — it answers `[Symbol.asyncDispose]` — holds something: ONE of it per
 * scope, and that scope closes it. Any other class is built per consumer, closed by nobody.
 * Read off the class at runtime, since an `implements` does not survive the compilation.
 */
export function lifetimeOf(ctor: abstract new (...args: never[]) => unknown): Pick<RegisterOptions, 'lifetime'> {
  const prototype = ctor.prototype as Partial<AsyncDisposable>;

  return typeof prototype[Symbol.asyncDispose] === 'function' ? { lifetime: 'singleton' } : {};
}
