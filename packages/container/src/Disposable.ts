/**
 * What a scope closes — either spelling.
 *
 * `dispose()` is this repo's, and `[Symbol.asyncDispose]` is the language's, which `await using`
 * calls. `App` answers both, so a value built inside a scope may answer either.
 */
export interface Disposable {
  dispose(): void | Promise<void>;
}

export class Disposables {
  static is(value: unknown): value is Disposable | AsyncDisposable {
    if (typeof value !== 'object' || value === null) return false;

    return typeof (value as Disposable).dispose === 'function'
      || typeof (value as AsyncDisposable)[Symbol.asyncDispose] === 'function';
  }

  /** Whichever of the two it answers, asked once. */
  static async close(value: Disposable | AsyncDisposable): Promise<void> {
    const own = (value as Disposable).dispose;
    if (typeof own === 'function') {
      await own.call(value);

      return;
    }

    await (value as AsyncDisposable)[Symbol.asyncDispose]();
  }
}
