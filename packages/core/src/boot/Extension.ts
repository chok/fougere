import type { App } from './App.js';
import type { Field } from '@fougere/schema';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';

/**
 * One process-level extension and its lifecycle.
 *
 * Documented: [lifecycle](https://fougere.dev/docs/run/lifecycle).
 */
export interface Extension {
  name: string;
  /** The fronds it brings, read before the ascent. */
  fronds?: readonly FrondDescriptor[];
  /**
   * The members it puts on a call's `state`.
   * Ex: `{ user: json(User) }`.
   */
  state?: Readonly<Record<string, Field>>;
  up?(app: App): void | Promise<void>;
  down?(app: App): void | Promise<void>;
}
