import { entity, text, bool, optional } from '@fougere/schema';

/**
 * What a subscriber answers, and it is its OWN entity.
 *
 * A verdict shaped like the question would read as a transformation — the same signature a
 * link has (`Pipe<T>` in, `T` out). A different type says which of the two it is.
 */
export default class Verdict extends entity({
  from: text(),
  ok: bool(),
  /** Why not, when not. */
  because: optional(text()),
}) {}
