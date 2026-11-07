/** One input, and the field the validator must refuse. */
export interface ValidationCase {
  /** What this input does, in one clause — carried into the assertion so a failure reads. */
  why: string;
  input: unknown;
  /** Judged as an update rather than a creation. */
  patch: boolean;
  expect: 'accept' | { reject: string };
}
