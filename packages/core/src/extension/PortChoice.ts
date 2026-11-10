import type { FougerePorts } from './FougerePorts.js';
import type { AnswerFor } from './AnswerFor.js';

/** The ports of this app, each mapped to what may answer it. */
export type PortChoice = keyof FougerePorts extends never
  ? Record<string, string | readonly string[]>
  : { [Port in keyof FougerePorts]?: AnswerFor<Port & string> | readonly AnswerFor<Port & string>[] };
