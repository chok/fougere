/**
 * Resolver function — receives the container to resolve dependencies.
 */
export type ResolverFn<T = unknown> = (container: Container) => T;

/**
 * Registration options.
 */
export interface RegisterOptions {
  /** Lifetime of the resolved value. Default: 'transient'. */
  lifetime?: 'singleton' | 'scoped' | 'transient';
  /** Dependency type names for type-based resolution (from AST scan). */
  deps?: string[];
}

/**
 * A class constructor with any arguments.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T = unknown> = new (...args: any[]) => T;

/**
 * What can be registered: a class or a resolver function.
 */
export type Registration<T = unknown> = Constructor<T> | ResolverFn<T>;

/**
 * DI container interface — the only thing application code sees.
 */
export interface Container {
  /** Register a value by name. */
  register<T>(name: string, registration: Registration<T>, options?: RegisterOptions): void;

  /** Register a pre-built value by name. */
  registerValue<T>(name: string, value: T): void;

  /** Resolve a dependency by name. */
  resolve<T>(name: string): T;

  /** Check if a name is registered (including parent scopes). */
  has(name: string): boolean;

  /** Create a child scope. Inherits parent registrations. */
  createScope(): Container;

  /** Dispose the container and its scoped singletons. */
  dispose(): Promise<void>;
}
