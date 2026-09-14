import { entity, json, number, optional, primary, text } from '@fougere/schema';

/**
 * A call that has not happened yet, and who is making it happen.
 *
 * Distinct from `Run`, which says a release BEGAN and can be redone: this one never began, so
 * it goes out exactly once, and a taker holds it for a bounded time rather than locking it —
 * the same answer `RunRepository` gives, for the same reason a process cannot tell a dead peer
 * from a slow one.
 *
 * Documented: [entities](https://fougere.dev/docs/schema/entities).
 */
export default class Later extends entity({
  id: primary(text()),
  /** The address, flat, so a due row is found without reading what it carries. */
  entity: text(),
  operation: text(),
  /** What the caller supplied — params, query, input, identity. `runAt` is dropped on the way out. */
  invocation: json(),
  runAt: number({ integer: true }),
  takenUntil: optional(number({ integer: true })),
}) {}
