export class Disposables {
  static is(value: unknown): value is AsyncDisposable {
    return typeof value === 'object' && value !== null
      && typeof (value as AsyncDisposable)[Symbol.asyncDispose] === 'function';
  }
}
