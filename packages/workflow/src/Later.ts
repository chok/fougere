import { entity, json, number, optional, primary, text } from '@fougere/schema';

/**
 * A call that has not happened yet, and who is making it happen.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export default class Later extends entity({
  id: primary(text()),
  /** The address, flat, so a due row is found without reading what it carries. */
  address: text(),
  operation: text(),
  /** What the caller supplied — params, query, input, identity. `runAt` is dropped on the way out. */
  invocation: json(),
  runAt: number({ integer: true }),
  takenUntil: optional(number({ integer: true })),
}, { previous: { address: 'entity' } }) {}
