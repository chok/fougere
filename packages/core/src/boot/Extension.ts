import type { App } from './App.js';
import type { Field } from '@fougere/schema';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { HandlerEntry } from '../descriptor/HandlerEntry.js';
import type { Container } from '@fougere/container';
import type { Logger } from '../builtin/Logger.js';
import type { OwnLogger } from '../builtin/OwnLoggers.js';
import type { AnswerStep } from '../dispatch/AnswerStep.js';

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
  /**
   * The members it puts on a call's `state` — `{ user: json(User) }`. A member nobody declares
   * is refused at the facade, and one declared twice refuses the boot.
   */
  state?: Readonly<Record<string, Field>>;
  /** Puts what it brings into a frond's scope, as that frond is installed — before any facade is built. */
  install?(frond: FrondDescriptor, at: { scope: Container; container: Container; ownLogger: OwnLogger; log: Logger }): void;
  /** What runs over a handler's answer before its view projects it. */
  steps?(handler: HandlerEntry, frond: FrondDescriptor, scope: Container): readonly AnswerStep[];
  up?(app: App): void | Promise<void>;
  down?(app: App): void | Promise<void>;
}
