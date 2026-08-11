/**
 * A class constructor with any arguments.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T = unknown> = new (...args: any[]) => T;

/**
 * Registration options.
 */
export interface RegisterOptions {
  /**
   * Lifetime of the resolved value. Default: 'transient'.
   *
   * Two words, because two are used: `Config` is a singleton, every handler,
   * presenter, collector and provider is transient — a fresh instance per
   * resolution, which is what keeps one call's state out of the next. A third,
   * `'scoped'`, was declared and never passed by any caller: {@link Container.createScope}
   * already answers "one instance per frond, per surface", and two mechanisms for
   * one need is one too many.
   */
  lifetime?: 'singleton' | 'transient';
  /** Dependency type names for type-based resolution (from AST scan). */
  deps?: string[];
}

/**
 * Anything holding a resource can say so, and disposing the container says it back.
 *
 * Not an interface a class implements — a shape a class happens to have. A handler
 * that opens nothing declares nothing.
 */
export interface Disposable {
  dispose(): void | Promise<void>;
}

/**
 * DI container interface — the only thing application code sees.
 *
 * It is deliberately small, and the reason is that the scan already knows the graph:
 * every class and every dependency is read from source before boot, so there is
 * almost nothing left to bind late. What remains is a Map with a parent chain, plus
 * the two gestures the scan cannot cover — {@link createScope} for isolation, and
 * {@link setFallback} for a frond that lives in another process.
 *
 * Resolution is by name, and the names are TYPE names produced by the AST scan.
 * The container never sees a type; "DI by type" is realized upstream, in the
 * scanner, which is why this file mentions neither.
 */
export interface Container {
  /** Register a class by name. Its `deps` are resolved from this container. */
  register<T>(name: string, ctor: Constructor<T>, options?: RegisterOptions): void;

  /** Register a pre-built value by name. */
  registerValue<T>(name: string, value: T): void;

  /** Resolve a dependency by name. */
  resolve<T>(name: string): T;

  /** Check if a name is registered (including parent scopes). */
  has(name: string): boolean;

  /**
   * A resolver of last resort, consulted when no scope holds the name.
   *
   * It exists for one reason: a frond declared in `remotes` registers nothing locally,
   * so its façade cannot be *found* — it has to be fabricated. Set on the root, inherited
   * by every scope. Returning `undefined` means "I don't know either", and the miss
   * throws as before.
   *
   * Optional: a container without one behaves exactly as it did.
   */
  setFallback?(resolve: (name: string) => unknown): void;

  /** Create a child scope. Inherits parent registrations. */
  createScope(): Container;

  /**
   * Dispose the container: every instance it KEPT — the singletons — that has a
   * `dispose` method is told, most recent first, and awaited. A failure does not
   * silence the rest; they travel out together in an `AggregateError`.
   *
   * This used to clear the registry and nothing else, while the doc above it promised
   * disposal — so `await using app` (which routes here through `app[Symbol.asyncDispose]`)
   * announced a cleanup that never happened. A container that holds instances is the
   * only thing that knows they exist; if it stays silent, nobody else can speak.
   *
   * What it does NOT dispose: a transient, handed over and forgotten in the same
   * breath, whose caller is the one who knows when it is done; and a value passed to
   * {@link registerValue}, which the container did not build.
   */
  dispose(): Promise<void>;
}
