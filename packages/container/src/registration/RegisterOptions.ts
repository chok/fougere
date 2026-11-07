import type { Lifetime } from './Lifetime.js';

export interface RegisterOptions {
  lifetime?: Lifetime;

  /**
   * The type names of the constructor's parameters, in order.
   * Ex: `constructor(users: UserRepository, log: Logger)` → `['UserRepository', 'Logger']`.
   */
  deps?: string[];
}
