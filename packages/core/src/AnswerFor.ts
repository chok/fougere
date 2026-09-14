import type { FougerePorts } from './FougerePorts.js';
import type { NameOf } from './NameOf.js';

/** What may answer a port — its own realizations, or any class name where nothing was generated. */
export type AnswerFor<Port extends string> = FougerePorts extends Record<Port, infer Answers extends string>
  ? Answers
  : NameOf<'handler'>;
