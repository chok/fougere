import { entity, text, bool, optional, created } from '@fougere/schema';

/**
 * A question, and every answer to it.
 *
 * Nothing marks it as a question: it becomes one because somebody writes `Ask<CanBook>`
 * about it — and somebody else `Answer<CanBook>`. The same shape travels both ways, which
 * is why a responder amends rather than invents.
 */
export default class CanBook extends entity({
  room: text({ min: 1 }),
  at: created(),
  /** Who answered. Each responder writes its own name. */
  from: optional(text()),
  ok: optional(bool()),
  /** Why not, when not. */
  because: optional(text()),
}) {}
