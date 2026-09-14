import { entity, number, oneOf, optional, primary, text } from '@fougere/schema';

/**
 * A release that is under way, and who is driving it.
 *
 * There is no plan here and no position, because a release needs neither: every hop it makes
 * is already idempotent — a row taken out twice is taken out once, a field emptied twice is
 * empty — so RESUMING is simply doing it again. What the row has to say is that somebody
 * started and did not finish.
 *
 * Documented: [entities](https://fougere.dev/docs/schema/entities).
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
