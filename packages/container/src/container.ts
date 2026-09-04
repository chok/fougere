/**
 * A class constructor with any arguments.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T = unknown> = new (...args: any[]) => T;

/**
 * Registration options.
 */
export interface RegisterOptions {
  /** Lifetime of the resolved value. */
  lifetime?: 'singleton' | 'transient';
  /** Dependency type names for type-based resolution (from AST scan). */
  deps?: string[];
}

/** Anything holding a resource can say so, and disposing the container says it back. */
export interface Disposable {
  dispose(): void | Promise<void>;
}

/** DI container interface — the only thing application code sees. */
export interface Container {
  /** Register a class by name. Its `deps` are resolved from this container. */
  register<T>(name: string, ctor: Constructor<T>, options?: RegisterOptions): void;

  /** Register a pre-built value by name. */
  registerValue<T>(name: string, value: T): void;

  /** Resolve a dependency by name. */
  resolve<T>(name: string): T;

  /** Check if a name is registered (including parent scopes). */
  has(name: string): boolean;

  /** A resolver of last resort, consulted when no scope holds the name. */
  setFallback?(resolve: (name: string) => unknown): void;

  /** Create a child scope. Inherits parent registrations. */
  createScope(): Container;

  /** Dispose the container: */
  dispose(): Promise<void>;
}
