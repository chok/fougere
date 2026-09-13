/**
 * One input, and what the validator must answer.
 *
 * `expect` carries the PATH of the field at fault and never the message. We know which
 * field must be refused because we are the ones who broke it; naming the message would
 * make this list a second validator, and the two would then have to be kept in step by hand —
 * which is the duplication the whole thing exists to remove.
 */
export interface ValidationCase {
  /** What this input does, in one clause — carried into the assertion so a failure reads. */
  why: string;
  input: unknown;
  /** Judged as an update rather than a creation. */
  patch: boolean;
  expect: 'accept' | { reject: string };
}
