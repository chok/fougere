import type { App } from './App.js';
import type { FrondDescriptor } from '../descriptor/frond.js';

/**
 * One process-level extension and its reversible lifecycle.
 *
 * Documented: [lifecycle](https://fougere.dev/docs/infra/lifecycle).
 */
export interface Extension {
  name: string;
  /**
   * Fronds it brings — read BEFORE the ascent, since a frond is installed while the app is
   * still being made and `up` receives one that already exists. This is how an optional
   * package accepts a fact: `calls` and `observability` both want every `LogLine`, and a
   * signature is the only way to ask for one.
   */
  fronds?: readonly FrondDescriptor[];
  up?(app: App): void | Promise<void>;
  down?(app: App): void | Promise<void>;
}
