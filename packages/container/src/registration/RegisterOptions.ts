import type { Lifetime } from './Lifetime.js';

export interface RegisterOptions {
  lifetime?: Lifetime;

  /**
   * The TYPE names of the constructor's parameters, resolved in this scope in order —
   * `constructor(private users: UserRepository, private log: Logger)` is
   * `deps: ['UserRepository', 'Logger']`.
   */
  deps?: string[];
}
