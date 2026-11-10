import { entity, number, oneOf, optional, primary, text } from '@fougere/schema';

/**
 * A release that is under way, and who is driving it.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export default class Run extends entity({
  /** `user:ada` — derived from what is released, so relaunching is the same run, not a second. */
  id: primary(text()),
  entity: text(),
  key: text(),
  status: oneOf('running', 'done', { default: 'running' }),
  /** Who is driving, and until when. An expired lease is what a sweep claims. */
  leaseOwner: text(),
  leaseUntil: number({ integer: true }),
  finishedAt: optional(number({ integer: true })),
}) {}
