// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T = unknown> = new (...args: any[]) => T;

export interface RegisterOptions {
  /**
   * `'singleton'` builds once per scope and the container disposes it; `'transient'`
   * builds per `resolve` and the caller closes it. Absent means `'transient'`.
   */
  lifetime?: 'singleton' | 'transient';

  /**
   * The TYPE names of the constructor's parameters, resolved in this scope in order —
   * `constructor(private users: UserRepository, private log: Logger)` is
   * `deps: ['UserRepository', 'Logger']`.
   */
  deps?: string[];
}

/** Anything holding a resource can say so, and disposing the container says it back. */
export interface Disposable {
  dispose(): void | Promise<void>;
}

/** DI container interface — the only thing application code sees. */
export interface Container {
  /** The container builds it: `register('UserService', UserService, { deps: ['UserRepository'] })`. */
  register<T>(name: string, ctor: Constructor<T>, options?: RegisterOptions): void;

  /** Already built, so never disposed here — `registerValue('Logger', new Logger('app'))`, a scope, a config. */
  registerValue<T>(name: string, value: T): void;

  /** Throws when nothing answers the name; `has` asks without throwing. */
  resolve<T>(name: string): T;

  /** Answers for this scope and its parents, and builds nothing. */
  has(name: string): boolean;

  /** A resolver of last resort, consulted when no scope holds the name. */
  setFallback?(resolve: (name: string) => unknown): void;

  /** The child reads every registration above it; the parent closes it. */
  createScope(): Container;

  /** Children first, then what this scope built, in reverse — refusals travel as one `AggregateError`. */
  dispose(): Promise<void>;
}
