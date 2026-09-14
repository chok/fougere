import type { FougerePorts } from './FougerePorts.js';
import type { AnswerFor } from './AnswerFor.js';

/**
 * The ports of this app, each mapped to what may answer it.
 *
 * `keyof FougerePorts` is `never` before generation, and a mapped type over `never` is `{}` —
 * which would refuse every key rather than accept any. So the empty case widens to the plain
 * record the config had, and only a generated file narrows it.
 */
export type PortChoice = keyof FougerePorts extends never
  ? Record<string, string | readonly string[]>
  : { [Port in keyof FougerePorts]?: AnswerFor<Port & string> | readonly AnswerFor<Port & string>[] };
