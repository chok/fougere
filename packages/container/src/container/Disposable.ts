/** Anything holding a resource can say so, and disposing the container says it back. */
export interface Disposable {
  dispose(): void | Promise<void>;
}

export class Disposables {
  static is(value: unknown): value is Disposable {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as Disposable).dispose === 'function'
    );
  }
}
